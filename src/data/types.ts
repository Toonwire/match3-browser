export type Element = "Fire" | "Water" | "Grass" | "Dark" | "Light" | "Healing";

export interface Card {
  id: string;
  name: string;
  rank: number;
  attack: number;
  hp: number;
  elements: Element[];
  imagePath: string;
  leaderPassive?: unknown;
}

export interface Enemy {
  id: string;
  name: string;
  attack: number;
  hp: number;
  element?: Element;
  isBoss: boolean;
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
  difficulty: "Easy" | "Medium" | "Hard";
  primaryElement: Element;
  stages: number;
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
