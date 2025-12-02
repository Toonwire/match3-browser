import type { Card, Loadout, Element, Unit } from "../data/types";
import type { Match } from "./MatchLogic";

const triangle: Record<Element, Element[]> = {
  Fire: ["Grass"],
  Grass: ["Water"],
  Water: ["Fire"],
  Dark: ["Light"],
  Light: ["Dark"],
  Healing: [],
};

export function elementalMultiplier(attacking: Element, defending: Element): number {
  if (triangle[attacking]?.includes(defending)) return 1.5;
  if (triangle[defending]?.includes(attacking)) return 0.75;
  return 1;
}

/**
 * Calculates a non-linear combo multiplier based on the number of matches in a turn.
 * More combos = larger multiplier with diminishing returns.
 *
 * @param comboCount - Number of matches (combos) in the current turn
 * @returns Multiplier to apply to damage/healing (1.0 for 1 combo, increasing non-linearly)
 */
export function calculateComboMultiplier(comboCount: number): number {
  if (comboCount <= 1) return 1.0;

  // Non-linear scaling: 1 + (comboCount - 1) * 0.2 * sqrt(comboCount)
  // This gives: 1 combo = 1.0x, 2 = 1.28x, 3 = 1.55x, 4 = 1.80x, 5 = 2.04x, etc.
  return 1.0 + (comboCount - 1) * 0.2 * Math.sqrt(comboCount);
}

/**
 * Represents a damage instance that can be applied to enemies.
 * The damage calculation is separate from application for flexibility.
 */
export interface DamageInstance {
  element: Element;
  baseDamage: number; // Base damage amount before multipliers
  isAoE: boolean; // True if L/T shape match
  cardIds: string[]; // Cards that contributed to this damage
  leaderPassiveMultiplier?: number; // Multiplier from leader passive (applied for Enemy targets)
  leaderPassiveBossMultiplier?: number; // Multiplier from leader passive (applied for Boss targets)
}

/**
 * Computes damage instances from matches and loadout.
 * This is a pure function that calculates damage without applying it.
 *
 * @param matches - Array of matches found in the grid
 * @param loadout - Player's loadout (leader + members)
 * @param cards - All available cards (needed to check card elements and leader passives)
 * @param comboMultiplier - Optional multiplier from combo count (defaults to 1.0)
 * @returns Array of damage instances ready to be applied
 */
export function computeDamageFromMatches(
  matches: Match[],
  loadout: Loadout,
  cards: Card[],
  comboMultiplier: number = 1.0
): DamageInstance[] {
  // Tally matches by element (skip Healing elements)
  const tally = new Map<Element, { count: number; isAoE: boolean }>();
  for (const m of matches) {
    const el = m.element as Element;
    // Skip Healing elements - they are handled separately
    if (el === "Healing") continue;
    const rec = tally.get(el) ?? { count: 0, isAoE: false };
    rec.count += m.cells.length; // Total matched tiles
    rec.isAoE = rec.isAoE || m.shape === "L" || m.shape === "T";
    tally.set(el, rec);
  }

  const damageInstances: DamageInstance[] = [];

  // Get leader card for leader passive calculations
  const leaderCard = loadout.leader ? cards.find((c) => c.id === loadout.leader) : null;

  // Get all cards in loadout
  const loadoutCardIds = [loadout.leader, ...loadout.members].filter(Boolean);
  const loadoutCards = loadoutCardIds
    .map((id) => cards.find((c) => c.id === id))
    .filter((card): card is Card => card !== undefined);

  // Calculate leader passive multipliers for each element
  const leaderMultipliers = new Map<Element, { enemy: number; boss: number }>();
  if (leaderCard && leaderCard.leaderPassive && Array.isArray(leaderCard.leaderPassive)) {
    for (const ability of leaderCard.leaderPassive) {
      for (const effect of ability.effect) {
        if (effect.type === "damage") {
          // Match each element with its corresponding multiplier
          effect.elements.forEach((el, index) => {
            const multiplier = effect.multipliers[index] ?? 1;
            const current = leaderMultipliers.get(el) ?? { enemy: 1, boss: 1 };

            // Apply multiplier based on target type
            if (effect.targets.includes("Enemy")) {
              current.enemy = Math.max(current.enemy, multiplier); // Use max if multiple passives
            }
            if (effect.targets.includes("Boss")) {
              current.boss = Math.max(current.boss, multiplier); // Use max if multiple passives
            }

            leaderMultipliers.set(el, current);
          });
        }
      }
    }
  }

  // For each matched element, calculate damage from each card
  for (const [element, matchData] of tally.entries()) {
    const numMatchedTiles = matchData.count;
    const isAoE = matchData.isAoE;
    const minShapeSize = isAoE ? 5 : 3;

    // Get leader passive multipliers for this element
    const leaderMultiplier = leaderMultipliers.get(element) ?? { enemy: 1, boss: 1 };

    // Find cards that can deal this element's damage
    for (const card of loadoutCards) {
      if (card.elements.includes(element)) {
        // Calculate how much this card contributes
        // If card has multiple elements, it deals fractional damage
        const elementFraction = card.elements.length > 1 ? 0.75 : 1;
        const shapeFraction = numMatchedTiles / minShapeSize;
        const baseDamage = Math.floor(card.attack * elementFraction * shapeFraction * comboMultiplier);

        if (baseDamage > 0) {
          damageInstances.push({
            element,
            baseDamage,
            isAoE,
            cardIds: [card.id],
            leaderPassiveMultiplier: leaderMultiplier.enemy > 1 ? leaderMultiplier.enemy : undefined,
            leaderPassiveBossMultiplier: leaderMultiplier.boss > 1 ? leaderMultiplier.boss : undefined,
          });
        }
      }
    }
  }

  return damageInstances;
}

/**
 * Applies damage instances to enemies, considering elemental multipliers.
 * Single target damage is applied to the leftmost alive enemy.
 *
 * @param damageInstances - Damage instances to apply
 * @param enemies - Array of enemy units to damage (should be sorted by position, left to right)
 * @returns Updated enemy HP values (preserves all enemy properties)
 */
export function applyDamageToEnemies<T extends { unit: Unit; currentHp: number }>(
  damageInstances: DamageInstance[],
  enemies: T[]
): T[] {
  const updatedEnemies = enemies.map((e) => ({ ...e }));

  for (const damage of damageInstances) {
    if (damage.isAoE) {
      // AoE: Apply to all enemies
      for (const enemy of updatedEnemies) {
        if (enemy.currentHp > 0 && enemy.unit.elements?.[0]) {
          // Apply leader passive multiplier based on enemy type
          let leaderMultiplier = 1;
          const isBoss = enemy.unit.tags?.includes("Boss") ?? false;
          if (isBoss && damage.leaderPassiveBossMultiplier) {
            leaderMultiplier = damage.leaderPassiveBossMultiplier;
          } else if (damage.leaderPassiveMultiplier) {
            leaderMultiplier = damage.leaderPassiveMultiplier;
          }

          const elementalMult = elementalMultiplier(damage.element, enemy.unit.elements[0]);
          const finalDamage = Math.floor(damage.baseDamage * leaderMultiplier * elementalMult);
          enemy.currentHp = Math.max(0, enemy.currentHp - finalDamage);
        }
      }
    } else {
      // Single target: Apply to leftmost alive enemy
      // Since enemies are sorted by position (left to right), first alive enemy is leftmost
      const leftmostAlive = updatedEnemies.find((e) => e.currentHp > 0);

      if (leftmostAlive && leftmostAlive.unit.elements?.[0]) {
        // Apply leader passive multiplier based on enemy type
        let leaderMultiplier = 1;
        const isBoss = leftmostAlive.unit.tags?.includes("Boss") ?? false;
        if (isBoss && damage.leaderPassiveBossMultiplier) {
          leaderMultiplier = damage.leaderPassiveBossMultiplier;
        } else if (!isBoss && damage.leaderPassiveMultiplier) {
          leaderMultiplier = damage.leaderPassiveMultiplier;
        }

        const elementalMult = elementalMultiplier(damage.element, leftmostAlive.unit.elements[0]);
        const finalDamage = Math.floor(damage.baseDamage * leaderMultiplier * elementalMult);
        leftmostAlive.currentHp = Math.max(0, leftmostAlive.currentHp - finalDamage);
      }
    }
  }

  return updatedEnemies;
}

/**
 * Represents a healing instance that can be applied to player units.
 */
export interface HealingInstance {
  amount: number; // Healing amount
  isAoE: boolean; // True if L/T shape match (heals all player units)
}

/**
 * Computes healing instances from Healing element matches.
 * Healing amount = n/3 for line shapes (single target), or n/5 for 'T' and 'L' shapes (aoe)
 * where n is the number of matched tiles.
 *
 * @param matches - Array of matches found in the grid
 * @param comboMultiplier - Optional multiplier from combo count (defaults to 1.0)
 * @returns Array of healing instances ready to be applied
 */
export function computeHealingFromMatches(matches: Match[], comboMultiplier: number = 1.0): HealingInstance[] {
  const healingInstances: HealingInstance[] = [];

  for (const m of matches) {
    const el = m.element as Element;
    if (el !== "Healing") continue;

    const numMatchedTiles = m.cells.length;
    const isAoE = m.shape === "L" || m.shape === "T";

    const healingAmount = (isAoE ? (numMatchedTiles * 2) / 3 : numMatchedTiles) * comboMultiplier;

    if (healingAmount > 0) {
      healingInstances.push({
        amount: healingAmount,
        isAoE,
      });
    }
  }

  return healingInstances;
}

/**
 * Applies healing instances to player units.
 * Single target healing is applied to the rightmost alive player unit.
 * AoE healing is applied to all alive player units.
 *
 * @param healingInstances - Healing instances to apply
 * @param playerUnits - Array of player units to heal (should be sorted by position, left to right)
 * @returns Updated player unit HP values (preserves all unit properties)
 */
export function applyHealingToPlayerUnits<
  T extends { unit: Unit; currentHp: number; maxHp: number; position: number }
>(healingInstances: HealingInstance[], playerUnits: T[]): T[] {
  const updatedUnits = playerUnits.map((u) => ({ ...u }));

  for (const healing of healingInstances) {
    if (healing.isAoE) {
      // AoE: Apply to all alive player units
      for (const unit of updatedUnits) {
        if (unit.currentHp > 0) {
          const hpBefore = unit.currentHp;
          unit.currentHp = Math.min(unit.maxHp, unit.currentHp + healing.amount);
        }
      }
    } else {
      // Single target: Apply to rightmost alive player unit
      const aliveUnits = updatedUnits.filter((u) => u.currentHp > 0);
      const rightmostAlive =
        aliveUnits.length > 0
          ? aliveUnits.reduce((rightmost, current) => (current.position > rightmost.position ? current : rightmost))
          : null;

      if (rightmostAlive) {
        const hpBefore = rightmostAlive.currentHp;
        rightmostAlive.currentHp = Math.min(rightmostAlive.maxHp, rightmostAlive.currentHp + healing.amount);
      }
    }
  }

  return updatedUnits;
}
