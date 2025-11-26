import { applyDamageToEnemies, computeDamageFromMatches } from "../../battle/Damage";
import { findMatches, type Match } from "../../battle/MatchLogic";
import { loadYaml } from "../../data/loadYaml";
import type { Card, Element, StageDef, Unit, WorldDef } from "../../data/types";
import { Scene } from "../../engine/Scene";
import { GameState } from "../../state/GameState";
import { elementIconPath } from "../../ui/ElementIcons";
import { BattleLayout, CanvasSize } from "../../ui/Layouts";
import { drawPanel, drawProgressBar, drawText, drawTopBar, getTopBarButtonRegions } from "../../ui/UiPrimitives";

interface BattleUnit {
  unit: Unit;
  currentHp: number;
  maxHp: number;
  position: number; // 0-3, left to right
}

export class BattleScene extends Scene {
  private stage?: StageDef;
  private world?: WorldDef;
  private cards: Card[] = [];
  private units: Unit[] = [];
  private unitsMap = new Map<string, Unit>();
  private iconCache = new Map<string, HTMLImageElement>();
  private state: GameState = GameState.load();
  private enemies: BattleUnit[] = [];
  private playerHp: number = 100;
  private playerMaxHp: number = 100;
  private timer: number = 1.0; // 0.0 to 1.0
  private isPlayerTurn: boolean = true;
  private onBackToWorld?: () => void;
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
  private currentMatchIndex = 0; // Index of the current match being animated

  constructor(private worldId: string, private stageId: string, onBackToWorld?: () => void) {
    super();
    this.onBackToWorld = onBackToWorld;
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

      // Load cards and units
      this.cards = await loadYaml<Card[]>("/config/cards.yaml");
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

      // Initialize player HP based on loadout (simplified for now)
      const loadout = this.state.loadout;
      let totalHp = 0;
      if (loadout.leader) {
        const leaderCard = this.cards.find((c) => c.id === loadout.leader);
        if (leaderCard) totalHp += leaderCard.hp;
      }
      loadout.members.forEach((memberId) => {
        if (memberId) {
          const memberCard = this.cards.find((c) => c.id === memberId);
          if (memberCard) totalHp += memberCard.hp;
        }
      });
      this.playerMaxHp = totalHp || 100;
      this.playerHp = this.playerMaxHp;

      // Initialize and populate the match3 grid
      this.initializeGrid();
      this.populateGrid();
    } catch (error) {
      console.error("Failed to initialize BattleScene:", error);
    }
  }

  update(dt: number): void {
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

  render(ctx: CanvasRenderingContext2D): void {
    // Background
    ctx.fillStyle = "#0f1014";
    ctx.fillRect(0, 0, CanvasSize.width, CanvasSize.height);

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
    const loadoutCardIds = [loadout.leader, ...loadout.members].filter(Boolean);
    const loadoutCards = loadoutCardIds
      .map((id) => this.cards.find((c) => c.id === id))
      .filter((card): card is Card => card !== undefined);

    loadoutCards.forEach((card, index) => {
      const slotX = playerUnitArea.x + index * playerUnitSlotWidth;
      const unitX = slotX + (playerUnitSlotWidth - playerUnitSize) / 2;
      const unitY = playerUnitArea.y + (playerUnitArea.h - playerUnitSize) / 2;

      // Draw card background
      ctx.fillStyle = index === 0 ? "#3b82f6" : "#23262d"; // Leader has blue background
      ctx.fillRect(unitX, unitY, playerUnitSize, playerUnitSize);
      ctx.strokeStyle = index === 0 ? "#60a5fa" : "#2b2f3a";
      ctx.strokeRect(unitX + 0.5, unitY + 0.5, playerUnitSize - 1, playerUnitSize - 1);

      // Draw card image
      if (card.imagePath) {
        this.drawIcon(ctx, card.imagePath, unitX, unitY, playerUnitSize, playerUnitSize);
      }

      // Draw element icon overlay (small, top-right)
      if (card.elements && card.elements.length > 0) {
        const elementIconSize = 24;
        const elementIconX = unitX + playerUnitSize - elementIconSize - 6;
        const elementIconY = unitY + 6;
        const iconPath = elementIconPath(card.elements[0]);
        this.drawIcon(ctx, iconPath, elementIconX, elementIconY, elementIconSize, elementIconSize);
      }

      // Draw "Leader" text above leader slot
      if (index === 0) {
        ctx.fillStyle = "#9aa3b2";
        ctx.font = "12px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText("Leader", unitX + playerUnitSize / 2, unitY - 12);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }
    });

    // Draw player unit HP bars
    const playerUnitHpArea = BattleLayout.playerUnitHp;
    const playerUnitHpSlotWidth = playerUnitHpArea.w / 4;
    const playerUnitHpBarHeight = 20;
    const playerUnitHpBarWidth = playerUnitHpSlotWidth - playerUnitGap * 2;

    loadoutCards.forEach((card, index) => {
      const slotX = playerUnitHpArea.x + index * playerUnitHpSlotWidth;
      const hpBarX = slotX + playerUnitGap;
      const hpBarY = playerUnitHpArea.y + (playerUnitHpArea.h - playerUnitHpBarHeight) / 2;

      // For now, use full HP (could track individual unit HP later)
      const hpRatio = 1.0; // card.hp / card.hp

      drawProgressBar(ctx, hpBarX, hpBarY, playerUnitHpBarWidth, playerUnitHpBarHeight, hpRatio, "#10b981", "#23262d");

      // Draw HP text
      const hpText = `${card.hp}/${card.hp}`;
      ctx.font = "12px system-ui";
      ctx.fillStyle = "#e5e7eb";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(hpText, hpBarX + playerUnitHpBarWidth / 2, hpBarY + playerUnitHpBarHeight / 2);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    });

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
      if (enemy.unit.elements && enemy.unit.elements.length > 0) {
        const elementIconSize = 24; // Increased from 16 to 24 for larger enemies
        const elementIconX = enemyX + enemySize - elementIconSize - 6;
        const elementIconY = enemyY + 6;
        const iconPath = elementIconPath(enemy.unit.elements[0]);
        this.drawIcon(ctx, iconPath, elementIconX, elementIconY, elementIconSize, elementIconSize);
      }

      // Boss indicator
      if (enemy.unit.tags.includes("Boss")) {
        ctx.fillStyle = "#ef4444";
        ctx.font = "14px system-ui"; // Increased from 10px to 14px
        ctx.fillText("BOSS", enemyX, enemyY - 4);
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
      ctx.font = "12px system-ui"; // Increased from 10px to 12px
      ctx.fillStyle = "#e5e7eb";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${enemy.currentHp}/${enemy.maxHp}`, hpBarX + enemyHpBarWidth / 2, hpBarY + enemyHpBarHeight / 2);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    });

    // Draw timer bar
    const timerArea = BattleLayout.timer;
    drawProgressBar(ctx, timerArea.x, timerArea.y, timerArea.w, timerArea.h, this.timer, "#3b82f6", "#23262d");

    const timerText = "⧗";
    ctx.font = "16px system-ui"; // Increased from 12px to 16px
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(timerText, timerArea.x + timerArea.w + 12, timerArea.y + timerArea.h / 2);
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
    ctx.font = "18px system-ui"; // Increased from 14px to 18px
    ctx.fillStyle = this.isPlayerTurn ? "#3b82f6" : "#ef4444";
    ctx.fillText(turnText, 24, topBarHeight + 24); // Adjusted position

    // Draw retreat button
    const retreatButtonX = CanvasSize.width - 120; // Adjusted for larger button
    const retreatButtonY = topBarHeight + 12;
    const retreatButtonW = 100; // Increased from 80 to 100
    const retreatButtonH = 36; // Increased from 30 to 36
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(retreatButtonX, retreatButtonY, retreatButtonW, retreatButtonH);
    ctx.strokeStyle = "#991b1b";
    ctx.strokeRect(retreatButtonX + 0.5, retreatButtonY + 0.5, retreatButtonW - 1, retreatButtonH - 1);
    ctx.fillStyle = "#ffffff";
    ctx.font = "16px system-ui"; // Increased from 14px to 16px
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Retreat", retreatButtonX + retreatButtonW / 2, retreatButtonY + retreatButtonH / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    this.retreatButtonRegion = {
      x: retreatButtonX,
      y: retreatButtonY,
      w: retreatButtonW,
      h: retreatButtonH,
    };
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
    }

    if (e.type === "scene-mousedown") {
      const { x, y } = (e as CustomEvent).detail as { x: number; y: number };

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
        this.dragState = null;

        const convertedGrid: string[][] = this.grid.map((row) => row.map((cell) => cell || ""));
        const matches = findMatches(convertedGrid);
        if (matches.length > 0) {
          console.log(`Found ${matches.length} match(es)`, matches);

          // Clear matched tiles, cascade, and resolve all matches
          // This will also calculate and apply damage for all matches including cascades
          this.resolveAllMatches();
        }
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
    this.currentMatchIndex = 0;
    this.cascadeDelayTimer = 0;
    this.findAndStartNextMatch();
  }

  private findAndStartNextMatch() {
    const convertedGrid: string[][] = this.grid.map((row) => row.map((cell) => cell || ""));
    const matches = findMatches(convertedGrid);

    if (matches.length === 0) {
      // No more matches, we're done
      this.isResolvingMatches = false;
      this.pendingMatches = [];
      this.currentMatchIndex = 0;
      this.cascadeDelayTimer = 0;
      return;
    }

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

    const matches = this.pendingMatches;

    // Tiles are already cleared when animations started, so we just cascade and refill
    // Calculate and apply damage for this cascade
    const damageInstances = computeDamageFromMatches(matches, this.state.loadout, this.cards);
    if (damageInstances.length > 0) {
      this.enemies = applyDamageToEnemies(damageInstances, this.enemies);
      console.log("Applied damage from cascade", damageInstances);
    }

    // Start refill animations (will call findAndStartNextMatch when complete)
    this.compactAndRefill();
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
