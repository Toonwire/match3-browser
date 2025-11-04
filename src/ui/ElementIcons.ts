import type { Element } from '../data/types';

const map: Record<Element, string> = {
  Fire: '/assets/elements/ic_element_fire.svg',
  Water: '/assets/elements/ic_element_water.svg',
  Grass: '/assets/elements/ic_element_grass.svg',
  Dark: '/assets/elements/ic_element_dark.svg',
  Light: '/assets/elements/ic_element_light.svg',
  Healing: '/assets/elements/ic_element_healing.svg',
};

export function elementIconPath(element: Element): string {
  return map[element];
}


