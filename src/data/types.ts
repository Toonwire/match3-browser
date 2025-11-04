export type Element = 'Fire' | 'Water' | 'Grass' | 'Dark' | 'Light' | 'Healing';

export interface Card {
  id: string;
  name: string;
  rank: number;
  attack: number;
  hp: number;
  elements: Element[];
  leaderPassive?: string;
}

export interface Enemy {
  id: string;
  name: string;
  hp: number;
  element?: Element;
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

export interface WorldDef {
  id: string;
  name: string;
  level: 'Easy' | 'Medium' | 'Hard';
  primaryElement: Element;
  stages: number;
}

export interface Loadout {
  leader: string; // card id
  members: string[]; // card ids
}


