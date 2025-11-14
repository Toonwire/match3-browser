import type { LootConfig, LootEntry, LootTable } from "./types";
import { loadYaml } from "./loadYaml";

/**
 * Resolves a LootConfig to a LootTable with entries.
 * Handles:
 * - String: loads loot table by id from loot.yaml
 * - Array: treats as inline entries
 * - Object: merges shared table with stage-specific entries (stage-specific takes precedence)
 */
export async function resolveLootConfig(
  config: LootConfig | undefined
): Promise<LootTable | null> {
  if (!config) {
    return null;
  }

  // If it's a string, load the loot table by id
  if (typeof config === "string") {
    const lootTables = await loadYaml<LootTable[]>("/config/loot.yaml");
    return lootTables.find((table) => table.id === config) || null;
  }

  // If it's an array, treat as inline entries
  if (Array.isArray(config)) {
    return {
      id: "inline",
      entries: config,
    };
  }

  // If it's an object, merge table and entries
  const entries: LootEntry[] = [];

  // Load shared table if tableId is provided
  if (config.tableId) {
    const lootTables = await loadYaml<LootTable[]>("/config/loot.yaml");
    const sharedTable = lootTables.find((table) => table.id === config.tableId);
    if (sharedTable) {
      entries.push(...sharedTable.entries);
    }
  }

  // Add stage-specific entries (these override shared entries for same items)
  if (config.entries) {
    // Remove duplicates from shared entries if stage-specific has same item
    const stageItemIds = new Set(config.entries.map((e) => e.item));
    const filteredShared = entries.filter((e) => !stageItemIds.has(e.item));
    entries.length = 0; // Clear array
    entries.push(...filteredShared, ...config.entries);
  }

  return {
    id: config.tableId || "merged",
    entries,
  };
}
