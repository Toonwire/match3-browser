import type { Card, Loadout } from "../data/types";

export interface PlayerCurrencies {
  gold: number;
  plovmand: number;
}

export interface Progression {
  worldStages: Record<string, number>; // worldId -> highest completed stage index (0-based, -1 means world discovered but no stages completed)
  firstTimeCompletions?: string[]; // Array of stage IDs that have been completed for the first time
  introDialogShown?: boolean; // Whether the introductory dialog has been shown
}

export interface Inventory {
  cardCollection: Record<string, number>;
  items: Record<string, number>; // Consumables and other items
}

export interface PersistedState {
  currencies: PlayerCurrencies;
  inventory: Inventory;
  loadout: Loadout;
  progression: Progression;
}

const STORAGE_KEY = "match3_state_v2";

export class GameState {
  private state: PersistedState;

  constructor(initial?: Partial<PersistedState>) {
    if (initial) {
      this.state = { ...initial } as PersistedState;
      // Ensure firstTimeCompletions exists
      if (!this.state.progression.firstTimeCompletions) {
        this.state.progression.firstTimeCompletions = [];
      }
    } else {
      this.state = {
        currencies: { gold: 10, plovmand: 0 },
        inventory: {
          cardCollection: {},
          items: {},
        },
        progression: { worldStages: {}, firstTimeCompletions: [], introDialogShown: false },
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
  get inventory() {
    return this.state.inventory;
  }
  get cardCollection() {
    return this.state.inventory.cardCollection;
  }
  get loadout() {
    return this.state.loadout;
  }
  get progression() {
    return this.state.progression;
  }

  addCardToLoadout(cardId: string) {
    const loadout = this.state.loadout;
    const collection = this.state.inventory.cardCollection;

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
    const collection = this.state.inventory.cardCollection;

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
    const inventory = this.state.inventory;

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

    // Add item to appropriate inventory location
    if (itemType === "card") {
      inventory.cardCollection[itemId] = (inventory.cardCollection[itemId] || 0) + 1;
    } else {
      // Add consumables to items
      inventory.items[itemId] = (inventory.items[itemId] || 0) + 1;
    }

    this.save();
    return true;
  }

  /**
   * Get the highest completed stage index for a world.
   * Returns undefined if world hasn't been discovered yet.
   * Returns -1 if world discovered but no stages completed (stage 0 is unlocked).
   * Returns 0+ for completed stages (0 = stage 0 completed, so stage 1 is unlocked).
   */
  getHighestCompletedStage(worldId: string): number | undefined {
    if (!(worldId in this.state.progression.worldStages)) {
      return undefined; // World not discovered
    }
    return this.state.progression.worldStages[worldId];
  }

  /**
   * Check if a specific stage is unlocked for a world.
   * Stage 0 is always unlocked if the world is discovered.
   * Next stage unlocks after completing the previous one.
   */
  isStageUnlocked(worldId: string, stageIndex: number): boolean {
    const highestCompleted = this.getHighestCompletedStage(worldId);
    if (highestCompleted === undefined) {
      // World not discovered - only stage 0 is available when first entering
      return stageIndex === 0;
    }
    // Stage 0 is always unlocked if world is discovered
    // Next stage unlocks after completing previous one
    return stageIndex <= highestCompleted + 1;
  }

  /**
   * Discover a world (mark as discovered and unlock first stage).
   * Called when entering a world for the first time.
   */
  discoverWorld(worldId: string): void {
    if (!(worldId in this.state.progression.worldStages)) {
      // First time discovering this world - mark as discovered, no stages completed yet
      // The value indicates the highest completed stage
      // (-1 = discovered but none completed, 0+ = highest completed stage index).
      this.state.progression.worldStages[worldId] = -1;
      this.save();
    }
  }

  /**
   * Check if a stage has been completed for the first time.
   */
  isFirstTimeCompletion(stageId: string): boolean {
    const completions = this.state.progression.firstTimeCompletions || [];
    return !completions.includes(stageId);
  }

  /**
   * Mark a stage as completed for the first time.
   */
  markFirstTimeCompletion(stageId: string): void {
    const completions = this.state.progression.firstTimeCompletions || [];
    if (!completions.includes(stageId)) {
      completions.push(stageId);
      this.state.progression.firstTimeCompletions = completions;
      this.save();
    }
  }

  /**
   * Complete a stage, unlocking the next stage.
   * Returns true if successful, false if stage was already completed or invalid.
   */
  completeStage(worldId: string, stageIndex: number): boolean {
    // Can only complete stages that are unlocked
    if (!this.isStageUnlocked(worldId, stageIndex)) {
      return false;
    }

    const currentHighest = this.getHighestCompletedStage(worldId);
    if (currentHighest === undefined) {
      return false; // World not discovered
    }

    // If this stage is higher than current highest, mark it as completed
    if (stageIndex > currentHighest) {
      this.state.progression.worldStages[worldId] = stageIndex;
      this.save();
      return true;
    }

    return false;
  }

  /**
   * Perform a card mutation: remove cards from collection and add result card.
   * Returns true if successful, false if cards are not available or mutation is invalid.
   */
  performMutation(cardIds: string[], resultCardId: string): boolean {
    const collection = this.state.inventory.cardCollection;

    // Count how many of each card we need
    const cardCounts = new Map<string, number>();
    cardIds.forEach((cardId) => {
      cardCounts.set(cardId, (cardCounts.get(cardId) || 0) + 1);
    });

    // Check if all required cards are available in collection
    for (const [cardId, needed] of cardCounts.entries()) {
      const available = collection[cardId] || 0;
      if (available < needed) {
        return false; // Not enough copies of this card
      }
    }

    // Remove cards from collection
    for (const [cardId, needed] of cardCounts.entries()) {
      collection[cardId] = (collection[cardId] || 0) - needed;
      if (collection[cardId] === 0) {
        delete collection[cardId];
      }
    }

    // Add result card to collection
    collection[resultCardId] = (collection[resultCardId] || 0) + 1;

    this.save();
    return true;
  }
}
