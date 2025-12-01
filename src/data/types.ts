export type Element = "Fire" | "Water" | "Grass" | "Dark" | "Light" | "Healing";

export interface LeaderPassiveEffect {
  type: "damage";
  elements: Element[];
  multipliers: number[]; // One multiplier per element in the elements array
  targets: string[]; // e.g., ["Enemy"] or ["Boss"]
}

export interface LeaderPassiveAbility {
  description: string;
  effect: LeaderPassiveEffect[];
}

export interface Card {
  id: string;
  name: string;
  rank: number;
  attack: number;
  hp: number;
  elements: Element[];
  imagePath: string;
  leaderPassive?: LeaderPassiveAbility[] | null;
}

export interface UnitEffect {
  type: string;
  description?: string;
  elements?: Element[];
  multipliers?: number[];
  targets?: string[];
  aoe?: boolean;
  cooldown?: number;
}

export interface Unit {
  id: string;
  name: string;
  attack: number;
  hp: number;
  elements?: Element[];
  tags: string[];
  imagePath?: string;
  effect?: UnitEffect[];
}

export interface LootEntry {
  item: string;
  chance: number; // 0..1
  amount?: [number, number];
}

export interface LootTable {
  id: string;
  entries: LootEntry[];
}

export interface StageUnit {
  unitId: string; // References card ID in cards.yaml
  position: number; // 0-3, left to right
  tags?: string[]; // Optional override for unit tags (e.g., to make a regular unit a Boss). Defaults to [Enemy] if not provided
  effect?: UnitEffect[]; // Optional override for unit effects
}

export type LootConfig =
  | string // Loot table id reference
  | LootEntry[] // Inline entries
  | { tableId?: string; entries?: LootEntry[] }; // Both (merged)

export interface StageDef {
  id: string;
  name: string;
  description?: string;
  imagePath?: string;
  units: StageUnit[];
  loot?: LootConfig;
}

export interface WorldDef {
  id: string;
  name: string;
  difficulty: "Easy" | "Medium" | "Hard";
  description?: string;
  primaryElement: Element;
  stages: StageDef[];
  imagePath: string;
}

export interface Loadout {
  leader: string; // card id
  members: [string, string, string]; // card ids in fixed slots (empty string = empty slot)
}

export interface ShopItem {
  id: string;
  cost: number;
  unit: "gold" | "plovmand";
  stock: number;
}

export interface Shop {
  id: string;
  name: string;
  description: string;
  imagePath: string;
  npcId: string;
  items: {
    cards: ShopItem[];
    consumables: ShopItem[];
  };
}

export interface NPC {
  id: string;
  name: string;
  imagePath: string;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  imagePath: string;
  elements?: Element[];
  effect?: unknown;
}

export interface Mutation {
  id: string;
  inputCards: string[]; // Card IDs (2 or 3 cards)
  resultCard: string; // Result card ID
}
