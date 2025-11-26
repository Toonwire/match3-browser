import {
  applyDamageToEnemies,
  computeDamageFromMatches,
  computeHealingFromMatches,
  applyHealingToPlayerUnits,
  elementalMultiplier,
} from "../../battle/Damage";
import { findMatches, type Match } from "../../battle/MatchLogic";
import { loadYaml } from "../../data/loadYaml";
import { resolveLootConfig } from "../../data/loot";
import type { Card, Element, LootEntry, LootTable, StageDef, Unit, WorldDef } from "../../data/types";
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
    }
  | {
      type: "healing";
      source: { name: string; isPlayer: boolean; element?: Element };
      target: { name: string; isPlayer: boolean; element?: Element };
      amount: number;
      isAoE: boolean;
      targetHpAfter: number;
      targetMaxHp: number;
    }
  | {
      type: "separator";
      round: number;
    };

export class BattleScene extends Scene {
  private stage?: StageDef;
  private world?: WorldDef;
  private cards: Card[] = [];
  private items: Array<{ id: string; name: string; imagePath?: string }> = [];
  private units: Unit[] = [];
  private unitsMap = new Map<string, Unit>();
  private iconCache = new Map<string, HTMLImageElement>();
  private background?: HTMLImageElement;
  private state: GameState = GameState.load();
  private enemies: BattleUnit[] = [];
  private playerUnits: BattleUnit[] = []; // Player loadout units (leader + members)
  private timer: number = 1.0; // 0.0 to 1.0
  private readonly dragTimerDuration = 5.0; // seconds
  private dragTimerRemaining: number = 0.0; // seconds remaining
  private isPlayerTurn: boolean = true;
  private onBackToWorld?: () => void;
  private onBackToBase?: () => void;
  private isDefeated: boolean = false;
  private isVictorious: boolean = false;
  private victoryLoot: Array<{
    type: "gold" | "card" | "item";
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
  private popAnimations: Map<string, { progress: number; element: Element }> = new Map(); // Key: "row,col", Value: { progress, element }
  private readonly popAnimationDuration = 0.3; // seconds
  private readonly cascadeDelay = 0.5; // seconds delay before cascade starts
  private cascadeDelayTimer = 0.0; // Current delay timer
  private refillAnimations: Map<string, { progress: number; element: Element }> = new Map(); // Key: "row,col", Value: { progress, element }
  private readonly refillAnimationDuration = 0.15; // seconds
  private isResolvingMatches = false;
  private pendingMatches: Match[] = [];
  private accumulatedMatches: Match[] = []; // All matches across all cascades in current resolution
  private currentMatchIndex = 0; // Index of the current match being animated
  private combatLog: CombatLogEntry[] = [];
  private readonly maxCombatLogEntries = 20; // Maximum number of log entries to keep
  private currentRound: number = 1;

  constructor(
    private worldId: string,
    private stageId: string,
    onBackToWorld?: () => void,
    onBackToBase?: () => void
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
        bg.src = this.stage.imagePath;
        await bg.decode().catch(() => new Promise((res) => (bg.onload = () => res(undefined))));
        this.background = bg;
      }

      // Load cards, items, and units
      this.cards = await loadYaml<Card[]>("/config/cards.yaml");
      this.items = await loadYaml<Array<{ id: string; name: string; imagePath?: string }>>("/config/items.yaml");
      this.units = await loadYaml<Unit[]>("/config/units.yaml");
      this.unitsMap = new Map(this.units.map((u) => [u.id, u]));

      // Initialize enemies from stage units
      this.enemies = this.stage.units
        .map((stageUnit) => {
          const unit = this.unitsMap.get(stageUnit.unitId);
          if (!unit) return null;
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

      // Initialize and populate the match3 grid
      this.initializeGrid();
      this.populateGrid();

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

    // Update pop animations
    const keysToRemove: string[] = [];
    for (const [key, animData] of this.popAnimations.entries()) {
      const newProgress = animData.progress + dt / this.popAnimationDuration;
      if (newProgress >= 1.0) {
        keysToRemove.push(key);
      } else {
        this.popAnimations.set(key, { progress: newProgress, element: animData.element });
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

  private drawUnitElementIcons(
    ctx: CanvasRenderingContext2D,
    elements: Element[],
    unitX: number,
    unitY: number,
    unitSize: number
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

  render(ctx: CanvasRenderingContext2D): void {
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
      this.drawIcon(ctx, iconPath, x, y, w, h)
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

      // Draw card image
      if (card.imagePath) {
        this.drawIcon(ctx, card.imagePath, unitX, unitY, playerUnitSize, playerUnitSize);
      }

      // Draw element icon overlay (small, top-right)
      this.drawUnitElementIcons(ctx, card.elements, unitX, unitY, playerUnitSize);

      // Draw "Leader" text above leader slot
      if (slotIndex === 0) {
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        drawTextWithShadow(ctx, "Leader", unitX + playerUnitSize / 2, unitY - 12, 12, "#9aa3b2");
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }
    });

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
        "#e5e7eb"
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

      // Draw enemy image
      if (enemy.unit.imagePath) {
        this.drawIcon(ctx, enemy.unit.imagePath, enemyX, enemyY, enemySize, enemySize);
      }

      // Draw element icon overlay (small, top-right)
      this.drawUnitElementIcons(ctx, enemy.unit.elements || [], enemyX, enemyY, enemySize);

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
        "#e5e7eb"
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
    const attackerIconX = centerX - attackerIconSize / 2;
    const attackerIconY = centerY - attackerIconSize / 2;

    // Draw icon with arrow pointing based on whose turn it is
    ctx.fillStyle = "#e5e7eb";
    ctx.font = `${attackerIconSize}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const text = "⚔";
    // ctx.fillText(text, attackerIconX + attackerIconSize / 2, attackerIconY + attackerIconSize / 2);
    drawTextWithShadow(
      ctx,
      text,
      attackerIconX + attackerIconSize / 2,
      attackerIconY + attackerIconSize / 2,
      attackerIconSize,
      "#9aa3b2"
    );

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
      (gridArea.h - (this.gridRows - 1) * cellGap) / this.gridRows
    );

    // Calculate total grid width and height
    const totalGridWidth = this.gridCols * cellSize + (this.gridCols - 1) * cellGap;
    const totalGridHeight = this.gridRows * cellSize + (this.gridRows - 1) * cellGap;

    // Calculate offsets to center the grid
    const gridOffsetX = (gridArea.w - totalGridWidth) / 2;
    const gridOffsetY = (gridArea.h - totalGridHeight) / 2;

    // Draw grid background
    ctx.fillStyle = "#1a1d24";
    ctx.fillRect(gridArea.x, gridArea.y, gridArea.w, gridArea.h);
    ctx.strokeStyle = "#2b2f3a";
    ctx.strokeRect(gridArea.x + 0.5, gridArea.y + 0.5, gridArea.w - 1, gridArea.h - 1);

    // Draw grid cells with element icons
    for (let row = 0; row < this.gridRows; row++) {
      for (let col = 0; col < this.gridCols; col++) {
        const cellX = gridArea.x + gridOffsetX + col * (cellSize + cellGap);
        const cellY = gridArea.y + gridOffsetY + row * (cellSize + cellGap);

        // Draw cell background
        ctx.fillStyle = "#23262d";
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

            // Calculate animation values
            // Scale: goes from 1.0 to 1.3 then back to 1.0
            const scalePhase =
              popAnimData.progress < 0.5
                ? popAnimData.progress * 2 // 0 to 1
                : 1 - (popAnimData.progress - 0.5) * 2; // 1 to 0
            const scale = 1.0 + scalePhase * 0.3;

            // Opacity: fades out in the second half
            const opacity = popAnimData.progress < 0.5 ? 1.0 : 1.0 - (popAnimData.progress - 0.5) * 2;

            // Apply transformations
            const centerX = cellX + cellSize / 2;
            const centerY = cellY + cellSize / 2;
            ctx.translate(centerX, centerY);
            ctx.scale(scale, scale);
            ctx.globalAlpha = opacity;

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
        (gridArea.h - (this.gridRows - 1) * cellGap) / this.gridRows
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

    // Draw turn indicator
    const turnText = this.isPlayerTurn ? "Your Turn" : "Enemy Turn";
    const turnColor = this.isPlayerTurn ? "#3b82f6" : "#ef4444";
    drawTextWithShadow(ctx, turnText, 24, topBarHeight + 24, 18, turnColor);

    // Draw combat log
    this.renderCombatLog(ctx);

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
      "#ffffff"
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
  }

  private async getIcon(path: string): Promise<HTMLImageElement> {
    if (this.iconCache.has(path)) return this.iconCache.get(path)!;
    const img = new Image();
    img.src = path;
    await img.decode().catch(() => new Promise((res) => (img.onload = () => res(undefined))));
    this.iconCache.set(path, img);
    return img;
  }

  private drawIconWithAspectRatio(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
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
  }

  private drawIcon(ctx: CanvasRenderingContext2D, path: string, x: number, y: number, w: number, h: number) {
    const cached = this.iconCache.get(path);
    if (cached) {
      this.drawIconWithAspectRatio(ctx, cached, x, y, w, h);
      return;
    }
    this.getIcon(path).then(() => {
      const img = this.iconCache.get(path)!;
      this.drawIconWithAspectRatio(ctx, img, x, y, w, h);
    });
  }

  onEvent(e: Event): void {
    if (e.type === "scene-click") {
      const { x, y } = (e as CustomEvent).detail as { x: number; y: number };

      // Top bar Save/Load
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
    }

    if (e.type === "scene-mousedown") {
      const { x, y } = (e as CustomEvent).detail as { x: number; y: number };

      // Don't allow interactions if defeated or victorious
      if (this.isDefeated || this.isVictorious) {
        return;
      }

      // Don't start dragging if clicking on UI elements
      const buttonRegions = getTopBarButtonRegions(CanvasSize.width);
      if (this.pointInRect(x, y, buttonRegions.save) || this.pointInRect(x, y, buttonRegions.load)) {
        return;
      }
      if (this.retreatButtonRegion && this.pointInRect(x, y, this.retreatButtonRegion)) {
        return;
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

    // Stop dragging
    this.dragState = null;
    this.dragTimerRemaining = 0.0;

    const convertedGrid: string[][] = this.grid.map((row) => row.map((cell) => cell || ""));
    const matches = findMatches(convertedGrid);
    if (matches.length > 0) {
      console.log(`Found ${matches.length} match(es)`, matches);

      // Clear matched tiles, cascade, and resolve all matches
      // This will also calculate and apply damage for all matches including cascades
      this.resolveAllMatches();
    } else {
      // No matches found, player turn is complete - trigger enemy turn
      if (this.isPlayerTurn) {
        this.startEnemyTurn();
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
            string
          ],
        };

        // Compute and apply damage
        const damageInstances = computeDamageFromMatches(this.accumulatedMatches, filteredLoadout, this.cards);
        if (damageInstances.length > 0) {
          this.applyDamageToEnemiesWithLogging(damageInstances);
          // Check for victory after damage
          this.checkForVictory();
        }

        // Compute and apply healing
        const healingInstances = computeHealingFromMatches(this.accumulatedMatches);
        if (healingInstances.length > 0) {
          this.applyHealingToPlayerUnitsWithLogging(healingInstances);
        }
      }

      // Clear accumulated matches
      this.accumulatedMatches = [];

      // If it was player turn, switch to enemy turn
      if (this.isPlayerTurn) {
        this.startEnemyTurn();
      }

      return;
    }

    // Add matches to accumulated list for damage calculation
    this.accumulatedMatches.push(...matches);

    // Store all matches for this round
    this.pendingMatches = matches;
    this.currentMatchIndex = 0;
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
        // Store animation with element for rendering
        this.popAnimations.set(animationKey, { progress: 0.0, element });
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

  private applyDamageToEnemiesWithLogging(damageInstances: ReturnType<typeof computeDamageFromMatches>): void {
    // Apply damage similar to applyDamageToEnemies but with logging
    for (const damage of damageInstances) {
      // Get source card name(s) for logging
      const sourceCardNames = damage.cardIds
        .map((id) => this.cards.find((c) => c.id === id)?.name)
        .filter(Boolean)
        .join(", ");

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
            enemy.currentHp = Math.max(0, enemy.currentHp - finalDamage);

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
            });
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
          leftmostAlive.currentHp = Math.max(0, leftmostAlive.currentHp - finalDamage);

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
          });
        }
      }
    }
  }

  private applyHealingToPlayerUnitsWithLogging(healingInstances: ReturnType<typeof computeHealingFromMatches>): void {
    // Apply healing similar to applyHealingToPlayerUnits but with logging
    for (const healing of healingInstances) {
      if (healing.isAoE) {
        // AoE: Apply to all alive player units
        for (const unit of this.playerUnits) {
          if (unit.currentHp > 0) {
            const hpBefore = unit.currentHp;
            unit.currentHp = Math.min(unit.maxHp, unit.currentHp + healing.amount);
            const actualHealing = unit.currentHp - hpBefore;

            if (actualHealing > 0) {
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
              });
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
          rightmostAlive.currentHp = Math.min(rightmostAlive.maxHp, rightmostAlive.currentHp + healing.amount);
          const actualHealing = rightmostAlive.currentHp - hpBefore;

          if (actualHealing > 0) {
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
            });
          }
        }
      }
    }
  }

  private startEnemyTurn(): void {
    // Switch to enemy turn
    this.isPlayerTurn = false;

    // Apply damage from all alive enemies to player units
    const aliveEnemies = this.enemies.filter((e) => e.currentHp > 0);

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

        // Apply damage
        const hpBefore = rightmostAlivePlayer.currentHp;
        rightmostAlivePlayer.currentHp = Math.max(0, rightmostAlivePlayer.currentHp - finalDamage);

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
      }
    }

    // Check if all player units are dead
    const alivePlayerUnits = this.playerUnits.filter((unit) => unit.currentHp > 0);
    if (alivePlayerUnits.length === 0) {
      this.isDefeated = true;
      console.log("All player units defeated");
      return;
    }

    // Switch back to player turn
    this.isPlayerTurn = true;

    // Start new round
    this.currentRound++;
    this.addCombatLogEntry({ type: "separator", round: this.currentRound });

    console.log("Enemy turn complete, switching back to player turn");
  }

  private checkForVictory(): void {
    // Check if all enemies are dead
    const aliveEnemies = this.enemies.filter((e) => e.currentHp > 0);
    if (aliveEnemies.length === 0 && !this.isVictorious && !this.isDefeated) {
      this.isVictorious = true;
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
      type: "gold" | "card" | "item";
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
        this.state.completeStage(this.worldId, stageIndex);
      }
    }

    // Save state
    this.state.save();

    // Store rolled loot for display
    this.victoryLoot = rolledLoot;
  }

  private renderCombatLog(ctx: CanvasRenderingContext2D): void {
    const logArea = BattleLayout.combatLog;

    // Draw background
    ctx.fillStyle = "#1a1d24";
    ctx.fillRect(logArea.x, logArea.y, logArea.w, logArea.h);
    ctx.strokeStyle = "#2b2f3a";
    ctx.strokeRect(logArea.x + 0.5, logArea.y + 0.5, logArea.w - 1, logArea.h - 1);

    // Draw title
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "14px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Combat Log", logArea.x + 8, logArea.y + 8);

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

        ctx.fillStyle = "#6b7280";
        ctx.font = "10px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const separatorText = `---- ROUND ${entry.round} ----`;
        ctx.fillText(separatorText, logArea.x + logArea.w / 2, y);
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
        ctx.fillStyle = entry.source.isPlayer ? "#3b82f6" : "#ef4444";
        ctx.font = "10px system-ui";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const sourceName =
          entry.source.name.length > 12 ? entry.source.name.substring(0, 12) + "..." : entry.source.name;
        ctx.fillText(sourceName, x, y);
        x += ctx.measureText(sourceName).width + 6;

        // Arrow
        ctx.fillStyle = "#9aa3b2";
        ctx.fillText("→", x, y);
        x += 12;

        // Target element icon
        if (entry.target.element) {
          const iconPath = elementIconPath(entry.target.element);
          this.drawIcon(ctx, iconPath, x, y, iconSize, iconSize);
          x += iconSize + 4;
        }

        // Target name
        ctx.fillStyle = entry.target.isPlayer ? "#3b82f6" : "#ef4444";
        const targetName =
          entry.target.name.length > 12 ? entry.target.name.substring(0, 12) + "..." : entry.target.name;
        ctx.fillText(targetName, x, y);

        // Second line: Healing details
        y += lineHeight;
        if (y + lineHeight > logArea.y + logArea.h) break;

        x = logArea.x + padding;
        ctx.fillStyle = "#10b981"; // Green color for healing
        ctx.font = "9px system-ui";

        // Healing amount
        ctx.fillText(`+${entry.amount} HP`, x, y);
        x += ctx.measureText(`+${entry.amount} HP`).width + 6;

        // AoE indicator
        if (entry.isAoE) {
          ctx.fillStyle = "#f59e0b";
          ctx.fillText("[AoE]", x, y);
          x += ctx.measureText("[AoE]").width + 6;
        }

        // HP remaining
        ctx.fillStyle = "#9aa3b2";
        ctx.fillText(`(${entry.targetHpAfter}/${entry.targetMaxHp} HP)`, x, y);

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
      ctx.fillStyle = entry.source.isPlayer ? "#3b82f6" : "#ef4444";
      ctx.font = "10px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const sourceName =
        entry.source.name.length > 12 ? entry.source.name.substring(0, 12) + "..." : entry.source.name;
      ctx.fillText(sourceName, x, y);
      x += ctx.measureText(sourceName).width + 6;

      // Arrow
      ctx.fillStyle = "#9aa3b2";
      ctx.fillText("→", x, y);
      x += 12;

      // Target element icon
      if (entry.target.element) {
        const iconPath = elementIconPath(entry.target.element);
        this.drawIcon(ctx, iconPath, x, y, iconSize, iconSize);
        x += iconSize + 4;
      }

      // Target name
      ctx.fillStyle = entry.target.isPlayer ? "#3b82f6" : "#ef4444";
      const targetName =
        entry.target.name.length > 12 ? entry.target.name.substring(0, 12) + "..." : entry.target.name;
      ctx.fillText(targetName, x, y);

      // Second line: Damage details
      y += lineHeight;
      if (y + lineHeight > logArea.y + logArea.h) break;

      x = logArea.x + padding;
      ctx.fillStyle = "#9aa3b2";
      ctx.font = "9px system-ui";

      // Base damage (if different from final)
      if (entry.baseDamage !== entry.finalDamage) {
        ctx.fillText(`${entry.baseDamage}`, x, y);
        x += ctx.measureText(`${entry.baseDamage}`).width + 2;
        ctx.fillText("×", x, y);
        x += ctx.measureText("×").width + 2;
      }

      // Multiplier
      if (entry.multiplier !== 1) {
        const multColor = entry.multiplier > 1 ? "#10b981" : "#ef4444";
        ctx.fillStyle = multColor;
        ctx.fillText(`${entry.multiplier.toFixed(2)}x`, x, y);
        x += ctx.measureText(`${entry.multiplier.toFixed(2)}x`).width + 4;
      }

      // Final damage
      ctx.fillStyle = "#e5e7eb";
      ctx.fillText(`= ${entry.finalDamage}`, x, y);
      x += ctx.measureText(`= ${entry.finalDamage}`).width + 6;

      // AoE indicator
      if (entry.isAoE) {
        ctx.fillStyle = "#f59e0b";
        ctx.fillText("[AoE]", x, y);
        x += ctx.measureText("[AoE]").width + 6;
      }

      // HP remaining
      ctx.fillStyle = "#9aa3b2";
      ctx.fillText(`${entry.targetHpAfter}/${entry.targetMaxHp} HP`, x, y);

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
      (gridArea.h - (this.gridRows - 1) * cellGap) / this.gridRows
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

  private getGridCellAt(x: number, y: number): { row: number; col: number } | null {
    const gridArea = BattleLayout.grid;
    const cellGap = 6;
    const cellSize = Math.min(
      (gridArea.w - (this.gridCols - 1) * cellGap) / this.gridCols,
      (gridArea.h - (this.gridRows - 1) * cellGap) / this.gridRows
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
