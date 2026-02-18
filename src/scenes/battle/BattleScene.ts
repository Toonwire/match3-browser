import {
  applyDamageToEnemies,
  computeDamageFromMatches,
  computeHealingFromMatches,
  calculateComboMultiplier,
  applyHealingToPlayerUnits,
  elementalMultiplier,
} from "../../battle/Damage";
import { findMatches, type Match } from "../../battle/MatchLogic";
import { resolvePath, loadYaml } from "../../data/loadData";
import { resolveLootConfig } from "../../data/loot";
import type { Card, Element, Item, LootEntry, LootTable, StageDef, Unit, WorldDef } from "../../data/types";
import { AudioManager } from "../../engine/AudioManager";
import { Scene } from "../../engine/Scene";
import { GameState } from "../../state/GameState";
import { elementIconPath } from "../../ui/ElementIcons";
import { BattleLayout, CanvasSize } from "../../ui/Layouts";
import {
  drawPanel,
  drawProgressBar,
  drawText,
  drawTextWithShadow,
  drawTopBar,
  getTopBarButtonRegions,
} from "../../ui/UiPrimitives";
import { renderGuidePanel, type GuidePanelRegions } from "../../ui/GuidePanel";
import { Assets } from "../../engine/Assets";
interface BattleUnit {
  unit: Unit;
  currentHp: number;
  maxHp: number;
  position: number; // 0-3, left to right
}

type CombatLogEntry =
  | {
      type: "damage";
      source: { name: string; isPlayer: boolean; element?: Element };
      target: { name: string; isPlayer: boolean; element?: Element };
      baseDamage: number;
      multiplier: number;
      finalDamage: number;
      isAoE: boolean;
      targetHpAfter: number;
      targetMaxHp: number;
      comboMultiplier?: number;
      comboCount?: number;
    }
  | {
      type: "healing";
      source: { name: string; isPlayer: boolean; element?: Element };
      target: { name: string; isPlayer: boolean; element?: Element };
      amount: number;
      isAoE: boolean;
      targetHpAfter: number;
      targetMaxHp: number;
      comboMultiplier?: number;
      comboCount?: number;
    }
  | {
      type: "separator";
      round: number;
    };

const assets = new Assets();
export class BattleScene extends Scene {
  private stage?: StageDef;
  private world?: WorldDef;
  private cards: Card[] = [];
  private items: Item[] = [];
  private iconCache = new Map<string, HTMLImageElement>();
  private consumableRegions: Array<{ itemId: string; region: { x: number; y: number; w: number; h: number } }> = [];
  private background?: HTMLImageElement;
  private state: GameState = GameState.load();
  private enemies: BattleUnit[] = [];
  private playerUnits: BattleUnit[] = []; // Player loadout units (leader + members)
  private timer: number = 1.0; // 0.0 to 1.0
  private dragTimerDuration = 5.0; // seconds (30.0 for tutorial, 5.0 otherwise)
  private dragTimerRemaining: number = 0.0; // seconds remaining
  private isPlayerTurn: boolean = true;
  private onBackToWorld?: () => void;
  private onBackToBase?: () => void;
  private isDefeated: boolean = false;
  private isVictorious: boolean = false;
  private defeatTriggered: boolean = false;
  private victoryTriggered: boolean = false;
  private readonly panelDelay = 1.5; // seconds delay before showing panels
  private panelDelayTimer: number = 0.0;
  private victoryLoot: Array<{
    type: "gold" | "plovmand" | "card" | "item";
    id: string;
    name: string;
    amount: number;
    imagePath?: string;
  }> = [];
  private defeatPanelRegion: {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null = null;
  private victoryPanelRegion: {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null = null;
  private retreatButtonRegion: {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null = null;
  private grid: (Element | null)[][] = []; // 5x5 grid of elements
  private readonly gridCols = 5;
  private readonly gridRows = 5;
  private dragState: {
    isDragging: boolean;
    startRow: number;
    startCol: number;
    currentRow: number;
    currentCol: number;
    draggedElement: Element | null;
    mouseX: number;
    mouseY: number;
  } | null = null;
  private popAnimations: Map<string, { progress: number; element: Element; comboCount: number; matchIndex: number }> =
    new Map(); // Key: "row,col", Value: { progress, element, comboCount, matchIndex }
  private readonly popAnimationDuration = 0.3; // seconds
  private readonly cascadeDelay = 0.5; // seconds delay before cascade starts
  private cascadeDelayTimer = 0.0; // Current delay timer
  private refillAnimations: Map<string, { progress: number; element: Element }> = new Map(); // Key: "row,col", Value: { progress, element }
  private screenShake: { intensity: number; progress: number; duration: number; seed: number } | null = null; // Screen shake effect
  private readonly refillAnimationDuration = 0.15; // seconds
  private isResolvingMatches = false;
  private readonly turnSwitchDelay = 1.0; // seconds delay between turns
  private turnSwitchDelayTimer = 0.0; // Current turn switch delay timer
  private pendingTurnSwitch: "enemy" | "player" | null = null; // Which turn to switch to after delay
  private pendingMatches: Match[] = [];
  private accumulatedMatches: Match[] = []; // All matches across all cascades in current resolution
  private currentMatchIndex = 0; // Index of the current match being animated
  private soundPlayedForMatchIndex = -1; // Track which match index has had its sound played
  private combatLog: CombatLogEntry[] = [];
  private readonly maxCombatLogEntries = 20; // Maximum number of log entries to keep
  private currentRound: number = 1;
  // Healing animations: Key is unit position, value contains rising icons and glow progress
  private healingAnimations: Map<
    number,
    {
      progress: number;
      icons: Array<{ x: number; y: number; progress: number }>;
      glowProgress: number;
    }
  > = new Map();
  private readonly healingAnimationDuration = 1.0; // seconds
  private readonly healingGlowDuration = 0.5; // seconds for border glow
  // Damage animations: Key is "sourceType:sourcePos->targetType:targetPos", value contains raining icons and glow progress
  // sourceType/targetType: "player" or "enemy"
  private damageAnimations: Map<
    string,
    {
      element: Element;
      sourceX: number;
      sourceY: number;
      targetX: number;
      targetY: number;
      progress: number;
      icons: Array<{ x: number; y: number; progress: number }>;
      targetGlowProgress: number;
      isPlayerSource: boolean;
      targetPosition: number;
      damageAmount: number;
    }
  > = new Map();
  private readonly damageAnimationDuration = 0.8; // seconds
  private readonly damageGlowDuration = 0.4; // seconds for border glow
  // Floating damage numbers: Key is unique ID, value contains position, damage, and animation progress
  private floatingDamageNumbers: Map<
    string,
    {
      x: number;
      y: number;
      damage: number;
      progress: number;
      isPlayerTarget: boolean;
      targetPosition: number;
    }
  > = new Map();
  private readonly floatingDamageDuration = 1.5; // seconds
  private floatingDamageIdCounter = 0;
  // Floating healing numbers: Key is unique ID, value contains position, healing amount, and animation progress
  private floatingHealingNumbers: Map<
    string,
    {
      x: number;
      y: number;
      healing: number;
      progress: number;
      isPlayerTarget: boolean;
      targetPosition: number;
    }
  > = new Map();
  private readonly floatingHealingDuration = 1.5; // seconds
  private floatingHealingIdCounter = 0;
  private showGuide: boolean = false;
  private guidePanelRegions: GuidePanelRegions | null = null;
  private guideScrollOffset: number = 0;
  // Tutorial system
  private isTutorial: boolean = false;
  private tutorialStep: number = -1; // -1 = not in tutorial, 0-4 = tutorial steps (0-3: mechanics, 4: healing)
  private tutorialOverlayImage: HTMLImageElement | null = null;
  private tutorialHighlightRegion: { x: number; y: number; w: number; h: number } | null = null;
  private showTutorialOverlayThisTurn: boolean = false; // Flag to show tutorial overlay only once per player turn

  constructor(
    private worldId: string,
    private stageId: string,
    onBackToWorld?: () => void,
    onBackToBase?: () => void,
  ) {
    super();
    this.onBackToWorld = onBackToWorld;
    this.onBackToBase = onBackToBase;
  }

  async init() {
    try {
      // Load world and stage
      const worlds = await loadYaml<WorldDef[]>("/config/worlds.yaml");
      this.world = worlds.find((w) => w.id === this.worldId);
      if (!this.world) {
        console.error(`World not found: ${this.worldId}`);
        return;
      }

      this.stage = this.world.stages.find((s) => s.id === this.stageId);
      if (!this.stage) {
        console.error(`Stage not found: ${this.stageId}`);
        return;
      }

      // Load background image from stage
      if (this.stage.imagePath) {
        const bg = new Image();
        bg.src = resolvePath(this.stage.imagePath);
        await bg.decode().catch(() => new Promise((res) => (bg.onload = () => res(undefined))));
        this.background = bg;
      }

      // Load cards and items
      this.cards = await loadYaml<Card[]>("/config/cards.yaml");
      this.items = await loadYaml<Item[]>("/config/items.yaml");

      // Initialize enemies from stage units (using cards as base)
      this.enemies = this.stage.units
        .map((stageUnit) => {
          // Find the card that matches the unitId
          const card = this.cards.find((c) => c.id === stageUnit.unitId);
          if (!card) {
            console.error(`Card not found for unitId: ${stageUnit.unitId}`);
            return null;
          }

          // Convert Card to Unit format with stage-specific overrides
          const unit: Unit = {
            id: card.id,
            name: card.name,
            attack: stageUnit.attack ?? card.attack, // Use stage override for attack, or default to card attack
            hp: stageUnit.hp ?? card.hp, // Use stage override for hp, or default to card hp
            elements: card.elements,
            imagePath: card.imagePath,
            // Use stage override for tags, or default to [Enemy]
            tags: stageUnit.tags ?? ["Enemy"],
            // Use stage override for effect, or undefined (cards don't have effects by default)
            effect: stageUnit.effect,
          };

          return {
            unit,
            currentHp: unit.hp,
            maxHp: unit.hp,
            position: stageUnit.position,
          };
        })
        .filter((e): e is BattleUnit => e !== null)
        .sort((a, b) => a.position - b.position); // Sort by position

      // Initialize player units from loadout
      const loadout = this.state.loadout;
      this.playerUnits = [];

      // Add leader (position 0)
      if (loadout.leader) {
        const leaderCard = this.cards.find((c) => c.id === loadout.leader);
        if (leaderCard) {
          const position = 0;
          // Convert Card to Unit format for BattleUnit
          const unit: Unit = {
            id: `${position}_${leaderCard.id}`, // ensure unique id by appending position
            name: leaderCard.name,
            attack: leaderCard.attack,
            hp: leaderCard.hp,
            elements: leaderCard.elements,
            tags: ["Player"],
            imagePath: leaderCard.imagePath,
          };
          this.playerUnits.push({
            unit,
            currentHp: leaderCard.hp,
            maxHp: leaderCard.hp,
            position: position,
          });
        }
      }

      // Add members (positions 1-3)
      loadout.members.forEach((memberId, index) => {
        if (memberId) {
          const memberCard = this.cards.find((c) => c.id === memberId);
          if (memberCard) {
            const position = index + 1;
            // Convert Card to Unit format for BattleUnit
            const unit: Unit = {
              id: `${position}_${memberCard.id}`, // ensure unique id by appending position
              name: memberCard.name,
              attack: memberCard.attack,
              hp: memberCard.hp,
              elements: memberCard.elements,
              tags: ["Player"],
              imagePath: memberCard.imagePath,
            };
            this.playerUnits.push({
              unit,
              currentHp: memberCard.hp,
              maxHp: memberCard.hp,
              position: position,
            });
          }
        }
      });

      // Check if this is the tutorial stage
      this.isTutorial = this.stageId === "world_01_stage_00";
      if (this.isTutorial) {
        this.tutorialStep = 0;
        this.showTutorialOverlayThisTurn = true; // Show tutorial overlay on first player turn
        this.dragTimerDuration = 30.0; // 30 seconds for tutorial
      } else {
        this.tutorialStep = -1;
        this.showTutorialOverlayThisTurn = false;
        this.dragTimerDuration = 5.0; // 5 seconds for normal battles
      }

      // Initialize and populate the match3 grid
      this.initializeGrid();
      if (this.isTutorial) {
        this.populateTutorialGrid();
      } else {
        this.populateGrid();
      }

      // Clear combat log and initialize round
      this.combatLog = [];
      this.currentRound = 1;

      // Add initial round separator
      this.addCombatLogEntry({ type: "separator", round: this.currentRound });
    } catch (error) {
      console.error("Failed to initialize BattleScene:", error);
    }
  }

  update(dt: number): void {
    // Update drag timer
    if (this.dragState?.isDragging && this.dragTimerRemaining > 0) {
      this.dragTimerRemaining -= dt;
      if (this.dragTimerRemaining <= 0) {
        this.dragTimerRemaining = 0;
        // Timer expired, complete the move
        this.completeMove();
      } else {
        // Update timer display (0.0 to 1.0)
        this.timer = this.dragTimerRemaining / this.dragTimerDuration;
      }
    } else if (!this.dragState?.isDragging) {
      // Reset timer to full when not dragging
      this.timer = 1.0;
    }

    // Update cascade delay timer
    if (this.cascadeDelayTimer > 0) {
      this.cascadeDelayTimer -= dt;
      if (this.cascadeDelayTimer <= 0) {
        this.cascadeDelayTimer = 0;
        // Delay complete, proceed with cascade
        this.continueResolvingMatches();
      }
    }

    // Update turn switch delay timer
    if (this.turnSwitchDelayTimer > 0) {
      this.turnSwitchDelayTimer -= dt;
      if (this.turnSwitchDelayTimer <= 0) {
        this.turnSwitchDelayTimer = 0;
        // Delay complete, switch turns
        const pending = this.pendingTurnSwitch;
        this.pendingTurnSwitch = null; // Clear before executing to prevent re-entry
        console.log(`Turn switch delay complete, pending: ${pending}`);
        if (pending === "enemy") {
          this.executeEnemyTurn();
        } else if (pending === "player") {
          this.executePlayerTurnSwitch();
        }
      }
    }

    // Update screen shake
    if (this.screenShake) {
      this.screenShake.progress += dt / this.screenShake.duration;
      if (this.screenShake.progress >= 1.0) {
        this.screenShake = null;
      }
    }

    // Update pop animations
    const keysToRemove: string[] = [];
    const matchesNeedingSound = new Set<number>(); // Track which match indices need sound
    for (const [key, animData] of this.popAnimations.entries()) {
      const oldProgress = animData.progress;
      const newProgress = animData.progress + dt / this.popAnimationDuration;

      // Track when animation reaches halfway point (progress 0.5) - this is when the visual "pop" peaks
      // Only trigger sound for animations that belong to matches that haven't played sound yet
      if (oldProgress < 0.5 && newProgress >= 0.5 && animData.matchIndex !== this.soundPlayedForMatchIndex) {
        matchesNeedingSound.add(animData.matchIndex);
      }

      if (newProgress >= 1.0) {
        keysToRemove.push(key);
      } else {
        this.popAnimations.set(key, {
          progress: newProgress,
          element: animData.element,
          comboCount: animData.comboCount,
          matchIndex: animData.matchIndex,
        });
      }
    }

    // Play sound once per match when it reaches the peak
    for (const matchIndex of matchesNeedingSound) {
      if (matchIndex !== this.soundPlayedForMatchIndex) {
        AudioManager.playSound("match_pop.mp3", { volume: 0.7 });
        this.soundPlayedForMatchIndex = matchIndex;
      }
    }

    // Remove completed animations and continue resolving if needed
    if (keysToRemove.length > 0) {
      for (const key of keysToRemove) {
        this.popAnimations.delete(key);
      }

      // If all animations are done and we're resolving, continue to next match
      if (
        this.popAnimations.size === 0 &&
        this.isResolvingMatches &&
        this.cascadeDelayTimer === 0 &&
        this.refillAnimations.size === 0
      ) {
        this.onCurrentMatchAnimationComplete();
      }
    }

    // Update refill animations
    const refillKeysToRemove: string[] = [];
    for (const [key, animData] of this.refillAnimations.entries()) {
      const newProgress = animData.progress + dt / this.refillAnimationDuration;
      if (newProgress >= 1.0) {
        refillKeysToRemove.push(key);
        // Update grid with final element when animation completes
        const [row, col] = key.split(",").map(Number);
        this.grid[row][col] = animData.element;
      } else {
        this.refillAnimations.set(key, { progress: newProgress, element: animData.element });
      }
    }

    // Remove completed refill animations
    if (refillKeysToRemove.length > 0) {
      for (const key of refillKeysToRemove) {
        this.refillAnimations.delete(key);
      }

      // If all refill animations are done and we're resolving, check for new matches
      // (refill happens after all matches in a round are done, so we should find new matches)
      if (
        this.refillAnimations.size === 0 &&
        this.isResolvingMatches &&
        this.popAnimations.size === 0 &&
        this.cascadeDelayTimer === 0
      ) {
        this.findAndStartNextMatch();
      }
    }

    // Update healing animations
    const healingKeysToRemove: number[] = [];
    for (const [position, animData] of this.healingAnimations.entries()) {
      const newProgress = animData.progress + dt / this.healingAnimationDuration;
      const newGlowProgress = animData.glowProgress + dt / this.healingGlowDuration;

      // Update icon positions and progress
      const updatedIcons = animData.icons.map((icon) => ({
        ...icon,
        progress: icon.progress + dt / this.healingAnimationDuration,
        y: icon.y - dt * 60, // Rise at 60 pixels per second
      }));

      if (newProgress >= 1.0) {
        healingKeysToRemove.push(position);
      } else {
        this.healingAnimations.set(position, {
          progress: newProgress,
          icons: updatedIcons,
          glowProgress: Math.min(1.0, newGlowProgress),
        });
      }
    }

    // Remove completed healing animations
    for (const key of healingKeysToRemove) {
      this.healingAnimations.delete(key);
    }

    // Update damage animations
    const damageKeysToRemove: string[] = [];
    for (const [key, animData] of this.damageAnimations.entries()) {
      const newProgress = animData.progress + dt / this.damageAnimationDuration;
      const newGlowProgress = animData.targetGlowProgress + dt / this.damageGlowDuration;

      // Update icon positions and progress - icons move from source to target
      const updatedIcons = animData.icons.map((icon) => {
        const iconProgress = icon.progress + dt / this.damageAnimationDuration;
        // Calculate position along the path from source to target
        const t = Math.min(1.0, iconProgress);
        const currentX = animData.sourceX + (animData.targetX - animData.sourceX) * t;
        const currentY = animData.sourceY + (animData.targetY - animData.sourceY) * t;

        // Add slight arc/curve to the path
        const arcOffset = Math.sin(t * Math.PI) * 20; // 20 pixel arc height
        const perpX = -(animData.targetY - animData.sourceY);
        const perpY = animData.targetX - animData.sourceX;
        const perpLength = Math.sqrt(perpX * perpX + perpY * perpY);
        const normalizedPerpX = perpLength > 0 ? perpX / perpLength : 0;
        const normalizedPerpY = perpLength > 0 ? perpY / perpLength : 0;

        return {
          x: currentX + normalizedPerpX * arcOffset,
          y: currentY + normalizedPerpY * arcOffset,
          progress: iconProgress,
        };
      });

      if (newProgress >= 1.0) {
        damageKeysToRemove.push(key);
        // Spawn floating damage number when animation completes
        this.spawnFloatingDamageNumber(
          animData.targetX,
          animData.targetY,
          animData.damageAmount,
          !animData.isPlayerSource,
          animData.targetPosition,
        );
      } else {
        this.damageAnimations.set(key, {
          ...animData,
          progress: newProgress,
          icons: updatedIcons,
          targetGlowProgress: Math.min(1.0, newGlowProgress),
        });
      }
    }

    // Remove completed damage animations
    for (const key of damageKeysToRemove) {
      this.damageAnimations.delete(key);
    }

    // Update floating damage numbers
    const floatingDamageKeysToRemove: string[] = [];
    for (const [key, damageData] of this.floatingDamageNumbers.entries()) {
      const newProgress = damageData.progress + dt / this.floatingDamageDuration;
      if (newProgress >= 1.0) {
        floatingDamageKeysToRemove.push(key);
      } else {
        // Move upward and fade out
        this.floatingDamageNumbers.set(key, {
          ...damageData,
          progress: newProgress,
          y: damageData.y - dt * 40, // Move up at 40 pixels per second
        });
      }
    }

    // Remove completed floating damage numbers
    for (const key of floatingDamageKeysToRemove) {
      this.floatingDamageNumbers.delete(key);
    }

    // Update floating healing numbers
    const floatingHealingKeysToRemove: string[] = [];
    for (const [key, healingData] of this.floatingHealingNumbers.entries()) {
      const newProgress = healingData.progress + dt / this.floatingHealingDuration;
      if (newProgress >= 1.0) {
        floatingHealingKeysToRemove.push(key);
      } else {
        // Move upward and fade out
        this.floatingHealingNumbers.set(key, {
          ...healingData,
          progress: newProgress,
          y: healingData.y - dt * 40, // Move up at 40 pixels per second
        });
      }
    }

    // Remove completed floating healing numbers
    for (const key of floatingHealingKeysToRemove) {
      this.floatingHealingNumbers.delete(key);
    }

    // Update panel delay timer
    if (this.panelDelayTimer > 0) {
      this.panelDelayTimer -= dt;
      if (this.panelDelayTimer <= 0) {
        this.panelDelayTimer = 0;
        // Delay complete, show the panel
        if (this.defeatTriggered) {
          this.isDefeated = true;
        }
        if (this.victoryTriggered) {
          this.isVictorious = true;
        }
      }
    }
  }

  private initializeGrid() {
    // Initialize grid as 5x5 array of nulls
    this.grid = [];
    for (let row = 0; row < this.gridRows; row++) {
      this.grid[row] = [];
      for (let col = 0; col < this.gridCols; col++) {
        this.grid[row][col] = null;
      }
    }
  }

  private populateGrid() {
    const elements: Element[] = ["Fire", "Water", "Grass", "Dark", "Light", "Healing"];

    // Iterate through each tile and populate with random element if empty
    for (let row = 0; row < this.gridRows; row++) {
      for (let col = 0; col < this.gridCols; col++) {
        if (this.grid[row][col] === null) {
          // Pick a random element
          const randomIndex = Math.floor(Math.random() * elements.length);
          this.grid[row][col] = elements[randomIndex];
        }
      }
    }
  }

  private populateTutorialGrid() {
    // Get leader element for tutorial grid generation
    const loadout = this.state.loadout;
    const leaderCard = loadout.leader ? this.cards.find((c) => c.id === loadout.leader) : null;
    const leaderElement: Element = leaderCard && leaderCard.elements.length > 0 ? leaderCard.elements[0] : "Fire";

    const elements: Element[] = ["Fire", "Water", "Grass", "Dark", "Light", "Healing"];
    const otherElements = elements.filter((e) => e !== leaderElement);

    // Generate grid based on tutorial step
    if (this.tutorialStep === 0) {
      // Turn 0: Random grid, no specific pattern needed
      for (let row = 0; row < this.gridRows; row++) {
        for (let col = 0; col < this.gridCols; col++) {
          const randomIndex = Math.floor(Math.random() * elements.length);
          this.grid[row][col] = elements[randomIndex];
        }
      }
    } else if (this.tutorialStep === 1) {
      // Turn 1: Create a grid with 2 leader elements in a line and a third one tile away
      // Place two leader elements horizontally at row 2, cols 0 and 1
      this.grid[2][0] = leaderElement;
      this.grid[2][1] = leaderElement;
      // Place the third leader element at row 2, col 3 (one tile away)
      this.grid[2][3] = leaderElement;

      // Fill rest with random other elements
      for (let row = 0; row < this.gridRows; row++) {
        for (let col = 0; col < this.gridCols; col++) {
          if (this.grid[row][col] === null) {
            const randomIndex = Math.floor(Math.random() * otherElements.length);
            this.grid[row][col] = otherElements[randomIndex];
          }
        }
      }
    } else if (this.tutorialStep === 2) {
      // Turn 2: Create an L-shape pattern (two-off L shape)
      // Vertical line: row 0-2, col 1
      this.grid[0][1] = leaderElement;
      this.grid[1][2] = leaderElement;
      this.grid[2][1] = leaderElement;
      // Horizontal line: row 2, cols 1-3 (overlapping at [2][1])
      this.grid[2][2] = leaderElement;
      this.grid[3][3] = leaderElement;

      // Fill rest with random other elements
      for (let row = 0; row < this.gridRows; row++) {
        for (let col = 0; col < this.gridCols; col++) {
          if (this.grid[row][col] === null) {
            const randomIndex = Math.floor(Math.random() * otherElements.length);
            this.grid[row][col] = otherElements[randomIndex];
          }
        }
      }
    } else if (this.tutorialStep === 4) {
      // Turn 4: Create a grid with healing elements to be matched
      this.grid[0][4] = "Healing";
      this.grid[2][1] = "Healing";
      this.grid[3][1] = "Healing";
      this.grid[4][3] = "Healing";

      // Fill rest with random other elements
      for (let row = 0; row < this.gridRows; row++) {
        for (let col = 0; col < this.gridCols; col++) {
          if (this.grid[row][col] === null) {
            const randomIndex = Math.floor(Math.random() * elements.length);
            this.grid[row][col] = elements[randomIndex];
          }
        }
      }
    } else {
      // Default: random grid
      for (let row = 0; row < this.gridRows; row++) {
        for (let col = 0; col < this.gridCols; col++) {
          const randomIndex = Math.floor(Math.random() * elements.length);
          this.grid[row][col] = elements[randomIndex];
        }
      }
    }
  }

  private drawUnitElementIcons(
    ctx: CanvasRenderingContext2D,
    elements: Element[],
    unitX: number,
    unitY: number,
    unitSize: number,
  ) {
    // Draw element icons
    if (elements.length > 0) {
      const elementIconSize = 16;
      const elementIconGap = 2;
      const elementIconStartX = unitX + unitSize - elementIconSize - 4;
      const elementIconStartY = unitY + 4;
      for (let idx = 0; idx < elements.length; idx++) {
        const element = elements[idx];
        const iconPath = elementIconPath(element);
        const elementIconX = elementIconStartX;
        const elementIconY = elementIconStartY + idx * (elementIconSize + elementIconGap);
        this.drawIcon(ctx, iconPath, elementIconX, elementIconY, elementIconSize, elementIconSize);
      }
    }
  }

  private getElementColor(element: Element): string {
    const colorMap: Record<Element, string> = {
      Fire: "#ef4444", // Red
      Water: "#3b82f6", // Blue
      Grass: "#10b981", // Green
      Dark: "#7c3aed", // Purple
      Light: "#fbbf24", // Yellow/Gold
      Healing: "#34d399", // Teal/Green for healing
    };
    return colorMap[element] || "#9aa3b2";
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Apply screen shake offset
    let shakeOffsetX = 0;
    let shakeOffsetY = 0;
    if (this.screenShake) {
      const shakeProgress = this.screenShake.progress;
      const shakeAmount = this.screenShake.intensity * (1.0 - shakeProgress); // Decay over time
      // Use noise-like function for smoother shake
      const time = this.screenShake.seed + shakeProgress * 20;
      shakeOffsetX = (Math.sin(time * 2.3) + Math.cos(time * 1.7)) * shakeAmount * 0.5;
      shakeOffsetY = (Math.sin(time * 1.9) + Math.cos(time * 2.1)) * shakeAmount * 0.5;
    }

    ctx.save();
    ctx.translate(shakeOffsetX, shakeOffsetY);

    // Background
    ctx.fillStyle = "#0f1014";
    ctx.fillRect(0, 0, CanvasSize.width, CanvasSize.height);

    // Draw stage background image if available
    if (this.background) {
      ctx.drawImage(this.background, 0, 0, CanvasSize.width, CanvasSize.height);
      // Add a semi-transparent dark overlay to improve text readability
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillRect(0, 0, CanvasSize.width, CanvasSize.height);
    }

    // Top bar
    drawTopBar(ctx, CanvasSize.width, this.state, this.cards, (iconPath, x, y, w, h) =>
      this.drawIcon(ctx, iconPath, x, y, w, h),
    );

    if (!this.stage) {
      drawText(ctx, "Stage not found", 50, 100);
      return;
    }

    const topBarHeight = 36;

    // Draw player loadout units (leader + members, left to right)
    const playerUnitArea = BattleLayout.playerUnits;
    const playerUnitSlotWidth = playerUnitArea.w / 4; // 4 slots: leader + 3 members
    const playerUnitSize = 96;
    const playerUnitGap = 12;

    const loadout = this.state.loadout;
    const loadoutCardIds = [loadout.leader, ...loadout.members];
    const loadoutCardsWithPosition = loadoutCardIds
      .map((id, slotIndex) => {
        const card = id ? this.cards.find((c) => c.id === id) : null;
        return card ? { card, slotIndex } : null;
      })
      .filter((item): item is { card: Card; slotIndex: number } => item !== null);

    loadoutCardsWithPosition.forEach(({ card, slotIndex }) => {
      const slotX = playerUnitArea.x + slotIndex * playerUnitSlotWidth;
      const unitX = slotX + (playerUnitSlotWidth - playerUnitSize) / 2;
      const unitY = playerUnitArea.y + (playerUnitArea.h - playerUnitSize) / 2;

      // Find the corresponding player unit to check if it's dead
      const playerUnit = this.playerUnits.find((unit) => unit.position === slotIndex);
      const isDead = playerUnit ? playerUnit.currentHp <= 0 : false;

      // Draw card image with desaturation if dead
      if (card.imagePath) {
        this.drawIcon(ctx, card.imagePath, unitX, unitY, playerUnitSize, playerUnitSize, isDead);
      }

      // Draw element icon overlay (small, top-right)
      this.drawUnitElementIcons(ctx, card.elements, unitX, unitY, playerUnitSize);

      // Draw healing border glow if unit is being healed
      const healingAnim = this.healingAnimations.get(slotIndex);
      if (healingAnim) {
        const glowAlpha =
          healingAnim.glowProgress < 0.5
            ? healingAnim.glowProgress * 2 // 0 to 1
            : 1.0 - (healingAnim.glowProgress - 0.5) * 2; // 1 to 0
        const healingColor = this.getElementColor("Healing");

        ctx.save();
        ctx.globalAlpha = glowAlpha * 0.8;
        ctx.strokeStyle = healingColor;
        ctx.lineWidth = 4;
        ctx.strokeRect(unitX - 2, unitY - 2, playerUnitSize + 4, playerUnitSize + 4);

        // Add outer glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = healingColor;
        ctx.strokeRect(unitX - 2, unitY - 2, playerUnitSize + 4, playerUnitSize + 4);
        ctx.restore();
      }

      // Draw damage border glow if unit is being damaged
      for (const [key, animData] of this.damageAnimations.entries()) {
        if (!animData.isPlayerSource && animData.targetPosition === slotIndex) {
          const glowAlpha =
            animData.targetGlowProgress < 0.5
              ? animData.targetGlowProgress * 2 // 0 to 1
              : 1.0 - (animData.targetGlowProgress - 0.5) * 2; // 1 to 0
          const damageColor = this.getElementColor(animData.element);

          ctx.save();
          ctx.globalAlpha = glowAlpha * 0.8;
          ctx.strokeStyle = damageColor;
          ctx.lineWidth = 4;
          ctx.strokeRect(unitX - 2, unitY - 2, playerUnitSize + 4, playerUnitSize + 4);

          // Add outer glow effect
          ctx.shadowBlur = 10;
          ctx.shadowColor = damageColor;
          ctx.strokeRect(unitX - 2, unitY - 2, playerUnitSize + 4, playerUnitSize + 4);
          ctx.restore();
        }
      }

      // Draw "Leader" text above leader slot
      if (slotIndex === 0) {
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        drawTextWithShadow(ctx, "Leader", unitX + playerUnitSize / 2, unitY - 12, 12, "#9aa3b2");
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }
    });

    // Draw healing animation icons (rising and fading)
    for (const [position, animData] of this.healingAnimations.entries()) {
      const healingIconPath = elementIconPath("Healing");
      const iconSize = 24;

      for (const icon of animData.icons) {
        if (icon.progress < 1.0) {
          // Calculate opacity: fade out as progress increases
          const opacity =
            icon.progress < 0.5
              ? 1.0 - icon.progress * 2 // 1.0 to 0.0
              : 0.0; // Fully faded after halfway

          // Calculate scale: slightly grow then shrink
          const scale =
            icon.progress < 0.3
              ? 0.5 + (icon.progress / 0.3) * 0.5 // 0.5 to 1.0
              : 1.0 - ((icon.progress - 0.3) / 0.7) * 0.3; // 1.0 to 0.7

          ctx.save();
          ctx.globalAlpha = opacity;
          ctx.translate(icon.x, icon.y);
          ctx.scale(scale, scale);
          this.drawIcon(ctx, healingIconPath, -iconSize / 2, -iconSize / 2, iconSize, iconSize);
          ctx.restore();
        }
      }
    }

    // Draw player unit HP bars
    const playerUnitHpArea = BattleLayout.playerUnitHp;
    const playerUnitHpSlotWidth = playerUnitHpArea.w / 4;
    const playerUnitHpBarHeight = 20;
    const playerUnitHpBarWidth = playerUnitHpSlotWidth - playerUnitGap * 2;

    // Render HP bars for all 4 slots (including empty ones)
    for (let slotIndex = 0; slotIndex < 4; slotIndex++) {
      const slotX = playerUnitHpArea.x + slotIndex * playerUnitHpSlotWidth;
      const hpBarX = slotX + playerUnitGap;
      const hpBarY = playerUnitHpArea.y + (playerUnitHpArea.h - playerUnitHpBarHeight) / 2;

      // Find player unit at this position
      const playerUnit = this.playerUnits.find((unit) => unit.position === slotIndex);

      // Get card for this slot
      const cardId = slotIndex === 0 ? loadout.leader : loadout.members[slotIndex - 1];
      const card = cardId ? this.cards.find((c) => c.id === cardId) : null;

      if (!card || !playerUnit) {
        // Empty slot or no unit, skip rendering
        continue;
      }

      const currentHp = playerUnit.currentHp;
      const maxHp = playerUnit.maxHp;
      const hpRatio = maxHp > 0 ? currentHp / maxHp : 0;

      drawProgressBar(ctx, hpBarX, hpBarY, playerUnitHpBarWidth, playerUnitHpBarHeight, hpRatio, "#10b981", "#23262d");

      // Draw HP text
      const hpText = `${currentHp}/${maxHp}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      drawTextWithShadow(
        ctx,
        hpText,
        hpBarX + playerUnitHpBarWidth / 2,
        hpBarY + playerUnitHpBarHeight / 2,
        12,
        "#e5e7eb",
      );
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }

    // Draw enemies (1-4, left to right)
    const enemyArea = BattleLayout.enemies;
    const enemySlotWidth = enemyArea.w / 4; // 4 slots max
    const enemySize = 96; // Increased from 64 to 96 for larger enemies
    const enemyGap = 12; // Increased gap for better spacing

    this.enemies.forEach((enemy) => {
      const slotX = enemyArea.x + enemy.position * enemySlotWidth;
      const enemyX = slotX + (enemySlotWidth - enemySize) / 2;
      const enemyY = enemyArea.y + (enemyArea.h - enemySize) / 2;

      // Draw enemy background
      ctx.fillStyle = "#23262d";
      ctx.fillRect(enemyX, enemyY, enemySize, enemySize);
      ctx.strokeStyle = "#2b2f3a";
      ctx.strokeRect(enemyX + 0.5, enemyY + 0.5, enemySize - 1, enemySize - 1);

      // Draw enemy image with desaturation if dead
      if (enemy.unit.imagePath) {
        this.drawIcon(ctx, enemy.unit.imagePath, enemyX, enemyY, enemySize, enemySize, enemy.currentHp <= 0);
      }

      // Draw element icon overlay (small, top-right)
      this.drawUnitElementIcons(ctx, enemy.unit.elements || [], enemyX, enemyY, enemySize);

      // Draw damage border glow if enemy is being damaged
      for (const [key, animData] of this.damageAnimations.entries()) {
        if (animData.isPlayerSource && animData.targetPosition === enemy.position) {
          const glowAlpha =
            animData.targetGlowProgress < 0.5
              ? animData.targetGlowProgress * 2 // 0 to 1
              : 1.0 - (animData.targetGlowProgress - 0.5) * 2; // 1 to 0
          const damageColor = this.getElementColor(animData.element);

          ctx.save();
          ctx.globalAlpha = glowAlpha * 0.8;
          ctx.strokeStyle = damageColor;
          ctx.lineWidth = 4;
          ctx.strokeRect(enemyX - 2, enemyY - 2, enemySize + 4, enemySize + 4);

          // Add outer glow effect
          ctx.shadowBlur = 10;
          ctx.shadowColor = damageColor;
          ctx.strokeRect(enemyX - 2, enemyY - 2, enemySize + 4, enemySize + 4);
          ctx.restore();
        }
      }

      // Boss indicator
      if (enemy.unit.tags.includes("Boss")) {
        drawTextWithShadow(ctx, "BOSS", enemyX, enemyY - 4, 14, "#ef4444");
      }
    });

    // Draw enemy HP bars
    const enemyHpArea = BattleLayout.enemyHp;
    const enemyHpSlotWidth = enemyHpArea.w / 4;
    const enemyHpBarHeight = 20; // Increased from 16 to 20 for better visibility
    const enemyHpBarWidth = enemyHpSlotWidth - enemyGap * 2;

    this.enemies.forEach((enemy) => {
      const slotX = enemyHpArea.x + enemy.position * enemyHpSlotWidth;
      const hpBarX = slotX + enemyGap;
      const hpBarY = enemyHpArea.y + (enemyHpArea.h - enemyHpBarHeight) / 2;
      const hpRatio = enemy.currentHp / enemy.maxHp;

      drawProgressBar(ctx, hpBarX, hpBarY, enemyHpBarWidth, enemyHpBarHeight, hpRatio, "#ef4444", "#23262d");

      // Draw HP text
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      drawTextWithShadow(
        ctx,
        `${enemy.currentHp}/${enemy.maxHp}`,
        hpBarX + enemyHpBarWidth / 2,
        hpBarY + enemyHpBarHeight / 2,
        12,
        "#e5e7eb",
      );
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    });

    // Draw attacker icon indicator - positioned between player units and enemy units
    const attackerIconSize = 64;
    // Calculate center position between player units (ends at x: 576) and enemy area (starts at x: 704)
    const centerX = (playerUnitArea.x + playerUnitArea.w + enemyArea.x) / 2;
    const centerY = playerUnitArea.y + playerUnitArea.h / 2;
    // Position icon so it's centered (drawAttackerIcon centers at x + size/2, y + size/2)
    const attackerIconX = centerX - attackerIconSize / 2 + attackerIconSize / 2;
    const attackerIconY = centerY - attackerIconSize / 2 + attackerIconSize / 2;

    // Draw icon with arrow pointing based on whose turn it is
    ctx.fillStyle = "#e5e7eb";
    ctx.font = `${attackerIconSize}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const text = "⚔";
    drawTextWithShadow(ctx, text, attackerIconX, attackerIconY, attackerIconSize, "#9aa3b2");
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    // Draw timer bar
    const timerArea = BattleLayout.timer;
    drawProgressBar(ctx, timerArea.x, timerArea.y, timerArea.w, timerArea.h, this.timer, "#3b82f6", "#23262d");

    const timerText = "⧗";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    drawTextWithShadow(ctx, timerText, timerArea.x + timerArea.w + 12, timerArea.y + timerArea.h / 2, 16, "#e5e7eb");
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    // Draw 5x5 match3 grid
    const gridArea = BattleLayout.grid;
    const cellGap = 6; // Increased from 4 to 6 for better spacing with larger grid
    const cellSize = Math.min(
      (gridArea.w - (this.gridCols - 1) * cellGap) / this.gridCols,
      (gridArea.h - (this.gridRows - 1) * cellGap) / this.gridRows,
    );

    // Calculate total grid width and height
    const totalGridWidth = this.gridCols * cellSize + (this.gridCols - 1) * cellGap;
    const totalGridHeight = this.gridRows * cellSize + (this.gridRows - 1) * cellGap;

    // Calculate offsets to center the grid
    const gridOffsetX = (gridArea.w - totalGridWidth) / 2;
    const gridOffsetY = (gridArea.h - totalGridHeight) / 2;

    // Draw grid background with 50% transparency to show stage background
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#1a1d24";
    ctx.fillRect(gridArea.x, gridArea.y, gridArea.w, gridArea.h);
    ctx.strokeStyle = "#2b2f3a";
    ctx.strokeRect(gridArea.x + 0.5, gridArea.y + 0.5, gridArea.w - 1, gridArea.h - 1);
    ctx.restore();

    // Draw grid cells with element icons (fully opaque)
    for (let row = 0; row < this.gridRows; row++) {
      for (let col = 0; col < this.gridCols; col++) {
        const cellX = gridArea.x + gridOffsetX + col * (cellSize + cellGap);
        const cellY = gridArea.y + gridOffsetY + row * (cellSize + cellGap);

        let baseColor = "#23262d"; // Calculate background brightness for adjacent tiles during drag
        // Draw cell background with brightness based on proximity
        let backgroundBrightness = 0.0; // 0.0 = normal, 1.0 = maximum brightness
        if (this.dragState?.isDragging && this.stage?.enableSwapHighlight === true) {
          // Don't highlight the start position or the current empty space position
          const isCurrentPosition = row === this.dragState.currentRow && col === this.dragState.currentCol;

          if (!isCurrentPosition) {
            const isAdjacent = this.isAdjacentToCurrentPosition(row, col);
            if (isAdjacent) {
              baseColor = "#032117";
              // Calculate distance from mouse to closest edge/point on the tile
              // Clamp mouse coordinates to tile bounds to find the closest point on the tile
              const closestX = Math.max(cellX, Math.min(cellX + cellSize, this.dragState.mouseX));
              const closestY = Math.max(cellY, Math.min(cellY + cellSize, this.dragState.mouseY));
              const dx = this.dragState.mouseX - closestX;
              const dy = this.dragState.mouseY - closestY;
              const distance = Math.sqrt(dx * dx + dy * dy);

              // Maximum distance for full brightness (half the diagonal of a cell)
              const maxDistance = cellSize * 1.5;
              // Closer = brighter, further = darker
              const proximity = Math.max(0, 1.0 - distance / maxDistance);
              // Apply smooth curve for better visual feedback
              backgroundBrightness = proximity * proximity; // Quadratic easing for smoother transition
            }
          }
        }

        // Draw cell background with brightness based on proximity
        if (backgroundBrightness > 0) {
          // Interpolate between base color and lighter color
          const lightColor = "#69f207"; // Lighter version of base color
          ctx.fillStyle = this.interpolateColor(baseColor, lightColor, backgroundBrightness);
        } else {
          ctx.fillStyle = baseColor;
        }
        ctx.fillRect(cellX, cellY, cellSize, cellSize);
        ctx.strokeStyle = "#2b2f3a";
        ctx.strokeRect(cellX + 0.5, cellY + 0.5, cellSize - 1, cellSize - 1);

        // Skip drawing element at the current position if dragging (empty space follows the dragged element)
        const isEmptySpace =
          this.dragState?.isDragging && this.dragState.currentRow === row && this.dragState.currentCol === col;

        // Draw element icon if tile has an element and it's not the empty space
        if (!isEmptySpace) {
          const animationKey = `${row},${col}`;
          const popAnimData = this.popAnimations.get(animationKey);
          const refillAnimData = this.refillAnimations.get(animationKey);

          if (popAnimData !== undefined) {
            // Draw pop animation (tile is already cleared from grid, but we render the animation)
            ctx.save();

            // Calculate combo intensity (0 = no combo, 1 = max intensity)
            const comboCount = popAnimData.comboCount;
            const comboIntensity = Math.min(1.0, (comboCount - 1) / 4.0); // Max intensity at 5+ combos

            // Calculate animation values
            // Scale: goes from 1.0 to 1.3 (or more for combos) then back to 1.0
            const scalePhase =
              popAnimData.progress < 0.5
                ? popAnimData.progress * 2 // 0 to 1
                : 1 - (popAnimData.progress - 0.5) * 2; // 1 to 0

            // Base scale + combo intensity scaling
            const baseScale = 1.0 + scalePhase * 0.3;
            const comboScaleBoost = comboIntensity * scalePhase * 0.4; // Up to 0.4 extra scale for high combos
            const scale = baseScale + comboScaleBoost;

            // Rotation for combos (more rotation = higher combo)
            const rotation = comboIntensity * scalePhase * Math.PI * 0.3; // Up to ~54 degrees for high combos

            // Opacity: fades out in the second half
            const opacity = popAnimData.progress < 0.5 ? 1.0 : 1.0 - (popAnimData.progress - 0.5) * 2;

            // Apply transformations
            const centerX = cellX + cellSize / 2;
            const centerY = cellY + cellSize / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate(rotation);
            ctx.scale(scale, scale);
            ctx.globalAlpha = opacity;

            // Draw glow effect for combos
            if (comboIntensity > 0) {
              ctx.save();
              const glowSize = cellSize * (1.0 + comboIntensity * 0.8);
              const glowAlpha = comboIntensity * opacity * 0.6;
              ctx.globalAlpha = glowAlpha;

              // Create radial gradient for glow
              const gradient = ctx.createRadialGradient(0, 0, cellSize * 0.3, 0, 0, glowSize / 2);
              gradient.addColorStop(0, this.getElementColor(popAnimData.element));
              gradient.addColorStop(0.5, this.getElementColor(popAnimData.element) + "80");
              gradient.addColorStop(1, this.getElementColor(popAnimData.element) + "00");

              ctx.fillStyle = gradient;
              ctx.beginPath();
              ctx.arc(0, 0, glowSize / 2, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }

            // Draw particles/sparkles for combos
            if (comboIntensity > 0 && popAnimData.progress < 0.7) {
              ctx.save();
              const particleCount = Math.floor(comboIntensity * 8 + 2); // 2-10 particles
              const particleAlpha = comboIntensity * opacity * 0.8;
              ctx.globalAlpha = particleAlpha;
              ctx.fillStyle = "#ffffff";

              for (let i = 0; i < particleCount; i++) {
                const angle = (i / particleCount) * Math.PI * 2 + popAnimData.progress * Math.PI * 2;
                const distance = cellSize * 0.4 * (1 + popAnimData.progress * 0.5);
                const particleX = Math.cos(angle) * distance;
                const particleY = Math.sin(angle) * distance;
                const particleSize = 2 + comboIntensity * 3;

                ctx.beginPath();
                ctx.arc(particleX, particleY, particleSize, 0, Math.PI * 2);
                ctx.fill();
              }
              ctx.restore();
            }

            // Draw the icon
            const iconPath = elementIconPath(popAnimData.element);
            const iconSize = cellSize * 1.0;
            const iconX = -iconSize / 2;
            const iconY = -iconSize / 2;
            this.drawIcon(ctx, iconPath, iconX, iconY, iconSize, iconSize);

            ctx.restore();
          } else if (refillAnimData !== undefined) {
            // Draw refill animation - tile grows from 0 to full size
            ctx.save();

            // Scale grows from 0 to 1
            const scale = refillAnimData.progress;

            // Apply transformations
            const centerX = cellX + cellSize / 2;
            const centerY = cellY + cellSize / 2;
            ctx.translate(centerX, centerY);
            ctx.scale(scale, scale);

            const iconPath = elementIconPath(refillAnimData.element);
            const iconSize = cellSize * 1.0;
            const iconX = -iconSize / 2;
            const iconY = -iconSize / 2;
            this.drawIcon(ctx, iconPath, iconX, iconY, iconSize, iconSize);

            ctx.restore();
          } else {
            // Normal rendering without animation
            const element = this.grid[row]?.[col];
            if (element) {
              const iconPath = elementIconPath(element);
              const iconSize = cellSize * 1.0;
              const iconX = cellX + (cellSize - iconSize) / 2;
              const iconY = cellY + (cellSize - iconSize) / 2;
              this.drawIcon(ctx, iconPath, iconX, iconY, iconSize, iconSize);
            }
          }
        }
      }
    }

    // Draw dragged element icon above the grid with transparency
    if (this.dragState?.isDragging && this.dragState.draggedElement) {
      const { clampedX, clampedY } = this.clampToGridBounds(this.dragState.mouseX, this.dragState.mouseY);

      // Calculate cell size for icon
      const gridArea = BattleLayout.grid;
      const cellGap = 6;
      const cellSize = Math.min(
        (gridArea.w - (this.gridCols - 1) * cellGap) / this.gridCols,
        (gridArea.h - (this.gridRows - 1) * cellGap) / this.gridRows,
      );

      // Draw only the icon at clamped position with transparency
      ctx.save();
      ctx.globalAlpha = 0.7; // 70% opacity
      const iconPath = elementIconPath(this.dragState.draggedElement);
      const iconSize = cellSize * 1.0;
      const iconX = clampedX - iconSize / 2;
      const iconY = clampedY - iconSize / 2;
      this.drawIcon(ctx, iconPath, iconX, iconY, iconSize, iconSize);
      ctx.restore();
    }

    // Draw consumables to the left of the grid
    this.renderConsumables(ctx);

    // Draw turn indicator
    const turnText = this.isPlayerTurn ? "Your Turn" : "Enemy Turn";
    const turnColor = this.isPlayerTurn ? "#3b82f6" : "#ef4444";
    drawTextWithShadow(ctx, turnText, 24, topBarHeight + 24, 18, turnColor);

    // Draw combat log
    this.renderCombatLog(ctx);

    // Draw tutorial overlay if in tutorial mode (only when not dragging to avoid blocking)
    // Rendered after combat log so it appears on top
    if (this.showTutorialOverlayThisTurn) {
      this.renderTutorialOverlay(ctx);
    }

    // Draw retreat button
    const retreatButtonX = CanvasSize.width - 120; // Adjusted for larger button
    const retreatButtonY = topBarHeight + 12;
    const retreatButtonW = 100; // Increased from 80 to 100
    const retreatButtonH = 36; // Increased from 30 to 36
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(retreatButtonX, retreatButtonY, retreatButtonW, retreatButtonH);
    ctx.strokeStyle = "#991b1b";
    ctx.strokeRect(retreatButtonX + 0.5, retreatButtonY + 0.5, retreatButtonW - 1, retreatButtonH - 1);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    drawTextWithShadow(
      ctx,
      "Retreat",
      retreatButtonX + retreatButtonW / 2,
      retreatButtonY + retreatButtonH / 2,
      16,
      "#ffffff",
    );
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    this.retreatButtonRegion = {
      x: retreatButtonX,
      y: retreatButtonY,
      w: retreatButtonW,
      h: retreatButtonH,
    };

    // Draw defeat panel if defeated
    if (this.isDefeated) {
      this.renderDefeatPanel(ctx);
    }

    // Draw victory panel if victorious
    if (this.isVictorious) {
      this.renderVictoryPanel(ctx);
    }

    // Draw tutorial panel if shown
    if (this.showGuide) {
      this.guidePanelRegions = renderGuidePanel(ctx, this.guideScrollOffset, (iconPath, x, y, w, h) =>
        this.drawIcon(ctx, iconPath, x, y, w, h),
      );
    }

    // Draw damage animation icons (raining from source to target) - render last so they appear on top
    for (const [key, animData] of this.damageAnimations.entries()) {
      const damageIconPath = elementIconPath(animData.element);
      const iconSize = 20;

      for (const icon of animData.icons) {
        if (icon.progress < 1.0) {
          // Calculate opacity: fade in then fade out
          const opacity =
            icon.progress < 0.2
              ? icon.progress * 5 // 0 to 1.0
              : icon.progress < 0.7
                ? 1.0 // Full opacity
                : 1.0 - (icon.progress - 0.7) / 0.3; // 1.0 to 0.0

          // Calculate scale: slightly grow then maintain
          const scale =
            icon.progress < 0.2
              ? 0.6 + (icon.progress / 0.2) * 0.4 // 0.6 to 1.0
              : 1.0;

          ctx.save();
          ctx.globalAlpha = opacity;
          ctx.translate(icon.x, icon.y);
          ctx.scale(scale, scale);
          this.drawIcon(ctx, damageIconPath, -iconSize / 2, -iconSize / 2, iconSize, iconSize);
          ctx.restore();
        }
      }
    }

    // Draw floating damage numbers - render after damage icons so they appear on top
    for (const [key, damageData] of this.floatingDamageNumbers.entries()) {
      // Calculate opacity: fade out as progress increases
      const opacity = 1.0 - damageData.progress;

      // Calculate font size based on damage amount
      // Scale from 16px (min) to 32px (max) based on damage
      // Assuming damage range of 1-100, adjust as needed
      const minDamage = 1;
      const maxDamage = 100;
      const minFontSize = 16;
      const maxFontSize = 68;
      const normalizedDamage = Math.max(minDamage, Math.min(maxDamage, damageData.damage));
      const damageRatio = (normalizedDamage - minDamage) / (maxDamage - minDamage);
      const fontSize = minFontSize + damageRatio * (maxFontSize - minFontSize);

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `bold ${fontSize}px system-ui`;
      ctx.fillStyle = "#ef4444"; // Red color for damage
      ctx.strokeStyle = "#991b1b"; // Darker red for outline
      ctx.lineWidth = 2;

      const damageText = `-${damageData.damage}`;
      // Draw outline
      ctx.strokeText(damageText, damageData.x, damageData.y);
      // Draw fill
      ctx.fillText(damageText, damageData.x, damageData.y);
      ctx.restore();
    }

    // Draw floating healing numbers - render after damage numbers so they appear on top
    for (const [key, healingData] of this.floatingHealingNumbers.entries()) {
      // Calculate opacity: fade out as progress increases
      const opacity = 1.0 - healingData.progress;

      // Calculate font size based on healing amount
      // Scale from 16px (min) to 32px (max) based on healing
      // Assuming healing range of 1-100, adjust as needed
      const minHealing = 1;
      const maxHealing = 100;
      const minFontSize = 16;
      const maxFontSize = 68;
      const normalizedHealing = Math.max(minHealing, Math.min(maxHealing, healingData.healing));
      const healingRatio = (normalizedHealing - minHealing) / (maxHealing - minHealing);
      const fontSize = minFontSize + healingRatio * (maxFontSize - minFontSize);

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `bold ${fontSize}px system-ui`;
      ctx.fillStyle = "#10b981"; // Green color for healing
      ctx.strokeStyle = "#047857"; // Darker green for outline
      ctx.lineWidth = 2;

      const healingText = `+${healingData.healing}`;
      // Draw outline
      ctx.strokeText(healingText, healingData.x, healingData.y);
      // Draw fill
      ctx.fillText(healingText, healingData.x, healingData.y);
      ctx.restore();
    }
  }

  private renderDefeatPanel(ctx: CanvasRenderingContext2D): void {
    // Dim background
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, CanvasSize.width, CanvasSize.height);

    // Panel dimensions
    const panelWidth = 400;
    const panelHeight = 200;
    const panelX = (CanvasSize.width - panelWidth) / 2;
    const panelY = (CanvasSize.height - panelHeight) / 2;

    // Draw panel
    drawPanel(ctx, panelX, panelY, panelWidth, panelHeight, "Defeat");

    // Draw defeat message
    ctx.fillStyle = "#ef4444";
    ctx.font = "24px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Defeat", panelX + panelWidth / 2, panelY + 60);

    // Draw instruction text
    ctx.fillStyle = "#9aa3b2";
    ctx.font = "16px system-ui";
    ctx.fillText("All your units have been defeated.", panelX + panelWidth / 2, panelY + 100);
    ctx.fillText("Click to return to base.", panelX + panelWidth / 2, panelY + 130);

    // Store panel region for click detection
    this.defeatPanelRegion = {
      x: panelX,
      y: panelY,
      w: panelWidth,
      h: panelHeight,
    };

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  private renderVictoryPanel(ctx: CanvasRenderingContext2D): void {
    // Dim background
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, CanvasSize.width, CanvasSize.height);

    // Panel dimensions (larger to fit loot)
    const panelWidth = 500;
    const panelHeight = Math.max(300, 200 + this.victoryLoot.length * 40);
    const panelX = (CanvasSize.width - panelWidth) / 2;
    const panelY = (CanvasSize.height - panelHeight) / 2;

    // Draw panel
    drawPanel(ctx, panelX, panelY, panelWidth, panelHeight, "Victory");

    // Draw victory message
    ctx.fillStyle = "#10b981";
    ctx.font = "24px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Victory!", panelX + panelWidth / 2, panelY + 50);

    // Draw loot section
    if (this.victoryLoot.length > 0) {
      ctx.fillStyle = "#9aa3b2";
      ctx.font = "16px system-ui";
      ctx.fillText("Loot:", panelX + panelWidth / 2, panelY + 90);

      // Draw each loot item
      let lootY = panelY + 120;
      const lootItemHeight = 35;
      const iconSize = 24;
      const iconGap = 8;

      for (const loot of this.victoryLoot) {
        // Draw icon if available
        if (loot.imagePath) {
          this.drawIcon(ctx, loot.imagePath, panelX + 30, lootY - iconSize + 2, iconSize, iconSize);
        }

        // Draw loot text
        ctx.fillStyle = "#e5e7eb";
        ctx.font = "14px system-ui";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const lootText = loot.amount > 0 ? `${loot.name} x${loot.amount}` : loot.name;
        const textX = panelX + (loot.imagePath ? 30 + iconSize + iconGap : 30);
        ctx.fillText(lootText, textX, lootY);

        // Draw type indicator
        ctx.fillStyle = "#6b7280";
        ctx.font = "12px system-ui";
        const typeText = loot.type === "gold" ? "Gold" : loot.type === "card" ? "Card" : "Item";
        ctx.fillText(`(${typeText})`, textX + ctx.measureText(lootText).width + 10, lootY);

        lootY += lootItemHeight;
      }
    } else {
      // No loot message
      ctx.fillStyle = "#6b7280";
      ctx.font = "14px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("No loot received", panelX + panelWidth / 2, panelY + 120);
    }

    // Draw instruction text at bottom
    ctx.fillStyle = "#9aa3b2";
    ctx.font = "14px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Click to continue", panelX + panelWidth / 2, panelY + panelHeight - 30);

    // Store panel region for click detection
    this.victoryPanelRegion = {
      x: panelX,
      y: panelY,
      w: panelWidth,
      h: panelHeight,
    };

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    ctx.restore(); // Restore screen shake transform
  }

  private drawIconWithAspectRatio(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
    desaturate: boolean = false,
  ) {
    ctx.save();
    if (desaturate) {
      ctx.filter = "grayscale(100%)";
    }
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const targetAspect = w / h;
    let drawWidth = w;
    let drawHeight = h;
    let drawX = x;
    let drawY = y;

    if (imgAspect > targetAspect) {
      drawHeight = w / imgAspect;
      drawY = y + (h - drawHeight) / 2;
    } else {
      drawWidth = h * imgAspect;
      drawX = x + (w - drawWidth) / 2;
    }

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();
  }

  private drawIcon(
    ctx: CanvasRenderingContext2D,
    path: string,
    x: number,
    y: number,
    w: number,
    h: number,
    desaturate: boolean = false,
  ) {
    const fullPath = resolvePath(path);
    assets.loadImage(fullPath).then((img) => {
      this.drawIconWithAspectRatio(ctx, img, x, y, w, h, desaturate);
    });
  }

  onEvent(e: Event): void {
    if (e.type === "scene-wheel") {
      const { x, y, deltaY } = (e as CustomEvent).detail as {
        x: number;
        y: number;
        deltaY: number;
      };

      // Handle wheel events for guide scrolling
      if (this.showGuide && this.guidePanelRegions) {
        if (this.pointInRect(x, y, this.guidePanelRegions.panel)) {
          const scrollSpeed = 20;
          this.guideScrollOffset += deltaY > 0 ? scrollSpeed : -scrollSpeed;
          this.guideScrollOffset = Math.max(0, this.guideScrollOffset);
          return;
        }
      }
      return;
    }

    if (e.type === "scene-click") {
      const { x, y } = (e as CustomEvent).detail as { x: number; y: number };

      // Guide panel - close on outside click
      if (this.showGuide && this.guidePanelRegions) {
        if (!this.pointInRect(x, y, this.guidePanelRegions.panel)) {
          this.showGuide = false;
          this.guidePanelRegions = null;
          this.guideScrollOffset = 0;
          return;
        }
        // If guide is open, block other clicks
        return;
      }

      // Top bar Save/Load/Help
      const buttonRegions = getTopBarButtonRegions(CanvasSize.width);
      if (this.pointInRect(x, y, buttonRegions.save)) {
        this.state.save();
        console.log("Game saved");
        return;
      }
      if (this.pointInRect(x, y, buttonRegions.load)) {
        this.state = GameState.load();
        console.log("Game loaded");
        return;
      }
      if (this.pointInRect(x, y, buttonRegions.help)) {
        this.showGuide = true;
        return;
      }

      // Retreat button
      if (this.retreatButtonRegion && this.pointInRect(x, y, this.retreatButtonRegion)) {
        if (this.onBackToWorld) {
          this.onBackToWorld();
        }
        return;
      }

      // Defeat panel (click anywhere on panel to return to base)
      if (this.isDefeated && this.defeatPanelRegion && this.pointInRect(x, y, this.defeatPanelRegion)) {
        if (this.onBackToBase) {
          this.onBackToBase();
        }
        return;
      }

      // Victory panel (click anywhere on panel to return to world)
      if (this.isVictorious && this.victoryPanelRegion && this.pointInRect(x, y, this.victoryPanelRegion)) {
        if (this.onBackToWorld) {
          this.onBackToWorld();
        }
        return;
      }

      // Consumables (only clickable on player turn)
      if (this.isPlayerTurn && !this.isResolvingMatches && !this.dragState?.isDragging) {
        for (const consumableRegion of this.consumableRegions) {
          if (this.pointInRect(x, y, consumableRegion.region)) {
            this.consumeItem(consumableRegion.itemId);
            return;
          }
        }
      }
    }

    if (e.type === "scene-mousedown") {
      const { x, y } = (e as CustomEvent).detail as { x: number; y: number };

      // Don't allow interactions if defeated or victorious
      if (this.isDefeated || this.isVictorious) {
        return;
      }

      // Don't start dragging if clicking on UI elements
      const buttonRegions = getTopBarButtonRegions(CanvasSize.width);
      if (
        this.pointInRect(x, y, buttonRegions.save) ||
        this.pointInRect(x, y, buttonRegions.load) ||
        this.pointInRect(x, y, buttonRegions.help)
      ) {
        return;
      }

      // Don't start dragging if guide is open
      if (this.showGuide) {
        return;
      }
      if (this.retreatButtonRegion && this.pointInRect(x, y, this.retreatButtonRegion)) {
        return;
      }

      // Don't start dragging if clicking on consumables
      if (this.isPlayerTurn && !this.isResolvingMatches) {
        for (const consumableRegion of this.consumableRegions) {
          if (this.pointInRect(x, y, consumableRegion.region)) {
            return; // Consumables are handled in click event, not mousedown
          }
        }
      }

      // Check if clicking on grid
      const gridCell = this.getGridCellAt(x, y);
      if (gridCell && this.isPlayerTurn) {
        this.dragState = {
          isDragging: true,
          startRow: gridCell.row,
          startCol: gridCell.col,
          currentRow: gridCell.row,
          currentCol: gridCell.col,
          draggedElement: this.grid[gridCell.row][gridCell.col],
          mouseX: x,
          mouseY: y,
        };
        // Start the timer when drag begins
        this.dragTimerRemaining = this.dragTimerDuration;
        this.timer = 1.0;
      }
    }

    if (e.type === "scene-mousemove") {
      if (this.dragState?.isDragging) {
        const { x, y } = (e as CustomEvent).detail as { x: number; y: number };

        // Update mouse position for drawing dragged tile
        this.dragState.mouseX = x;
        this.dragState.mouseY = y;

        // Clamp mouse position to grid boundaries
        const { clampedX, clampedY } = this.clampToGridBounds(x, y);

        const gridCell = this.getGridCellAt(clampedX, clampedY);

        if (gridCell) {
          // Check if we've moved to a different cell
          if (gridCell.row !== this.dragState.currentRow || gridCell.col !== this.dragState.currentCol) {
            // Swap the tile at the new position with the empty space at current position
            // The empty space follows the dragged element along the path
            const temp = this.grid[this.dragState.currentRow][this.dragState.currentCol];
            this.grid[this.dragState.currentRow][this.dragState.currentCol] = this.grid[gridCell.row][gridCell.col];
            this.grid[gridCell.row][gridCell.col] = temp;

            // Update current position (empty space moves to the new cell)
            this.dragState.currentRow = gridCell.row;
            this.dragState.currentCol = gridCell.col;
          }
        }
      }
    }

    if (e.type === "scene-mouseup") {
      if (this.dragState?.isDragging) {
        // Move complete
        this.completeMove();
      }
    }
  }

  private completeMove(): void {
    if (!this.dragState?.isDragging) {
      return;
    }

    // Capture drag positions before clearing dragState
    const startRow = this.dragState.startRow;
    const startCol = this.dragState.startCol;
    const endRow = this.dragState.currentRow;
    const endCol = this.dragState.currentCol;

    // Tutorial step 0 -> 1: Check if player moved center tile (2,2) to (0,4)
    if (this.isTutorial && this.tutorialStep === 0) {
      // Check if moved from (2,2) to (0,4)
      if (startRow === 2 && startCol === 2 && endRow === 0 && endCol === 4) {
        this.tutorialStep = 1;
        // Hide tutorial overlay after completing step
        this.showTutorialOverlayThisTurn = false;
      }
    }

    // Stop dragging
    this.dragState = null;
    this.dragTimerRemaining = 0.0;

    const convertedGrid: string[][] = this.grid.map((row) => row.map((cell) => cell || ""));
    const matches = findMatches(convertedGrid);
    if (matches.length > 0) {
      console.log(`Found ${matches.length} match(es)`, matches);

      // Tutorial progression logic
      if (this.isTutorial) {
        if (this.tutorialStep === 1) {
          // Step 1 -> 2: Must match (2,0), (2,1), and (2,2) in a single match entry
          const requiredCells = new Set([
            "2,0", // row 2, col 0
            "2,1", // row 2, col 1
            "2,2", // row 2, col 2
          ]);

          const hasRequiredMatch = matches.some((match) => {
            // Check if this is a horizontal match (line shape)
            if (match.shape !== "line") return false;

            // Get all cell positions in this match as "row,col" strings
            const matchCells = new Set(match.cells.map((c) => `${c.y},${c.x}`));

            // Must include all three required cells
            return (
              requiredCells.size === matchCells.size && Array.from(requiredCells).every((cell) => matchCells.has(cell))
            );
          });

          if (hasRequiredMatch) {
            this.tutorialStep = 2;
            // Hide tutorial overlay after completing step
            this.showTutorialOverlayThisTurn = false;
          }
        } else if (this.tutorialStep === 2) {
          // Step 2 -> 3: Must match (0,1), (1,1), (2,1), (2,2), (2,3) in a single match entry (L-shape)
          const requiredCells = new Set([
            "0,1", // row 0, col 1
            "1,1", // row 1, col 1
            "2,1", // row 2, col 1
            "2,2", // row 2, col 2
            "2,3", // row 2, col 3
          ]);

          const hasRequiredMatch = matches.some((match) => {
            // Check if this is an L or T shape match
            if (match.shape !== "L" && match.shape !== "T") return false;

            // Get all cell positions in this match as "row,col" strings
            const matchCells = new Set(match.cells.map((c) => `${c.y},${c.x}`));

            // Must include all five required cells
            return (
              requiredCells.size === matchCells.size && Array.from(requiredCells).every((cell) => matchCells.has(cell))
            );
          });

          if (hasRequiredMatch) {
            this.tutorialStep = 3;
            // Hide tutorial overlay after completing step
            this.showTutorialOverlayThisTurn = false;
          }
        } else if (this.tutorialStep === 3) {
          // Step 3 --> 4: Must make at least two matches in a turn (showcase combos)
          const requiredMatches = 2;
          if (matches.length >= requiredMatches) {
            this.tutorialStep = 4;
            // Hide tutorial overlay after completing step
            this.showTutorialOverlayThisTurn = false;
          }
        } else if (this.tutorialStep === 4) {
          // Step 4 --> 5: Must make a healing match
          const hasHealingMatch = matches.some((match) => match.element === "Healing");
          if (hasHealingMatch) {
            this.tutorialStep = 5;
            // Hide tutorial overlay after completing step
            this.showTutorialOverlayThisTurn = false;
          }
        } else if (this.tutorialStep === 5) {
          // Step 5 --> Tutorial complete
          this.tutorialStep = -1;
          this.showTutorialOverlayThisTurn = false;
        }
      }

      // Clear matched tiles, cascade, and resolve all matches
      // This will also calculate and apply damage for all matches including cascades
      this.resolveAllMatches();
    } else {
      // No matches found, player turn is complete - trigger enemy turn with delay
      if (this.isPlayerTurn) {
        this.queueEnemyTurn();
      }
    }
  }

  private clearMatches(matches: Match[]): number {
    const toClear = new Set<string>();
    for (const m of matches) {
      for (const c of m.cells) {
        // Match uses x,y but grid uses row,col (y,x)
        toClear.add(`${c.y},${c.x}`);
      }
    }
    for (const key of toClear) {
      const [row, col] = key.split(",").map(Number);
      this.grid[row][col] = null;
    }
    return toClear.size;
  }

  private compactAndRefill() {
    const elements: Element[] = ["Fire", "Water", "Grass", "Dark", "Light", "Healing"];

    // Create refill animations for empty tiles instead of immediately setting them
    for (let row = 0; row < this.gridRows; row++) {
      for (let col = 0; col < this.gridCols; col++) {
        if (this.grid[row][col] === null) {
          const randomIndex = Math.floor(Math.random() * elements.length);
          const animationKey = `${row},${col}`;
          this.refillAnimations.set(animationKey, {
            progress: 0.0,
            element: elements[randomIndex],
          });
        }
      }
    }

    // If no refill animations were created, check for new matches immediately
    if (
      this.refillAnimations.size === 0 &&
      this.isResolvingMatches &&
      this.popAnimations.size === 0 &&
      this.cascadeDelayTimer === 0
    ) {
      this.findAndStartNextMatch();
    }
  }

  private resolveAllMatches() {
    // Start the resolution process
    this.isResolvingMatches = true;
    this.pendingMatches = [];
    this.accumulatedMatches = []; // Reset accumulated matches for new resolution
    this.currentMatchIndex = 0;
    this.cascadeDelayTimer = 0;
    this.findAndStartNextMatch();
  }

  private findAndStartNextMatch() {
    const convertedGrid: string[][] = this.grid.map((row) => row.map((cell) => cell || ""));
    const matches = findMatches(convertedGrid);

    if (matches.length === 0) {
      // No more matches, we're done - apply all accumulated damage
      this.isResolvingMatches = false;
      this.pendingMatches = [];
      this.currentMatchIndex = 0;
      this.cascadeDelayTimer = 0;

      // Apply damage and healing from all accumulated matches
      if (this.accumulatedMatches.length > 0) {
        // Only include cards from alive player units
        const alivePlayerUnits = this.playerUnits.filter((unit) => unit.currentHp > 0);
        const alivePositions = new Set(alivePlayerUnits.map((unit) => unit.position));

        // Filter loadout to only include alive units based on their position
        const loadout = this.state.loadout;
        const filteredLoadout = {
          leader: loadout.leader && alivePositions.has(0) ? loadout.leader : "",
          members: loadout.members.map((id, index) => (id && alivePositions.has(index + 1) ? id : "")) as [
            string,
            string,
            string,
          ],
        };

        // Calculate combo multiplier based on number of matches
        const comboCount = this.accumulatedMatches.length;
        const comboMultiplier = calculateComboMultiplier(comboCount);

        // Compute and apply damage
        const damageInstances = computeDamageFromMatches(
          this.accumulatedMatches,
          filteredLoadout,
          this.cards,
          comboMultiplier,
        );
        if (damageInstances.length > 0) {
          this.applyDamageToEnemiesWithLogging(damageInstances, comboMultiplier, comboCount);
          // Check for victory after damage
          this.checkForVictory();
        }

        // Compute and apply healing
        const healingInstances = computeHealingFromMatches(this.accumulatedMatches, comboMultiplier);
        if (healingInstances.length > 0) {
          this.applyHealingToPlayerUnitsWithLogging(healingInstances, comboMultiplier, comboCount);
        }
      }

      // Clear accumulated matches
      this.accumulatedMatches = [];

      // If it was player turn, switch to enemy turn with delay
      if (this.isPlayerTurn) {
        this.queueEnemyTurn();
      }

      return;
    }

    // Add matches to accumulated list for damage calculation
    this.accumulatedMatches.push(...matches);

    // Store all matches for this round
    this.pendingMatches = matches;
    this.currentMatchIndex = 0;
    this.soundPlayedForMatchIndex = -1; // Reset sound tracking for new match round
    this.cascadeDelayTimer = 0; // Reset delay timer for new match round

    // Start animating the first match
    this.startCurrentMatchAnimation();
  }

  private startCurrentMatchAnimation() {
    if (this.currentMatchIndex >= this.pendingMatches.length) {
      // All matches in this round have been animated, now cascade and check for new matches
      this.continueResolvingMatches();
      return;
    }

    const match = this.pendingMatches[this.currentMatchIndex];
    console.log(`Animating match ${this.currentMatchIndex + 1}/${this.pendingMatches.length}`, match);

    // Calculate current combo count (total matches so far in this turn)
    const comboCount = this.accumulatedMatches.length;

    // Trigger screen shake for combos (more intense for higher combos)
    if (comboCount > 1) {
      const shakeIntensity = Math.min(1.0, (comboCount - 1) / 5.0); // Max at 6+ combos
      const shakeAmount = shakeIntensity * 8; // Up to 8 pixels
      this.screenShake = {
        intensity: shakeAmount,
        progress: 0.0,
        duration: 0.2, // 200ms shake
        seed: Math.random() * 1000, // Random seed for shake pattern
      };
    }

    // Start pop animations for the current match's tiles
    for (const cell of match.cells) {
      // Match uses x,y but grid uses row,col (y,x)
      const row = cell.y;
      const col = cell.x;
      const animationKey = `${row},${col}`;

      // Get the element before clearing
      const element = this.grid[row]?.[col];
      if (element) {
        // Clear the tile immediately so underlying grid is empty
        this.grid[row][col] = null;
        // Store animation with element, combo count, and match index for rendering
        this.popAnimations.set(animationKey, {
          progress: 0.0,
          element,
          comboCount,
          matchIndex: this.currentMatchIndex,
        });
      }
    }

    // If there are no animations to wait for (shouldn't happen), continue immediately
    if (this.popAnimations.size === 0) {
      this.onCurrentMatchAnimationComplete();
    }
  }

  private onCurrentMatchAnimationComplete() {
    // Move to the next match
    this.currentMatchIndex++;

    // If there are more matches in this round, animate the next one
    if (this.currentMatchIndex < this.pendingMatches.length) {
      this.startCurrentMatchAnimation();
    } else {
      // All matches in this round have been animated, start delay before cascade
      this.cascadeDelayTimer = this.cascadeDelay;
    }
  }

  private continueResolvingMatches() {
    if (this.pendingMatches.length === 0) {
      this.isResolvingMatches = false;
      return;
    }

    // Tiles are already cleared when animations started, so we just cascade and refill
    // Damage will be applied later when all matches (including after refill) are resolved
    // Start refill animations (will call findAndStartNextMatch when complete)
    this.compactAndRefill();
  }

  private addCombatLogEntry(entry: CombatLogEntry): void {
    this.combatLog.push(entry);
    // Keep only the most recent entries
    if (this.combatLog.length > this.maxCombatLogEntries) {
      this.combatLog.shift();
    }
  }

  private findSourcePlayerUnitPosition(cardIds: string[]): number | null {
    // Find the first matching card in the loadout and return its position
    const loadout = this.state.loadout;
    const allCardIds = [loadout.leader, ...loadout.members];

    for (let i = 0; i < allCardIds.length; i++) {
      if (allCardIds[i] && cardIds.includes(allCardIds[i])) {
        return i; // Position 0 is leader, 1-3 are members
      }
    }

    // If no match found, use the first alive player unit
    const firstAlive = this.playerUnits.find((u) => u.currentHp > 0);
    return firstAlive ? firstAlive.position : null;
  }

  private applyDamageToEnemiesWithLogging(
    damageInstances: ReturnType<typeof computeDamageFromMatches>,
    comboMultiplier: number,
    comboCount: number,
  ): void {
    // Apply damage similar to applyDamageToEnemies but with logging
    for (const damage of damageInstances) {
      // Get source card name(s) for logging
      const sourceCardNames = damage.cardIds
        .map((id) => this.cards.find((c) => c.id === id)?.name)
        .filter(Boolean)
        .join(", ");

      // Find source player unit position for animation
      const sourcePosition = this.findSourcePlayerUnitPosition(damage.cardIds);

      if (damage.isAoE) {
        // AoE: Apply to all enemies
        for (const enemy of this.enemies) {
          if (enemy.currentHp > 0 && enemy.unit.elements?.[0]) {
            // Apply leader passive multiplier based on enemy type
            let leaderMultiplier = 1;
            const isBoss = enemy.unit.tags?.includes("Boss") ?? false;
            if (isBoss && damage.leaderPassiveBossMultiplier) {
              leaderMultiplier = damage.leaderPassiveBossMultiplier;
            } else if (!isBoss && damage.leaderPassiveMultiplier) {
              leaderMultiplier = damage.leaderPassiveMultiplier;
            }

            const elementalMult = elementalMultiplier(damage.element, enemy.unit.elements[0]);
            const totalMultiplier = leaderMultiplier * elementalMult;
            const finalDamage = Math.floor(damage.baseDamage * totalMultiplier);
            const hpBefore = enemy.currentHp;
            // Ensure HP is always an integer after damage
            enemy.currentHp = Math.max(0, Math.floor(enemy.currentHp - finalDamage));

            // Log damage event
            this.addCombatLogEntry({
              type: "damage",
              source: {
                name: sourceCardNames || "Player",
                isPlayer: true,
                element: damage.element,
              },
              target: {
                name: enemy.unit.name,
                isPlayer: false,
                element: enemy.unit.elements[0],
              },
              baseDamage: damage.baseDamage,
              multiplier: totalMultiplier,
              finalDamage,
              isAoE: true,
              targetHpAfter: enemy.currentHp,
              targetMaxHp: enemy.maxHp,
              comboMultiplier: comboMultiplier > 1 ? comboMultiplier : undefined,
              comboCount: comboCount > 1 ? comboCount : undefined,
            });

            // Trigger damage animation
            if (sourcePosition !== null) {
              this.startDamageAnimation(damage.element, true, sourcePosition, enemy.position, finalDamage);
            }
          }
        }
      } else {
        // Single target: Apply to leftmost alive enemy
        const leftmostAlive = this.enemies.find((e) => e.currentHp > 0);

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
          const totalMultiplier = leaderMultiplier * elementalMult;
          const finalDamage = Math.floor(damage.baseDamage * totalMultiplier);
          const hpBefore = leftmostAlive.currentHp;
          // Ensure HP is always an integer after damage
          leftmostAlive.currentHp = Math.max(0, Math.floor(leftmostAlive.currentHp - finalDamage));

          // Log damage event
          this.addCombatLogEntry({
            type: "damage",
            source: {
              name: sourceCardNames || "Player",
              isPlayer: true,
              element: damage.element,
            },
            target: {
              name: leftmostAlive.unit.name,
              isPlayer: false,
              element: leftmostAlive.unit.elements[0],
            },
            baseDamage: damage.baseDamage,
            multiplier: totalMultiplier,
            finalDamage,
            isAoE: false,
            targetHpAfter: leftmostAlive.currentHp,
            targetMaxHp: leftmostAlive.maxHp,
            comboMultiplier: comboMultiplier > 1 ? comboMultiplier : undefined,
            comboCount: comboCount > 1 ? comboCount : undefined,
          });

          // Trigger damage animation
          if (sourcePosition !== null) {
            this.startDamageAnimation(damage.element, true, sourcePosition, leftmostAlive.position, finalDamage);
          }
        }
      }
    }
  }

  private applyHealingToPlayerUnitsWithLogging(
    healingInstances: ReturnType<typeof computeHealingFromMatches>,
    comboMultiplier: number,
    comboCount: number,
  ): void {
    // Apply healing similar to applyHealingToPlayerUnits but with logging
    for (const healing of healingInstances) {
      if (healing.isAoE) {
        // AoE: Apply to all alive player units
        for (const unit of this.playerUnits) {
          if (unit.currentHp > 0) {
            const hpBefore = unit.currentHp;
            // Ensure healing amount is integer before applying
            const integerHealing = Math.floor(healing.amount);
            unit.currentHp = Math.min(unit.maxHp, Math.floor(unit.currentHp + integerHealing));
            const actualHealing = unit.currentHp - hpBefore;

            if (actualHealing >= 0) {
              // Log healing event
              this.addCombatLogEntry({
                type: "healing",
                source: {
                  name: "Healing",
                  isPlayer: true,
                  element: "Healing",
                },
                target: {
                  name: unit.unit.name,
                  isPlayer: true,
                  element: unit.unit.elements?.[0],
                },
                amount: actualHealing,
                isAoE: true,
                targetHpAfter: unit.currentHp,
                targetMaxHp: unit.maxHp,
                comboMultiplier: comboMultiplier > 1 ? comboMultiplier : undefined,
                comboCount: comboCount > 1 ? comboCount : undefined,
              });

              // Trigger healing animation
              this.startHealingAnimation(unit.position);

              // Spawn floating healing number
              const playerUnitArea = BattleLayout.playerUnits;
              const playerUnitSlotWidth = playerUnitArea.w / 4;
              const playerUnitSize = 96;
              const slotX = playerUnitArea.x + unit.position * playerUnitSlotWidth;
              const unitX = slotX + (playerUnitSlotWidth - playerUnitSize) / 2;
              const unitY = playerUnitArea.y + (playerUnitArea.h - playerUnitSize) / 2;
              const unitCenterX = unitX + playerUnitSize / 2;
              const unitCenterY = unitY + playerUnitSize / 2;
              this.spawnFloatingHealingNumber(unitCenterX, unitCenterY, actualHealing, true, unit.position);
            }
          }
        }
      } else {
        // Single target: Apply to rightmost alive player unit
        const aliveUnits = this.playerUnits.filter((u) => u.currentHp > 0);
        const rightmostAlive =
          aliveUnits.length > 0
            ? aliveUnits.reduce((rightmost, current) => (current.position > rightmost.position ? current : rightmost))
            : null;

        if (rightmostAlive) {
          const hpBefore = rightmostAlive.currentHp;
          // Ensure healing amount is integer before applying
          const integerHealing = Math.floor(healing.amount);
          rightmostAlive.currentHp = Math.min(
            rightmostAlive.maxHp,
            Math.floor(rightmostAlive.currentHp + integerHealing),
          );
          const actualHealing = rightmostAlive.currentHp - hpBefore;

          if (actualHealing >= 0) {
            // Log healing event
            this.addCombatLogEntry({
              type: "healing",
              source: {
                name: "Healing",
                isPlayer: true,
                element: "Healing",
              },
              target: {
                name: rightmostAlive.unit.name,
                isPlayer: true,
                element: rightmostAlive.unit.elements?.[0],
              },
              amount: actualHealing,
              isAoE: false,
              targetHpAfter: rightmostAlive.currentHp,
              targetMaxHp: rightmostAlive.maxHp,
              comboMultiplier: comboMultiplier > 1 ? comboMultiplier : undefined,
              comboCount: comboCount > 1 ? comboCount : undefined,
            });

            // Trigger healing animation
            this.startHealingAnimation(rightmostAlive.position);

            // Spawn floating healing number
            const playerUnitArea = BattleLayout.playerUnits;
            const playerUnitSlotWidth = playerUnitArea.w / 4;
            const playerUnitSize = 96;
            const slotX = playerUnitArea.x + rightmostAlive.position * playerUnitSlotWidth;
            const unitX = slotX + (playerUnitSlotWidth - playerUnitSize) / 2;
            const unitY = playerUnitArea.y + (playerUnitArea.h - playerUnitSize) / 2;
            const unitCenterX = unitX + playerUnitSize / 2;
            const unitCenterY = unitY + playerUnitSize / 2;
            this.spawnFloatingHealingNumber(unitCenterX, unitCenterY, actualHealing, true, rightmostAlive.position);
          }
        }
      }
    }
  }

  private consumeItem(itemId: string): void {
    // Check if item exists in inventory
    const inventory = this.state.inventory.items;
    const count = inventory[itemId] || 0;
    if (count <= 0) {
      return; // Item not available
    }

    // Find item definition
    const item = this.items.find((i) => i.id === itemId);
    if (!item || !item.effect) {
      return; // Item not found or has no effect
    }

    // Apply item effects
    const effects = Array.isArray(item.effect) ? item.effect : [item.effect];
    for (const effect of effects) {
      if (typeof effect === "object" && effect !== null) {
        const effectObj = effect as { type?: string; amount?: number; targets?: string[] };
        if (effectObj.type === "heal" && effectObj.amount) {
          // Ensure heal amount is integer
          const healAmount = Math.floor(effectObj.amount);
          const targets = effectObj.targets || [];

          // Apply healing based on targets
          if (targets.includes("Player")) {
            // Heal all alive player units
            for (const unit of this.playerUnits) {
              if (unit.currentHp > 0) {
                const hpBefore = unit.currentHp;
                unit.currentHp = Math.min(unit.maxHp, Math.floor(unit.currentHp + healAmount));
                const actualHealing = unit.currentHp - hpBefore;

                if (actualHealing > 0) {
                  // Log healing event
                  this.addCombatLogEntry({
                    type: "healing",
                    source: {
                      name: item.name,
                      isPlayer: true,
                      element: "Healing",
                    },
                    target: {
                      name: unit.unit.name,
                      isPlayer: true,
                      element: unit.unit.elements?.[0],
                    },
                    amount: actualHealing,
                    isAoE: true, // Consumables heal all units
                    targetHpAfter: unit.currentHp,
                    targetMaxHp: unit.maxHp,
                  });

                  // Trigger healing animation
                  this.startHealingAnimation(unit.position);

                  // Spawn floating healing number
                  const playerUnitArea = BattleLayout.playerUnits;
                  const playerUnitSlotWidth = playerUnitArea.w / 4;
                  const playerUnitSize = 96;
                  const slotX = playerUnitArea.x + unit.position * playerUnitSlotWidth;
                  const unitX = slotX + (playerUnitSlotWidth - playerUnitSize) / 2;
                  const unitY = playerUnitArea.y + (playerUnitArea.h - playerUnitSize) / 2;
                  const unitCenterX = unitX + playerUnitSize / 2;
                  const unitCenterY = unitY + playerUnitSize / 2;
                  this.spawnFloatingHealingNumber(unitCenterX, unitCenterY, actualHealing, true, unit.position);
                }
              }
            }
          }
        }
      }
    }

    // Remove item from inventory
    inventory[itemId] = count - 1;
    if (inventory[itemId] === 0) {
      delete inventory[itemId];
    }
    this.state.save();
  }

  private startHealingAnimation(unitPosition: number): void {
    // Calculate unit position for icon spawning
    const playerUnitArea = BattleLayout.playerUnits;
    const playerUnitSlotWidth = playerUnitArea.w / 4;
    const playerUnitSize = 96;
    const slotX = playerUnitArea.x + unitPosition * playerUnitSlotWidth;
    const unitX = slotX + (playerUnitSlotWidth - playerUnitSize) / 2;
    const unitY = playerUnitArea.y + (playerUnitArea.h - playerUnitSize) / 2;
    const unitCenterX = unitX + playerUnitSize / 2;
    const unitCenterY = unitY + playerUnitSize / 2;

    // Create 3-5 healing icons that will rise and fade
    const numIcons = 3 + Math.floor(Math.random() * 3); // 3-5 icons
    const icons: Array<{ x: number; y: number; progress: number }> = [];

    for (let i = 0; i < numIcons; i++) {
      // Randomize starting position slightly around unit center
      const offsetX = (Math.random() - 0.5) * playerUnitSize * 0.6;
      const offsetY = (Math.random() - 0.5) * playerUnitSize * 0.6;
      icons.push({
        x: unitCenterX + offsetX,
        y: unitCenterY + offsetY,
        progress: Math.random() * 0.2, // Stagger start times slightly
      });
    }

    this.healingAnimations.set(unitPosition, {
      progress: 0.0,
      icons,
      glowProgress: 0.0,
    });
  }

  private startDamageAnimation(
    element: Element,
    isPlayerSource: boolean,
    sourcePosition: number,
    targetPosition: number,
    damageAmount: number,
  ): void {
    // Calculate source unit position
    let sourceX: number;
    let sourceY: number;
    let targetX: number;
    let targetY: number;
    const unitSize = 96;

    if (isPlayerSource) {
      // Source is a player unit
      const playerUnitArea = BattleLayout.playerUnits;
      const playerUnitSlotWidth = playerUnitArea.w / 4;
      const slotX = playerUnitArea.x + sourcePosition * playerUnitSlotWidth;
      const unitX = slotX + (playerUnitSlotWidth - unitSize) / 2;
      const unitY = playerUnitArea.y + (playerUnitArea.h - unitSize) / 2;
      sourceX = unitX + unitSize / 2;
      sourceY = unitY + unitSize / 2;

      // Target is an enemy
      const enemyArea = BattleLayout.enemies;
      const enemySlotWidth = enemyArea.w / 4;
      const enemySlotX = enemyArea.x + targetPosition * enemySlotWidth;
      const enemyX = enemySlotX + (enemySlotWidth - unitSize) / 2;
      const enemyY = enemyArea.y + (enemyArea.h - unitSize) / 2;
      targetX = enemyX + unitSize / 2;
      targetY = enemyY + unitSize / 2;
    } else {
      // Source is an enemy
      const enemyArea = BattleLayout.enemies;
      const enemySlotWidth = enemyArea.w / 4;
      const enemySlotX = enemyArea.x + sourcePosition * enemySlotWidth;
      const enemyX = enemySlotX + (enemySlotWidth - unitSize) / 2;
      const enemyY = enemyArea.y + (enemyArea.h - unitSize) / 2;
      sourceX = enemyX + unitSize / 2;
      sourceY = enemyY + unitSize / 2;

      // Target is a player unit
      const playerUnitArea = BattleLayout.playerUnits;
      const playerUnitSlotWidth = playerUnitArea.w / 4;
      const slotX = playerUnitArea.x + targetPosition * playerUnitSlotWidth;
      const unitX = slotX + (playerUnitSlotWidth - unitSize) / 2;
      const unitY = playerUnitArea.y + (playerUnitArea.h - unitSize) / 2;
      targetX = unitX + unitSize / 2;
      targetY = unitY + unitSize / 2;
    }

    // Create 4-6 damage icons that will rain from source to target
    const numIcons = 4 + Math.floor(Math.random() * 3); // 4-6 icons
    const icons: Array<{ x: number; y: number; progress: number }> = [];

    for (let i = 0; i < numIcons; i++) {
      // Randomize starting position slightly around source center
      const offsetX = (Math.random() - 0.5) * unitSize * 0.4;
      const offsetY = (Math.random() - 0.5) * unitSize * 0.4;
      icons.push({
        x: sourceX + offsetX,
        y: sourceY + offsetY,
        progress: Math.random() * 0.15, // Stagger start times slightly
      });
    }

    const animationKey = `${isPlayerSource ? "player" : "enemy"}:${sourcePosition}->${
      isPlayerSource ? "enemy" : "player"
    }:${targetPosition}`;
    this.damageAnimations.set(animationKey, {
      element,
      sourceX,
      sourceY,
      targetX,
      targetY,
      progress: 0.0,
      icons,
      targetGlowProgress: 0.0,
      isPlayerSource,
      targetPosition,
      damageAmount,
    });
  }

  private spawnFloatingDamageNumber(
    x: number,
    y: number,
    damage: number,
    isPlayerTarget: boolean,
    targetPosition: number,
  ): void {
    const id = `damage_${this.floatingDamageIdCounter++}`;
    this.floatingDamageNumbers.set(id, {
      x,
      y: y - 20, // Start slightly above the unit center
      damage,
      progress: 0.0,
      isPlayerTarget,
      targetPosition,
    });
  }

  private spawnFloatingHealingNumber(
    x: number,
    y: number,
    healing: number,
    isPlayerTarget: boolean,
    targetPosition: number,
  ): void {
    const id = `healing_${this.floatingHealingIdCounter++}`;
    this.floatingHealingNumbers.set(id, {
      x,
      y: y - 20, // Start slightly above the unit center
      healing,
      progress: 0.0,
      isPlayerTarget,
      targetPosition,
    });
  }

  private queueEnemyTurn(): void {
    // Queue enemy turn with delay
    this.pendingTurnSwitch = "enemy";
    this.turnSwitchDelayTimer = this.turnSwitchDelay;
  }

  private executeEnemyTurn(): void {
    console.log("executeEnemyTurn called");
    // Switch to enemy turn
    this.isPlayerTurn = false;

    // Apply damage from all alive enemies to player units
    const aliveEnemies = this.enemies.filter((e) => e.currentHp > 0);
    console.log(`Alive enemies: ${aliveEnemies.length}`);

    for (const enemy of aliveEnemies) {
      // Each enemy deals damage equal to their attack to the rightmost alive player unit
      const alivePlayers = this.playerUnits.filter((unit) => unit.currentHp > 0);
      const rightmostAlivePlayer =
        alivePlayers.length > 0
          ? alivePlayers.reduce((rightmost, current) => (current.position > rightmost.position ? current : rightmost))
          : null;

      if (rightmostAlivePlayer && enemy.unit.elements?.[0] && rightmostAlivePlayer.unit.elements?.[0]) {
        // Calculate elemental multiplier
        const multiplier = elementalMultiplier(enemy.unit.elements[0], rightmostAlivePlayer.unit.elements[0]);
        const baseDamage = enemy.unit.attack;
        const finalDamage = Math.floor(baseDamage * multiplier);

        if (finalDamage == 0) {
          continue;
        }

        // Apply damage
        const hpBefore = rightmostAlivePlayer.currentHp;
        // Ensure HP is always an integer after damage
        rightmostAlivePlayer.currentHp = Math.max(0, Math.floor(rightmostAlivePlayer.currentHp - finalDamage));

        // Log damage event
        this.addCombatLogEntry({
          type: "damage",
          source: {
            name: enemy.unit.name,
            isPlayer: false,
            element: enemy.unit.elements[0],
          },
          target: {
            name: rightmostAlivePlayer.unit.name,
            isPlayer: true,
            element: rightmostAlivePlayer.unit.elements[0],
          },
          baseDamage,
          multiplier,
          finalDamage,
          isAoE: false,
          targetHpAfter: rightmostAlivePlayer.currentHp,
          targetMaxHp: rightmostAlivePlayer.maxHp,
        });

        // Trigger damage animation
        this.startDamageAnimation(
          enemy.unit.elements[0],
          false,
          enemy.position,
          rightmostAlivePlayer.position,
          finalDamage,
        );
      }
    }

    // Check if all player units are dead
    const alivePlayerUnits = this.playerUnits.filter((unit) => unit.currentHp > 0);
    if (alivePlayerUnits.length === 0 && !this.defeatTriggered) {
      this.defeatTriggered = true;
      this.panelDelayTimer = this.panelDelay;
      console.log("All player units defeated");
      return;
    }

    // Queue switch back to player turn with delay
    console.log("Queueing player turn switch");
    this.queuePlayerTurnSwitch();
  }

  private queuePlayerTurnSwitch(): void {
    // Queue player turn switch with delay
    console.log("queuePlayerTurnSwitch called, setting timer");
    this.pendingTurnSwitch = "player";
    this.turnSwitchDelayTimer = this.turnSwitchDelay;
    console.log(`Timer set to ${this.turnSwitchDelayTimer}, pendingTurnSwitch: ${this.pendingTurnSwitch}`);
  }

  private executePlayerTurnSwitch(): void {
    console.log("executePlayerTurnSwitch called");
    // Switch back to player turn
    this.isPlayerTurn = true;

    // Start new round
    this.currentRound++;
    this.addCombatLogEntry({ type: "separator", round: this.currentRound });

    // Tutorial: Regenerate tutorial grid for new turn if needed
    if (this.isTutorial) {
      // Regenerate tutorial grid for new turn if needed
      if (this.tutorialStep >= 0 && this.tutorialStep <= 4) {
        this.initializeGrid();
        this.populateTutorialGrid();
      }
      // Show tutorial overlay on this player turn
      this.showTutorialOverlayThisTurn = true;
    }

    console.log("Enemy turn complete, switching back to player turn");
  }

  private checkForVictory(): void {
    // Check if all enemies are dead
    const aliveEnemies = this.enemies.filter((e) => e.currentHp > 0);
    if (aliveEnemies.length === 0 && !this.victoryTriggered && !this.defeatTriggered) {
      this.victoryTriggered = true;
      this.panelDelayTimer = this.panelDelay;
      this.rollAndApplyLoot();
      console.log("Victory! All enemies defeated");
    }
  }

  private async rollAndApplyLoot(): Promise<void> {
    if (!this.stage || !this.stage.loot) {
      return;
    }

    // Resolve loot config to loot table
    const lootTable = await resolveLootConfig(this.stage.loot);
    if (!lootTable) {
      return;
    }
    console.log(lootTable);

    // Roll loot for each entry
    const rolledLoot: Array<{
      type: "gold" | "plovmand" | "card" | "item";
      id: string;
      name: string;
      amount: number;
      imagePath?: string;
    }> = [];

    for (const entry of lootTable.entries) {
      if (Math.random() < entry.chance) {
        // Determine amount
        let amount = 1;
        if (entry.amount) {
          const [min, max] = entry.amount;
          amount = Math.floor(Math.random() * (max - min + 1)) + min;
        }

        // Parse item string (format: "coin", "card:card_id", "item:item_id")
        if (entry.item === "coin") {
          rolledLoot.push({
            type: "gold",
            id: "coin",
            name: "Gold",
            amount,
            imagePath: "/assets/currencies/coin.png",
          });
          // Apply gold to state
          this.state.currencies.gold += amount;
        } else if (entry.item.startsWith("card:")) {
          const cardId = entry.item.substring(5);
          const card = this.cards.find((c) => c.id === cardId);
          if (card) {
            rolledLoot.push({
              type: "card",
              id: cardId,
              name: card.name,
              amount,
              imagePath: card.imagePath,
            });
            // Apply card to collection
            this.state.inventory.cardCollection[cardId] = (this.state.inventory.cardCollection[cardId] || 0) + amount;
          }
        } else if (entry.item.startsWith("item:")) {
          const itemId = entry.item.substring(5);
          const item = this.items.find((i) => i.id === itemId);
          if (item) {
            rolledLoot.push({
              type: "item",
              id: itemId,
              name: item.name,
              amount,
              imagePath: item.imagePath,
            });
            // Apply item to inventory
            this.state.inventory.items[itemId] = (this.state.inventory.items[itemId] || 0) + amount;
          }
        }
      }
    }

    // Complete the stage in progression
    if (this.world && this.stage) {
      const stageIndex = this.world.stages.findIndex((s) => s.id === this.stage!.id);
      if (stageIndex >= 0) {
        const isFirstTime = this.state.isFirstTimeCompletion(this.stage.id);
        this.state.completeStage(this.worldId, stageIndex);

        // Apply first-time reward if this is the first completion and reward is configured
        if (isFirstTime) {
          // Mark stage as completed for the first time (do this before applying reward)
          this.state.markFirstTimeCompletion(this.stage.id);

          if (this.stage.firstTimeReward) {
            const reward = this.stage.firstTimeReward;
            // Determine amount
            let amount = 1;
            if (reward.amount) {
              const [min, max] = reward.amount;
              amount = Math.floor(Math.random() * (max - min + 1)) + min;
            }

            // Parse item string
            if (reward.item === "coin") {
              rolledLoot.push({
                type: "gold",
                id: "coin",
                name: "Gold",
                amount,
                imagePath: "/assets/currencies/coin.png",
              });
              // Apply gold to state
              this.state.currencies.gold += amount;
            } else if (reward.item === "plovmand") {
              rolledLoot.push({
                type: "plovmand",
                id: "plovmand",
                name: "Plovmand",
                amount,
                imagePath: "/assets/currencies/plovmand.png",
              });
              // Apply plovmand to state
              this.state.currencies.plovmand += amount;
            } else if (reward.item.startsWith("card:")) {
              const cardId = reward.item.substring(5);
              const card = this.cards.find((c) => c.id === cardId);
              if (card) {
                rolledLoot.push({
                  type: "card",
                  id: cardId,
                  name: card.name,
                  amount,
                  imagePath: card.imagePath,
                });
                // Apply card to collection
                this.state.inventory.cardCollection[cardId] =
                  (this.state.inventory.cardCollection[cardId] || 0) + amount;
              }
            } else if (reward.item.startsWith("item:")) {
              const itemId = reward.item.substring(5);
              const item = this.items.find((i) => i.id === itemId);
              if (item) {
                rolledLoot.push({
                  type: "item",
                  id: itemId,
                  name: item.name,
                  amount,
                  imagePath: item.imagePath,
                });
                // Apply item to inventory
                this.state.inventory.items[itemId] = (this.state.inventory.items[itemId] || 0) + amount;
              }
            }
          }
        }
      }
    }

    // Save state
    this.state.save();

    // Store rolled loot for display
    this.victoryLoot = rolledLoot;
  }

  private renderTutorialOverlay(ctx: CanvasRenderingContext2D): void {
    if (this.tutorialStep < 0 || this.tutorialStep > 5) return;

    const gridArea = BattleLayout.grid;
    const combatLogArea = BattleLayout.combatLog;
    const cellGap = 6;
    const cellSize = Math.min(
      (gridArea.w - (this.gridCols - 1) * cellGap) / this.gridCols,
      (gridArea.h - (this.gridRows - 1) * cellGap) / this.gridRows,
    );

    const match3GridWidth = this.gridCols * cellSize + (this.gridCols - 1) * cellGap;
    const match3GridAreaX = gridArea.x + (gridArea.w - match3GridWidth) / 2;

    // Dim the entire scene except grid area and tutorial panel
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";

    // Draw dimming in rectangles, excluding grid area and tutorial panel area
    // Top area (above both grid and tutorial panel)
    ctx.fillRect(0, 0, CanvasSize.width, gridArea.y);
    // Bottom area (below both grid and tutorial panel)
    ctx.fillRect(0, gridArea.y + gridArea.h, CanvasSize.width, CanvasSize.height - (gridArea.y + gridArea.h));
    // Left of grid
    ctx.fillRect(0, gridArea.y, match3GridAreaX, gridArea.h);
    // right of grid until combat log area
    ctx.fillRect(
      match3GridAreaX + match3GridWidth,
      gridArea.y,
      combatLogArea.x - (match3GridAreaX + match3GridWidth),
      gridArea.h,
    );
    // Between grid and tutorial panel (if there's a gap)
    if (gridArea.x + gridArea.w < combatLogArea.x) {
      ctx.fillRect(gridArea.x + gridArea.w, gridArea.y, combatLogArea.x - (gridArea.x + gridArea.w), gridArea.h);
    }

    ctx.restore();

    // Draw tutorial panel overlay at combat log position with same dimensions
    const panelX = combatLogArea.x;
    const panelY = combatLogArea.y;
    const panelW = combatLogArea.w;
    const panelH = combatLogArea.h;
    const padding = 16;
    const lineHeight = 20;

    drawPanel(ctx, panelX, panelY, panelW, panelH, "Tutorial");

    let currentY = panelY + 32 + padding;
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "14px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    if (this.tutorialStep === 0) {
      // Turn 0: Explain how to make a move
      ctx.fillText("How to make a move", panelX + padding, currentY);
      currentY += lineHeight * 1.2;
      ctx.font = "12px system-ui";
      ctx.fillStyle = "#9aa3b2";
      ctx.fillText("• Click and hold on any element tile to start your turn", panelX + padding, currentY);
      currentY += lineHeight;
      ctx.fillText("• Drag the element to a neighboring tile to swap elements", panelX + padding, currentY);
      currentY += lineHeight;
      ctx.fillText("• Swaps can be made in cardinal directions and diagonals", panelX + padding, currentY);
      currentY += lineHeight;
      ctx.fillText("• Your turn ends once you let go of the element", panelX + padding, currentY);
      currentY += lineHeight;
      ctx.fillText("• Your turn also ends if the timer above the grid expires", panelX + padding, currentY);
      currentY += lineHeight;
      ctx.fillText("• You can make any amount of swaps in one turn", panelX + padding, currentY);
      currentY += lineHeight * 1.2;
      ctx.fillText("• Try to move the center element to the highlighted tile", panelX + padding, currentY);
      currentY += lineHeight * 1.2;

      // Draw tutorial image placeholder (3x3 grid with center element and arrows)
      const imageX = panelX + padding;
      const imageY = currentY;
      const imageSize = 90; // Smaller to fit in combat log area
      const miniCellSize = imageSize / 3;

      // Draw grid background
      ctx.fillStyle = "#1a1d24";
      ctx.fillRect(imageX, imageY, imageSize, imageSize);
      ctx.strokeStyle = "#2b2f3a";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(imageX + i * miniCellSize, imageY);
        ctx.lineTo(imageX + i * miniCellSize, imageY + imageSize);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(imageX, imageY + i * miniCellSize);
        ctx.lineTo(imageX + imageSize, imageY + i * miniCellSize);
        ctx.stroke();
      }

      // Draw center element
      const centerX = imageX + miniCellSize;
      const centerY = imageY + miniCellSize;
      const loadout = this.state.loadout;
      const leaderCard = loadout.leader ? this.cards.find((c) => c.id === loadout.leader) : null;
      const leaderElement: Element = leaderCard && leaderCard.elements.length > 0 ? leaderCard.elements[0] : "Fire";
      const iconPath = elementIconPath(leaderElement);
      this.drawIcon(
        ctx,
        iconPath,
        centerX + miniCellSize / 4,
        centerY + miniCellSize / 4,
        miniCellSize / 2,
        miniCellSize / 2,
      );

      // Draw arrows in 8 directions
      ctx.strokeStyle = "#3b82f6";
      ctx.fillStyle = "#3b82f6";
      ctx.lineWidth = 2;
      const arrowHeadSize = 4;
      const centerCellX = imageX + miniCellSize + miniCellSize / 2; // Center of middle cell (col 1, row 1)
      const centerCellY = imageY + miniCellSize + miniCellSize / 2;

      // Offset from center to start arrows (start a bit out of center)
      const startOffset = miniCellSize * 0.35;

      // 8 directions: Up, Up-right, Right, Down-right, Down, Down-left, Left, Up-left
      const directions = [
        { col: 1, row: 0, dx: 0, dy: -1 }, // Up
        { col: 2, row: 0, dx: 1, dy: -1 }, // Up-right
        { col: 2, row: 1, dx: 1, dy: 0 }, // Right
        { col: 2, row: 2, dx: 1, dy: 1 }, // Down-right
        { col: 1, row: 2, dx: 0, dy: 1 }, // Down
        { col: 0, row: 2, dx: -1, dy: 1 }, // Down-left
        { col: 0, row: 1, dx: -1, dy: 0 }, // Left
        { col: 0, row: 0, dx: -1, dy: -1 }, // Up-left
      ];

      for (const dir of directions) {
        // Start point: slightly offset from center in the direction of the arrow
        const startX = centerCellX + dir.dx * startOffset;
        const startY = centerCellY + dir.dy * startOffset;

        // End point: center of the target tile (halfway into that tile)
        const endX = imageX + (dir.col + 0.5) * miniCellSize;
        const endY = imageY + (dir.row + 0.5) * miniCellSize;

        // Draw arrow line
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(endY - startY, endX - startX);
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - arrowHeadSize * Math.cos(angle - Math.PI / 6),
          endY - arrowHeadSize * Math.sin(angle - Math.PI / 6),
        );
        ctx.lineTo(
          endX - arrowHeadSize * Math.cos(angle + Math.PI / 6),
          endY - arrowHeadSize * Math.sin(angle + Math.PI / 6),
        );
        ctx.closePath();
        ctx.fill();
      }

      // Highlight the the center tile and the tile two rows up and two cols to the right
      const highlightCells = [
        { row: 2, col: 2 },
        { row: 0, col: 4 },
      ];

      for (const cell of highlightCells) {
        const cellX = match3GridAreaX + cell.col * (cellSize + cellGap);
        const cellY = gridArea.y + cell.row * (cellSize + cellGap);
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 3;
        ctx.strokeRect(cellX - 2, cellY - 2, cellSize + 4, cellSize + 4);
        ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
        ctx.fillRect(cellX, cellY, cellSize, cellSize);
      }
    } else if (this.tutorialStep === 1) {
      // Turn 1: Explain element matching
      const loadout = this.state.loadout;
      const leaderCard = loadout.leader ? this.cards.find((c) => c.id === loadout.leader) : null;
      const leaderElement: Element = leaderCard && leaderCard.elements.length > 0 ? leaderCard.elements[0] : "Fire";

      ctx.fillText("Element Matching", panelX + padding, currentY);
      currentY += lineHeight * 1.2;
      ctx.font = "12px system-ui";
      ctx.fillStyle = "#9aa3b2";
      ctx.fillText(`• Matching elements fuels the attack of units`, panelX + padding, currentY);
      currentY += lineHeight;
      ctx.fillText(
        `  > Your ${leaderElement} based unit needs ${leaderElement} elements to attack`,
        panelX + padding,
        currentY,
      );
      currentY += lineHeight;
      ctx.fillText("• Try to complete the match shown in the grid!", panelX + padding, currentY);
      currentY += lineHeight;

      // Highlight the specific tiles needed for the match
      // Grid has 2 leader elements at [2][0] and [2][1], need to move [2][3] to [2][2]
      const requiredShapeCells = [
        { row: 2, col: 0 },
        { row: 2, col: 1 },
        { row: 2, col: 2 },
      ];
      const missingInShapeCells = [{ row: 2, col: 3 }];
      for (const cell of requiredShapeCells) {
        const cellX = match3GridAreaX + cell.col * (cellSize + cellGap);
        const cellY = gridArea.y + cell.row * (cellSize + cellGap);
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 3;
        ctx.strokeRect(cellX - 2, cellY - 2, cellSize + 4, cellSize + 4);
        ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
        ctx.fillRect(cellX, cellY, cellSize, cellSize);
      }
      for (const cell of missingInShapeCells) {
        const cellX = match3GridAreaX + cell.col * (cellSize + cellGap);
        const cellY = gridArea.y + cell.row * (cellSize + cellGap);
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 3;
        ctx.strokeRect(cellX - 2, cellY - 2, cellSize + 4, cellSize + 4);
        ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
        ctx.fillRect(cellX, cellY, cellSize, cellSize);
      }
    } else if (this.tutorialStep === 2) {
      // Turn 2: Explain targeting (AoE)
      ctx.fillText("Area of Effect (AoE)", panelX + padding, currentY);
      currentY += lineHeight * 1.2;
      ctx.font = "12px system-ui";
      ctx.fillStyle = "#9aa3b2";
      ctx.fillText("• Line matches (3+ in a row) = Single target damage", panelX + padding, currentY);
      currentY += lineHeight;
      ctx.fillText("• L or T shape matches = AoE damage to ALL enemies", panelX + padding, currentY);
      currentY += lineHeight;
      ctx.fillText("• Try to create an L or T shape in the grid!", panelX + padding, currentY);
      currentY += lineHeight * 1.2;

      // Highlight L-shape: vertical line at col 1 (rows 0-2) and horizontal at row 2 (cols 1-3)
      const requiredShapeCells = [
        { row: 0, col: 1 },
        { row: 1, col: 1 },
        { row: 2, col: 1 },
        { row: 2, col: 2 },
        { row: 2, col: 3 },
      ];
      const missingInShapeCells = [
        { row: 1, col: 2 },
        { row: 3, col: 3 },
      ];
      for (const cell of requiredShapeCells) {
        const cellX = match3GridAreaX + cell.col * (cellSize + cellGap);
        const cellY = gridArea.y + cell.row * (cellSize + cellGap);
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 3;
        ctx.strokeRect(cellX - 2, cellY - 2, cellSize + 4, cellSize + 4);
        ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
        ctx.fillRect(cellX, cellY, cellSize, cellSize);
      }
      for (const cell of missingInShapeCells) {
        const cellX = match3GridAreaX + cell.col * (cellSize + cellGap);
        const cellY = gridArea.y + cell.row * (cellSize + cellGap);
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 3;
        ctx.strokeRect(cellX - 2, cellY - 2, cellSize + 4, cellSize + 4);
        ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
        ctx.fillRect(cellX, cellY, cellSize, cellSize);
      }
    } else if (this.tutorialStep === 3) {
      // Turn 3: Explain multipliers and combos
      ctx.fillText("Multipliers & Combos", panelX + padding, currentY);
      currentY += lineHeight * 1.2;
      ctx.font = "12px system-ui";
      ctx.fillStyle = "#9aa3b2";
      ctx.fillText("• Element weapon triangles: Fire > Grass > Water > Fire", panelX + padding, currentY);
      currentY += lineHeight;
      ctx.fillText("• Matching elements deal 1.5x damage to weak elements", panelX + padding, currentY);
      currentY += lineHeight;
      ctx.fillText("• Dark and Light deal 1.5x damage to each other", panelX + padding, currentY);
      currentY += lineHeight;
      ctx.fillText("• Multiple matches in one turn create combo multipliers!", panelX + padding, currentY);
      currentY += lineHeight;
      ctx.fillText("• More combos = higher multiplier", panelX + padding, currentY);
      currentY += lineHeight;
      ctx.fillText("• Try creating a combo by making at least two matches in one turn!", panelX + padding, currentY);
    } else if (this.tutorialStep === 4) {
      // Turn 4: Explain healing
      ctx.fillText("Healing", panelX + padding, currentY);
      currentY += lineHeight * 1.2;
      ctx.font = "12px system-ui";
      ctx.fillStyle = "#9aa3b2";
      ctx.fillText("• Match Healing elements to restore HP to your units", panelX + padding, currentY);
      currentY += lineHeight;
      ctx.fillText(
        "• Healing works the same as damage, restoring HP to your unit in front",
        panelX + padding,
        currentY,
      );
      currentY += lineHeight;
      ctx.fillText("• Likewise, matching 'T' or 'L' shapes (AoE) heals all your units", panelX + padding, currentY);
      currentY += lineHeight;
      ctx.fillText("• Try to complete the Healing match shown in the grid!", panelX + padding, currentY);
      currentY += lineHeight * 1.2;

      // Highlight the specific tiles needed for the healing match
      // Grid has 2 healing elements at (4, 3) and (0, 4)
      const requiredShapeCells = [
        { row: 1, col: 1 },
        { row: 2, col: 1 },
        { row: 3, col: 1 },
        { row: 4, col: 1 },
      ];
      const missingInShapeCells = [
        { row: 4, col: 3 },
        { row: 0, col: 4 },
      ];
      for (const cell of requiredShapeCells) {
        const cellX = match3GridAreaX + cell.col * (cellSize + cellGap);
        const cellY = gridArea.y + cell.row * (cellSize + cellGap);
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 3;
        ctx.strokeRect(cellX - 2, cellY - 2, cellSize + 4, cellSize + 4);
        ctx.fillStyle = "rgba(52, 211, 153, 0.2)";
        ctx.fillRect(cellX, cellY, cellSize, cellSize);
      }
      for (const cell of missingInShapeCells) {
        const cellX = match3GridAreaX + cell.col * (cellSize + cellGap);
        const cellY = gridArea.y + cell.row * (cellSize + cellGap);
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 3;
        ctx.strokeRect(cellX - 2, cellY - 2, cellSize + 4, cellSize + 4);
        ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
        ctx.fillRect(cellX, cellY, cellSize, cellSize);
      }
    } else if (this.tutorialStep === 5) {
      // Turn 5: Explain tutorial complete
      ctx.fillText("Good job!", panelX + padding, currentY);
      currentY += lineHeight * 1.2;
      ctx.font = "12px system-ui";
      ctx.fillStyle = "#9aa3b2";
      ctx.fillText("• You've learned all the basic mechanics!", panelX + padding, currentY);
      currentY += lineHeight;
      ctx.fillText("• Now finish off the remaining enemies to complete the stage", panelX + padding, currentY);
      currentY += lineHeight;
      ctx.fillText("• Good luck!", panelX + padding, currentY);
      currentY += lineHeight * 1.2;
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  private renderConsumables(ctx: CanvasRenderingContext2D): void {
    const gridArea = BattleLayout.grid;
    const consumablesAreaX = 8; // Left of grid with some padding
    const consumablesAreaY = gridArea.y;
    const consumablesAreaH = gridArea.h;
    const consumableSize = 48;
    const consumableGap = 8;
    const maxConsumables = Math.floor(consumablesAreaH / (consumableSize + consumableGap));

    // Get consumables from inventory
    const inventory = this.state.inventory.items;
    const availableConsumables: Array<{ item: Item; count: number }> = [];

    for (const [itemId, count] of Object.entries(inventory)) {
      if (count > 0) {
        const item = this.items.find((i) => i.id === itemId);
        if (item && item.effect) {
          // Only show items with effects (consumables)
          availableConsumables.push({ item, count });
        }
      }
    }

    // Limit to max consumables that fit
    const consumablesToShow = availableConsumables.slice(0, maxConsumables);
    this.consumableRegions = [];

    // Draw each consumable
    for (let i = 0; i < consumablesToShow.length; i++) {
      const { item, count } = consumablesToShow[i];
      const consumableY = consumablesAreaY + i * (consumableSize + consumableGap);
      const consumableX = consumablesAreaX;

      // Determine if clickable (only on player turn and not during animations)
      const isClickable = this.isPlayerTurn && !this.isResolvingMatches && !this.dragState?.isDragging;

      // Draw consumable background
      ctx.fillStyle = isClickable ? "#2b2f3a" : "#1a1d24";
      ctx.fillRect(consumableX, consumableY, consumableSize, consumableSize);
      ctx.strokeStyle = isClickable ? "#3b82f6" : "#2b2f3a";
      ctx.lineWidth = isClickable ? 2 : 1;
      ctx.strokeRect(consumableX + 0.5, consumableY + 0.5, consumableSize - 1, consumableSize - 1);

      // Draw item icon
      if (item.imagePath) {
        ctx.save();
        if (!isClickable) {
          ctx.globalAlpha = 0.5; // Dim if not clickable
        }
        this.drawIcon(ctx, item.imagePath, consumableX, consumableY, consumableSize, consumableSize);
        ctx.restore();
      }

      // Draw count badge
      if (count > 1) {
        ctx.fillStyle = "#3b82f6";
        ctx.beginPath();
        const badgeSize = 16;
        const badgeX = consumableX + consumableSize - badgeSize;
        const badgeY = consumableY;
        ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "10px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(count.toString(), badgeX + badgeSize / 2, badgeY + badgeSize / 2);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }

      // Store region for click detection
      this.consumableRegions.push({
        itemId: item.id,
        region: {
          x: consumableX,
          y: consumableY,
          w: consumableSize,
          h: consumableSize,
        },
      });
    }
  }

  private renderCombatLog(ctx: CanvasRenderingContext2D): void {
    const logArea = BattleLayout.combatLog;

    // Draw background with 50% transparency to show stage background
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#1a1d24";
    ctx.fillRect(logArea.x, logArea.y, logArea.w, logArea.h);
    ctx.strokeStyle = "#2b2f3a";
    ctx.strokeRect(logArea.x + 0.5, logArea.y + 0.5, logArea.w - 1, logArea.h - 1);
    ctx.restore();

    // Draw title
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    drawTextWithShadow(ctx, "Combat Log", logArea.x + 8, logArea.y + 8, 14, "#9aa3b2");

    // Draw log entries (most recent at bottom)
    const padding = 8;
    const lineHeight = 14;
    const damageEntryHeight = lineHeight * 2 + 1; // Two lines per damage entry + spacing
    const healingEntryHeight = lineHeight * 2 + 1; // Two lines per healing entry + spacing
    const separatorEntryHeight = lineHeight + 2; // One line for separator + spacing

    // Calculate how many entries can fit
    const calculateHeight = (entries: CombatLogEntry[]) => {
      return entries.reduce((sum, entry) => {
        if (entry.type === "separator") return sum + separatorEntryHeight;
        if (entry.type === "healing") return sum + healingEntryHeight;
        return sum + damageEntryHeight;
      }, 0);
    };

    // Get the most recent entries (oldest first, newest last)
    // Start from the end and work backwards until we fill the available space
    let entriesToShow: CombatLogEntry[] = [];
    for (let i = this.combatLog.length - 1; i >= 0; i--) {
      const testEntries = [this.combatLog[i], ...entriesToShow];
      if (calculateHeight(testEntries) <= logArea.h - 28) {
        entriesToShow = testEntries;
      } else {
        break;
      }
    }

    // Calculate starting Y position to fill from bottom
    const totalHeight = calculateHeight(entriesToShow);
    const startY = logArea.y + logArea.h - totalHeight;
    let y = startY;

    for (const entry of entriesToShow) {
      if (entry.type === "separator") {
        // Render separator entry
        if (y + separatorEntryHeight > logArea.y + logArea.h) break;

        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const separatorText = `---- ROUND ${entry.round} ----`;
        drawTextWithShadow(ctx, separatorText, logArea.x + logArea.w / 2, y, 10, "#6b7280");
        ctx.textAlign = "left";

        y += separatorEntryHeight;
        continue;
      }

      if (entry.type === "healing") {
        // Render healing entry
        if (y + healingEntryHeight > logArea.y + logArea.h) break;

        // First line: Source → Target with element icons
        const iconSize = 10;
        let x = logArea.x + padding;

        // Source element icon
        if (entry.source.element) {
          const iconPath = elementIconPath(entry.source.element);
          this.drawIcon(ctx, iconPath, x, y, iconSize, iconSize);
          x += iconSize + 4;
        }

        // Source name
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const sourceName =
          entry.source.name.length > 12 ? entry.source.name.substring(0, 12) + "..." : entry.source.name;
        const sourceColor = entry.source.isPlayer ? "#3b82f6" : "#ef4444";
        drawTextWithShadow(ctx, sourceName, x, y, 10, sourceColor);
        ctx.font = "10px system-ui";
        x += ctx.measureText(sourceName).width + 6;

        // Arrow
        ctx.font = "10px system-ui";
        drawTextWithShadow(ctx, "→", x, y, 10, "#9aa3b2");
        x += ctx.measureText("→").width + 6;

        // Target element icon
        if (entry.target.element) {
          const iconPath = elementIconPath(entry.target.element);
          this.drawIcon(ctx, iconPath, x, y, iconSize, iconSize);
          x += iconSize + 4;
        }

        // Target name
        const targetColor = entry.target.isPlayer ? "#3b82f6" : "#ef4444";
        const targetName =
          entry.target.name.length > 12 ? entry.target.name.substring(0, 12) + "..." : entry.target.name;
        drawTextWithShadow(ctx, targetName, x, y, 10, targetColor);
        ctx.font = "10px system-ui";

        // Second line: Healing details
        y += lineHeight;
        if (y + lineHeight > logArea.y + logArea.h) break;

        x = logArea.x + padding;
        ctx.font = "9px system-ui";

        // Healing amount
        drawTextWithShadow(ctx, `+${entry.amount} HP`, x, y, 9, "#10b981");
        x += ctx.measureText(`+${entry.amount} HP`).width + 6;

        // Combo multiplier
        if (entry.comboMultiplier && entry.comboMultiplier > 1) {
          drawTextWithShadow(
            ctx,
            `[${entry.comboCount}x Combo: ${entry.comboMultiplier.toFixed(2)}x]`,
            x,
            y,
            9,
            "#a855f7",
          );
          x += ctx.measureText(`[${entry.comboCount}x Combo: ${entry.comboMultiplier.toFixed(2)}x]`).width + 6;
        }

        // AoE indicator
        if (entry.isAoE) {
          drawTextWithShadow(ctx, "[AoE]", x, y, 9, "#f59e0b");
          x += ctx.measureText("[AoE]").width + 6;
        }

        // HP remaining
        drawTextWithShadow(ctx, `(${entry.targetHpAfter}/${entry.targetMaxHp} HP)`, x, y, 9, "#9aa3b2");

        y += lineHeight + 1;
        continue;
      }

      // Render damage entry
      if (y + damageEntryHeight > logArea.y + logArea.h) break;

      // First line: Source → Target with element icons
      const iconSize = 10;
      let x = logArea.x + padding;

      // Source element icon
      if (entry.source.element) {
        const iconPath = elementIconPath(entry.source.element);
        this.drawIcon(ctx, iconPath, x, y, iconSize, iconSize);
        x += iconSize + 4;
      }

      // Source name
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const sourceName =
        entry.source.name.length > 12 ? entry.source.name.substring(0, 12) + "..." : entry.source.name;
      const sourceColor = entry.source.isPlayer ? "#3b82f6" : "#ef4444";
      drawTextWithShadow(ctx, sourceName, x, y, 10, sourceColor);
      ctx.font = "10px system-ui";
      x += ctx.measureText(sourceName).width + 6;

      // Arrow
      ctx.font = "10px system-ui";
      drawTextWithShadow(ctx, "→", x, y, 10, "#9aa3b2");
      x += ctx.measureText("→").width + 6;

      // Target element icon
      if (entry.target.element) {
        const iconPath = elementIconPath(entry.target.element);
        this.drawIcon(ctx, iconPath, x, y, iconSize, iconSize);
        x += iconSize + 4;
      }

      // Target name
      const targetColor = entry.target.isPlayer ? "#3b82f6" : "#ef4444";
      const targetName =
        entry.target.name.length > 12 ? entry.target.name.substring(0, 12) + "..." : entry.target.name;
      drawTextWithShadow(ctx, targetName, x, y, 10, targetColor);
      ctx.font = "10px system-ui";

      // Second line: Damage details
      y += lineHeight;
      if (y + lineHeight > logArea.y + logArea.h) break;

      x = logArea.x + padding;
      ctx.font = "9px system-ui";

      // Base damage (if different from final)
      if (entry.baseDamage !== entry.finalDamage) {
        drawTextWithShadow(ctx, `${entry.baseDamage}`, x, y, 9, "#9aa3b2");
        x += ctx.measureText(`${entry.baseDamage}`).width + 2;
        drawTextWithShadow(ctx, "×", x, y, 9, "#9aa3b2");
        x += ctx.measureText("×").width + 2;
      }

      // Multiplier
      if (entry.multiplier !== 1) {
        const multColor = entry.multiplier > 1 ? "#10b981" : "#ef4444";
        drawTextWithShadow(ctx, `${entry.multiplier.toFixed(2)}x`, x, y, 9, multColor);
        x += ctx.measureText(`${entry.multiplier.toFixed(2)}x`).width + 4;
      }

      // Combo multiplier
      if (entry.comboMultiplier && entry.comboMultiplier > 1) {
        drawTextWithShadow(
          ctx,
          `[${entry.comboCount}x Combo: ${entry.comboMultiplier.toFixed(2)}x]`,
          x,
          y,
          9,
          "#a855f7",
        );
        x += ctx.measureText(`[${entry.comboCount}x Combo: ${entry.comboMultiplier.toFixed(2)}x]`).width + 4;
      }

      // Final damage
      drawTextWithShadow(ctx, `= ${entry.finalDamage}`, x, y, 9, "#e5e7eb");
      x += ctx.measureText(`= ${entry.finalDamage}`).width + 6;

      // AoE indicator
      if (entry.isAoE) {
        drawTextWithShadow(ctx, "[AoE]", x, y, 9, "#f59e0b");
        x += ctx.measureText("[AoE]").width + 6;
      }

      // HP remaining
      drawTextWithShadow(ctx, `${entry.targetHpAfter}/${entry.targetMaxHp} HP`, x, y, 9, "#9aa3b2");

      y += lineHeight + 1; // Small spacing between entries
    }
  }

  private pointInRect(x: number, y: number, r: { x: number; y: number; w: number; h: number }): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  private clampToGridBounds(x: number, y: number): { clampedX: number; clampedY: number } {
    const gridArea = BattleLayout.grid;
    const cellGap = 6;
    const cellSize = Math.min(
      (gridArea.w - (this.gridCols - 1) * cellGap) / this.gridCols,
      (gridArea.h - (this.gridRows - 1) * cellGap) / this.gridRows,
    );

    // Calculate grid boundaries
    const totalGridWidth = this.gridCols * cellSize + (this.gridCols - 1) * cellGap;
    const totalGridHeight = this.gridRows * cellSize + (this.gridRows - 1) * cellGap;
    const gridOffsetX = (gridArea.w - totalGridWidth) / 2;
    const gridOffsetY = (gridArea.h - totalGridHeight) / 2;

    const gridLeft = gridArea.x + gridOffsetX;
    const gridRight = gridLeft + totalGridWidth;
    const gridTop = gridArea.y + gridOffsetY;
    const gridBottom = gridTop + totalGridHeight;

    // Clamp coordinates to grid boundaries
    const clampedX = Math.max(gridLeft, Math.min(gridRight, x));
    const clampedY = Math.max(gridTop, Math.min(gridBottom, y));

    return { clampedX, clampedY };
  }

  private isAdjacentToCurrentPosition(row: number, col: number): boolean {
    if (!this.dragState?.isDragging) {
      return false;
    }
    const currentRow = this.dragState.currentRow;
    const currentCol = this.dragState.currentCol;

    // Check if tile is adjacent (horizontal, vertical, or diagonal, but not the same tile)
    const rowDiff = Math.abs(row - currentRow);
    const colDiff = Math.abs(col - currentCol);
    return rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0);
  }

  private interpolateColor(color1: string, color2: string, t: number): string {
    // Parse hex colors to RGB
    const parseHex = (hex: string): [number, number, number] => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return [r, g, b];
    };

    const [r1, g1, b1] = parseHex(color1);
    const [r2, g2, b2] = parseHex(color2);

    // Interpolate
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    // Convert back to hex
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  private getGridCellAt(x: number, y: number): { row: number; col: number } | null {
    const gridArea = BattleLayout.grid;
    const cellGap = 6;
    const cellSize = Math.min(
      (gridArea.w - (this.gridCols - 1) * cellGap) / this.gridCols,
      (gridArea.h - (this.gridRows - 1) * cellGap) / this.gridRows,
    );

    const totalGridWidth = this.gridCols * cellSize + (this.gridCols - 1) * cellGap;
    const totalGridHeight = this.gridRows * cellSize + (this.gridRows - 1) * cellGap;
    const gridOffsetX = (gridArea.w - totalGridWidth) / 2;
    const gridOffsetY = (gridArea.h - totalGridHeight) / 2;

    const relativeX = x - gridArea.x - gridOffsetX;
    const relativeY = y - gridArea.y - gridOffsetY;

    // Check if point is within grid bounds
    if (relativeX < 0 || relativeY < 0 || relativeX > totalGridWidth || relativeY > totalGridHeight) {
      return null;
    }

    // Calculate which cell
    const col = Math.floor(relativeX / (cellSize + cellGap));
    const row = Math.floor(relativeY / (cellSize + cellGap));

    // Check if within cell bounds (accounting for gaps)
    const cellX = col * (cellSize + cellGap);
    const cellY = row * (cellSize + cellGap);
    if (relativeX < cellX || relativeX > cellX + cellSize || relativeY < cellY || relativeY > cellY + cellSize) {
      return null;
    }

    // Clamp to valid grid bounds
    if (row < 0 || row >= this.gridRows || col < 0 || col >= this.gridCols) {
      return null;
    }

    return { row, col };
  }
}
