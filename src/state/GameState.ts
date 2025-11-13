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
    // Normalize loadout members to fixed tuple format
    let normalizedLoadout: Loadout = { leader: "", members: ["", "", ""] };
    if (initial?.loadout) {
      normalizedLoadout.leader = initial.loadout.leader || "";
      // Migrate from old array format to new tuple format
      if (Array.isArray(initial.loadout.members)) {
        normalizedLoadout.members = [
          initial.loadout.members[0] || "",
          initial.loadout.members[1] || "",
          initial.loadout.members[2] || ""
        ];
      }
    }
    
    this.state = {
      currencies: { gold: 0, plovmand: 0 },
      collection: { cards: {} },
      progression: { discoveredWorlds: {} },
      ...initial,
      loadout: normalizedLoadout, // Override with normalized loadout
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

  addCardToLoadout(cardId: string) {
    const loadout = this.state.loadout;
    
    // If leader slot is empty, fill it
    if (!loadout.leader) {
      loadout.leader = cardId;
      this.save();
      return true;
    }
    
    // Find first empty member slot
    for (let i = 0; i < 3; i++) {
      if (!loadout.members[i]) {
        loadout.members[i] = cardId;
        this.save();
        return true;
      }
    }
    
    // Loadout is full
    return false;
  }

  removeCardFromLoadout(slotIndex: number) {
    const loadout = this.state.loadout;
    
    // Slot 0 is leader, slots 1-3 are members
    if (slotIndex === 0) {
      // Remove leader
      if (loadout.leader) {
        loadout.leader = "";
        this.save();
        return true;
      }
    } else {
      // Remove from members (slotIndex 1-3 maps to tuple index 0-2)
      const memberIndex = slotIndex - 1;
      if (memberIndex >= 0 && memberIndex < 3) {
        if (loadout.members[memberIndex]) {
          loadout.members[memberIndex] = "";
          this.save();
          return true;
        }
      }
    }
    
    return false;
  }
}
