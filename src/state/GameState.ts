import type { Card, Loadout, WorldDef } from "../data/types";

export interface PlayerCurrencies {
  gold: number;
  plovmand: number;
}

export interface Progression {
  discoveredWorlds: Record<string, WorldDef>;
}

export interface PersistedState {
  currencies: PlayerCurrencies;
  cardCollection: Record<string, number>;
  loadout: Loadout;
  progression: Progression;
}

const STORAGE_KEY = "match3_state_v1";

export class GameState {
  private state: PersistedState;

  constructor(initial?: Partial<PersistedState>) {
    if (initial) {
      this.state = { ...initial } as PersistedState;
    } else {
      this.state = {
        currencies: { gold: 5, plovmand: 0 },
        cardCollection: { card_01_whelp: 1 },
        progression: { discoveredWorlds: {} },
        loadout: { leader: "", members: ["", "", ""] },
      } as PersistedState;
    }
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
  get cardCollection() {
    return this.state.cardCollection;
  }
  get loadout() {
    return this.state.loadout;
  }
  get progression() {
    return this.state.progression;
  }

  addCardToLoadout(cardId: string) {
    const loadout = this.state.loadout;
    const collection = this.state.cardCollection;

    // Check if card is available in collection
    const currentCount = collection[cardId] || 0;
    if (currentCount <= 0) {
      return false; // Card not available
    }

    // If leader slot is empty, fill it
    if (!loadout.leader) {
      loadout.leader = cardId;
      collection[cardId] = currentCount - 1;
      this.save();
      return true;
    }

    // Find first empty member slot
    for (let i = 0; i < 3; i++) {
      if (!loadout.members[i]) {
        loadout.members[i] = cardId;
        collection[cardId] = currentCount - 1;
        this.save();
        return true;
      }
    }

    // Loadout is full
    return false;
  }

  removeCardFromLoadout(slotIndex: number) {
    const loadout = this.state.loadout;
    const collection = this.state.cardCollection;

    // Slot 0 is leader, slots 1-3 are members
    if (slotIndex === 0) {
      // Remove leader
      if (loadout.leader) {
        const cardId = loadout.leader;
        loadout.leader = "";
        // Add card back to collection
        collection[cardId] = (collection[cardId] || 0) + 1;
        this.save();
        return true;
      }
    } else {
      // Remove from members (slotIndex 1-3 maps to tuple index 0-2)
      const memberIndex = slotIndex - 1;
      if (memberIndex >= 0 && memberIndex < 3) {
        if (loadout.members[memberIndex]) {
          const cardId = loadout.members[memberIndex];
          loadout.members[memberIndex] = "";
          // Add card back to collection
          collection[cardId] = (collection[cardId] || 0) + 1;
          this.save();
          return true;
        }
      }
    }

    return false;
  }

  buyItem(
    itemId: string,
    itemType: "card" | "consumable",
    cost: number,
    unit: "gold" | "plovmand",
    stock: number
  ): boolean {
    const currencies = this.state.currencies;
    const collection = this.state.cardCollection;

    // Check if player has enough currency
    if (unit === "gold") {
      if (currencies.gold < cost) {
        return false; // Not enough gold
      }
    } else {
      if (currencies.plovmand < cost) {
        return false; // Not enough plovmand
      }
    }

    // Check stock
    if (stock <= 0) {
      return false; // Out of stock
    }

    // Deduct currency
    if (unit === "gold") {
      currencies.gold -= cost;
    } else {
      currencies.plovmand -= cost;
    }

    // Add item to collection
    if (itemType === "card") {
      collection[itemId] = (collection[itemId] || 0) + 1;
    } else {
      // For consumables, we could add to an inventory system later
      // For now, just track them in collection too
      collection[itemId] = (collection[itemId] || 0) + 1;
    }

    this.save();
    return true;
  }

  // initializeTestCollection(cards: Card[]) {
  //   // Only initialize if collection is empty (fresh state, not loaded from storage)
  //   if (Object.keys(this.state.collection.cards).length === 0) {
  //     // Add starter cards from cards.yaml: whelp, slime, wisp
  //     const starterCardIds = ['01_whelp', '04_slime', '07_wisp'];
  //     for (const cardId of starterCardIds) {
  //       const card = cards.find(c => c.id === cardId);
  //       if (card) {
  //         this.state.collection.cards[cardId] = card;
  //       }
  //     }
  //     this.save();
  //   }
  // }
}
