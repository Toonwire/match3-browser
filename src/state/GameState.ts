import type { Card, Loadout, WorldDef } from "../data/types";

export interface PlayerCurrencies {
  gold: number;
  plovmand: number;
}

export interface Collection {
  cards: Record<string, Card>; // owned cards by id
}

export interface Progression {
  discoveredWorlds: Record<string, WorldDef>;
}

export interface PersistedState {
  currencies: PlayerCurrencies;
  collection: Collection;
  loadout: Loadout;
  progression: Progression;
  playerHp: number;
}

const STORAGE_KEY = "match3_state_v1";

export class GameState {
  private state: PersistedState;

  constructor(initial?: Partial<PersistedState>) {
    this.state = {
      currencies: { gold: 0, plovmand: 0 },
      collection: { cards: {} },
      loadout: { leader: "", members: [] },
      progression: { discoveredWorlds: {} },
      ...initial,
    } as PersistedState;
  }

  static load(): GameState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return new GameState(JSON.parse(raw));
    } catch {}
    return new GameState();
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {}
  }

  get currencies() {
    return this.state.currencies;
  }
  get collection() {
    return this.state.collection;
  }
  get loadout() {
    return this.state.loadout;
  }
  get progression() {
    return this.state.progression;
  }
}
