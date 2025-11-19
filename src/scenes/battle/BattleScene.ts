import { loadYaml } from "../../data/loadYaml";
import type { Card, Element, StageDef, Unit, WorldDef } from "../../data/types";
import { Scene } from "../../engine/Scene";
import { GameState } from "../../state/GameState";
import { elementIconPath } from "../../ui/ElementIcons";
import { BattleLayout, CanvasSize } from "../../ui/Layouts";
import { drawPanel, drawProgressBar, drawText, drawTopBar, getTopBarButtonRegions } from "../../ui/UiPrimitives";

interface BattleEnemy {
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
  private enemies: BattleEnemy[] = [];
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
        .filter((e): e is BattleEnemy => e !== null)
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

    // Draw player HP bar
    const playerHpArea = BattleLayout.playerHp;
    const playerHpRatio = this.playerHp / this.playerMaxHp;
    drawProgressBar(
      ctx,
      playerHpArea.x,
      playerHpArea.y,
      playerHpArea.w,
      playerHpArea.h,
      playerHpRatio,
      "#10b981",
      "#23262d"
    );

    // Draw HP text
    const hpText = `${this.playerHp}/${this.playerMaxHp}`;
    ctx.font = "14px system-ui"; // Increased from 12px to 14px
    ctx.fillStyle = "#e5e7eb";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      hpText,
      playerHpArea.x + playerHpArea.w - ctx.measureText(hpText).width,
      playerHpArea.y + playerHpArea.h / 2
    );
    ctx.fillStyle = "#10b981";
    ctx.font = "16px system-ui"; // Increased heart icon size
    ctx.fillText("♥", playerHpArea.x + playerHpArea.w + 12, playerHpArea.y + playerHpArea.h / 2);
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
          const element = this.grid[row]?.[col];
          if (element) {
            const iconPath = elementIconPath(element);
            const iconSize = cellSize * 1.0; // Icon takes up 100% of cell
            const iconX = cellX + (cellSize - iconSize) / 2;
            const iconY = cellY + (cellSize - iconSize) / 2;
            this.drawIcon(ctx, iconPath, iconX, iconY, iconSize, iconSize);
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
        // TODO: Check for matches and process the move
      }
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
