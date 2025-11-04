import type { Loadout, Element } from '../data/types';
import type { Match } from './MatchLogic';

export interface DamageInstance {
  element: Element;
  amount: number;
  aoe: boolean;
}

const triangle: Record<Element, Element[]> = {
  Fire: ['Grass'],
  Grass: ['Water'],
  Water: ['Fire'],
  Dark: ['Light'],
  Light: ['Dark'],
  Healing: [],
};

export function elementalMultiplier(attacking: Element, defending?: Element): number {
  if (!defending) return 1;
  if (attacking === 'Dark' && defending === 'Light') return 1.5;
  if (attacking === 'Light' && defending === 'Dark') return 1.5;
  if (triangle[attacking]?.includes(defending)) return 1.5;
  if (triangle[defending]?.includes(attacking)) return 0.75;
  return 1;
}

export function computeDamageFromMatches(matches: Match[], loadout: Loadout, enemyElement?: Element): DamageInstance[] {
  // Tally by element count
  const tally = new Map<Element, { count: number; aoe: boolean }>();
  for (const m of matches) {
    const el = m.element as Element;
    const rec = tally.get(el) ?? { count: 0, aoe: false };
    rec.count += m.cells.length; // 1:1 damage per matched element
    rec.aoe = rec.aoe || (m.shape === 'L' || m.shape === 'T');
    tally.set(el, rec);
  }

  const equippedElements = new Set<Element>();
  if (loadout.leader) equippedElements.add as any; // type placeholder to ensure no crash even if empty
  // We don't have card data here; assume all elements are allowed if mentioned in loadout ids is not resolvable.
  // This will be refined when we wire real card database.

  const out: DamageInstance[] = [];
  for (const [el, { count, aoe }] of tally) {
    // Only allow damage if at least one card has this element – omitted for bootstrap; allow all
    const base = count;
    const multi = elementalMultiplier(el, enemyElement);
    out.push({ element: el, amount: Math.round(base * multi), aoe });
  }
  return out;
}


