import type { Loadout, Element, Unit } from "../data/types";
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
 * Represents a damage instance that can be applied to enemies.
 * The damage calculation is separate from application for flexibility.
 */
export interface DamageInstance {
  element: Element;
  baseDamage: number; // Base damage amount before multipliers
  isAoE: boolean; // True if L/T shape match
  cardIds: string[]; // Cards that contributed to this damage
}

/**
 * Computes damage instances from matches and loadout.
 * This is a pure function that calculates damage without applying it.
 *
 * @param matches - Array of matches found in the grid
 * @param loadout - Player's loadout (leader + members)
 * @param cards - All available cards (needed to check card elements)
 * @returns Array of damage instances ready to be applied
 */
export function computeDamageFromMatches(
  matches: Match[],
  loadout: Loadout,
  cards: Array<{ id: string; elements: Element[]; attack: number }>
): DamageInstance[] {
  // Tally matches by element
  const tally = new Map<Element, { count: number; isAoE: boolean }>();
  for (const m of matches) {
    const el = m.element as Element;
    const rec = tally.get(el) ?? { count: 0, isAoE: false };
    rec.count += m.cells.length; // Total matched tiles
    rec.isAoE = rec.isAoE || m.shape === "L" || m.shape === "T";
    tally.set(el, rec);
  }

  const damageInstances: DamageInstance[] = [];

  // Get all cards in loadout
  const loadoutCardIds = [loadout.leader, ...loadout.members].filter(Boolean);
  const loadoutCards = loadoutCardIds
    .map((id) => cards.find((c) => c.id === id))
    .filter((card): card is { id: string; elements: Element[]; attack: number } => card !== undefined);

  // For each matched element, calculate damage from each card
  for (const [element, matchData] of tally.entries()) {
    const numMatchedTiles = matchData.count;
    const isAoE = matchData.isAoE;
    const minShapeSize = isAoE ? 5 : 3;

    // Find cards that can deal this element's damage
    for (const card of loadoutCards) {
      if (card.elements.includes(element)) {
        // Calculate how much this card contributes
        // If card has multiple elements, it deals fractional damage
        const elementFraction = card.elements.length > 1 ? 0.75 : 1;
        const shapeFraction = numMatchedTiles / minShapeSize;
        const baseDamage = Math.floor(card.attack * elementFraction * shapeFraction);

        if (baseDamage > 0) {
          damageInstances.push({
            element,
            baseDamage,
            isAoE,
            cardIds: [card.id],
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
          const multiplier = elementalMultiplier(damage.element, enemy.unit.elements[0]);
          const finalDamage = Math.floor(damage.baseDamage * multiplier);
          enemy.currentHp = Math.max(0, enemy.currentHp - finalDamage);
        }
      }
    } else {
      // Single target: Apply to leftmost alive enemy
      // Since enemies are sorted by position (left to right), first alive enemy is leftmost
      const leftmostAlive = updatedEnemies.find((e) => e.currentHp > 0);

      if (leftmostAlive && leftmostAlive.unit.elements?.[0]) {
        const multiplier = elementalMultiplier(damage.element, leftmostAlive.unit.elements[0]);
        const finalDamage = Math.floor(damage.baseDamage * multiplier);
        leftmostAlive.currentHp = Math.max(0, leftmostAlive.currentHp - finalDamage);
      }
    }
  }

  return updatedEnemies;
}
