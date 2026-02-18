import { resolvePath } from "../../data/loadData";
import { loadYaml } from "../../data/loadData";
import type { Card, WorldDef } from "../../data/types";
import { Assets } from "../../engine/Assets";
import { Scene } from "../../engine/Scene";
import { GameState } from "../../state/GameState";
import { elementIconPath } from "../../ui/ElementIcons";
import { CanvasSize } from "../../ui/Layouts";
import { drawPanel, drawText, drawTopBar, getTopBarButtonRegions } from "../../ui/UiPrimitives";

const assets = new Assets();
export class WorldScene extends Scene {
  private world?: WorldDef;
  private cards: Card[] = [];
  private iconCache = new Map<string, HTMLImageElement>();
  private background?: HTMLImageElement;
  private state: GameState = GameState.load();
  private currentStageIndex: number = 0; // Currently selected/viewing stage
  private stageRegions: Array<{
    stageIndex: number;
    x: number;
    y: number;
    w: number;
    h: number;
    enabled: boolean;
  }> = [];
  private backButtonRegion: {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null = null;
  private onBackToBase?: () => void;
  private onEnterBattle?: (worldId: string, stageId: string) => void;

  constructor(
    private worldId: string,
    onBackToBase?: () => void,
    onEnterBattle?: (worldId: string, stageId: string) => void,
  ) {
    super();
    this.onBackToBase = onBackToBase;
    this.onEnterBattle = onEnterBattle;
  }

  async init() {
    try {
      this.cards = await loadYaml<Card[]>("/config/cards.yaml");
      const worlds = await loadYaml<WorldDef[]>("/config/worlds.yaml");
      this.world = worlds.find((w) => w.id === this.worldId);

      if (!this.world) {
        console.error(`World not found: ${this.worldId}`);
        return;
      }

      // Units are now based on cards, so we just need cards loaded

      // Load background
      const bg = new Image();
      bg.src = resolvePath(this.world.imagePath);
      await bg.decode().catch(() => new Promise((res) => (bg.onload = () => res(undefined))));
      this.background = bg;

      // Discover world if not already discovered
      this.state.discoverWorld(this.worldId);

      // Load world progression from state
      const highestCompleted = this.state.getHighestCompletedStage(this.worldId);
      // Start at the next unlocked stage (highestCompleted + 1), or 0 if none completed
      this.currentStageIndex = highestCompleted !== undefined ? Math.max(0, highestCompleted + 1) : 0;
    } catch (error) {
      console.error("Failed to initialize WorldScene:", error);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Background
    ctx.fillStyle = "#0f1014";
    ctx.fillRect(0, 0, CanvasSize.width, CanvasSize.height);

    if (this.background) {
      ctx.drawImage(this.background, 0, 0, CanvasSize.width, CanvasSize.height);
    }

    // Top bar
    drawTopBar(ctx, CanvasSize.width, this.state, this.cards, (iconPath, x, y, w, h) =>
      this.drawIcon(ctx, iconPath, x, y, w, h),
    );

    if (!this.world) {
      drawText(ctx, "World not found", 50, 100);
      return;
    }

    // World title
    const topBarHeight = 36;
    const titleY = topBarHeight + 20;
    ctx.font = "24px system-ui";
    ctx.fillStyle = "#e5e7eb";
    ctx.fillText(this.world.name, 50, titleY);

    // World description
    if (this.world.description) {
      ctx.font = "14px system-ui";
      ctx.fillStyle = "#9aa3b2";
      ctx.fillText(this.world.description, 50, titleY + 30);
    }

    // Back button
    const backButtonX = CanvasSize.width - 120;
    const backButtonY = topBarHeight + 10;
    const backButtonW = 80;
    const backButtonH = 30;
    ctx.fillStyle = "#23262d";
    ctx.fillRect(backButtonX, backButtonY, backButtonW, backButtonH);
    ctx.strokeStyle = "#2b2f3a";
    ctx.strokeRect(backButtonX + 0.5, backButtonY + 0.5, backButtonW - 1, backButtonH - 1);
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "14px system-ui";
    ctx.fillText("Back", backButtonX + 20, backButtonY + 20);
    this.backButtonRegion = {
      x: backButtonX,
      y: backButtonY,
      w: backButtonW,
      h: backButtonH,
    };

    // Stages list (tower-like, downward progression)
    const stagesStartY = titleY + 60;
    const stageHeight = 80;
    const stageGap = 10;
    const stageX = 50;
    const stageW = CanvasSize.width - 100;

    this.stageRegions = [];

    this.world.stages.forEach((stage, index) => {
      const stageY = stagesStartY + index * (stageHeight + stageGap);
      const isUnlocked = this.state.isStageUnlocked(this.worldId, index);
      const highestCompleted = this.state.getHighestCompletedStage(this.worldId);
      const isCompleted = highestCompleted !== undefined && index <= highestCompleted;
      const isCurrent = index === this.currentStageIndex && isUnlocked;
      const isLocked = !isUnlocked;

      // Stage panel
      const bgColor = isCurrent ? "#1a2332" : isCompleted ? "#1a241a" : "#1a1a1a";
      ctx.fillStyle = bgColor;
      ctx.fillRect(stageX, stageY, stageW, stageHeight);
      ctx.strokeStyle = isCurrent ? "#3b82f6" : "#2b2f3a";
      ctx.lineWidth = isCurrent ? 2 : 1;
      ctx.strokeRect(stageX + 0.5, stageY + 0.5, stageW - 1, stageHeight - 1);

      // Stage name
      ctx.font = "18px system-ui";
      ctx.fillStyle = isLocked ? "#6b7280" : "#e5e7eb";
      ctx.fillText(stage.name, stageX + 10, stageY + 25);

      // Stage description
      if (stage.description) {
        ctx.font = "12px system-ui";
        ctx.fillStyle = isLocked ? "#4b5563" : "#9aa3b2";
        ctx.fillText(stage.description, stageX + 10, stageY + 45);
      }

      // Stage status
      let statusText = "";
      if (isCompleted) {
        statusText = "✓ Completed";
        ctx.fillStyle = "#10b981";
      } else if (isCurrent) {
        statusText = "→ Current";
        ctx.fillStyle = "#3b82f6";
      } else if (isLocked) {
        statusText = "🔒 Locked";
        ctx.fillStyle = "#6b7280";
      }
      if (statusText) {
        ctx.font = "12px system-ui";
        ctx.fillText(statusText, stageX + stageW - 100, stageY + 25);
      }

      // Units preview (show unit icons or question marks)
      const unitIconSize = 32;
      const unitGap = 5;
      const unitsStartX = stageX + 10;
      const unitsY = stageY + 55;

      stage.units.forEach((stageUnit, unitIndex) => {
        const unitX = unitsStartX + unitIndex * (unitIconSize + unitGap);

        if (isLocked) {
          // Draw question mark for locked stages
          ctx.fillStyle = "#2b2f3a";
          ctx.fillRect(unitX, unitsY, unitIconSize, unitIconSize);
          ctx.strokeStyle = "#2b2f3a";
          ctx.strokeRect(unitX + 0.5, unitsY + 0.5, unitIconSize - 1, unitIconSize - 1);

          // Draw question mark
          ctx.fillStyle = "#6b7280";
          ctx.font = "20px system-ui";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("?", unitX + unitIconSize / 2, unitsY + unitIconSize / 2);
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
        } else {
          // Draw actual unit for unlocked stages (using cards as base)
          const card = this.cards.find((c) => c.id === stageUnit.unitId);
          if (card) {
            // Get tags from stage override or default to [Enemy]
            const tags = stageUnit.tags ?? ["Enemy"];

            // Draw unit icon placeholder (small square)
            ctx.fillStyle = "#23262d";
            ctx.fillRect(unitX, unitsY, unitIconSize, unitIconSize);
            ctx.strokeStyle = "#2b2f3a";
            ctx.strokeRect(unitX + 0.5, unitsY + 0.5, unitIconSize - 1, unitIconSize - 1);

            // Draw unit image if available
            if (card.imagePath) {
              this.drawIcon(ctx, card.imagePath, unitX, unitsY, unitIconSize, unitIconSize);
            }

            // Draw element icon overlay (small, top-right)
            if (card.elements && card.elements.length > 0) {
              const elementIconSize = 12;
              const elementIconX = unitX + unitIconSize - elementIconSize - 2;
              const elementIconY = unitsY + 2;
              const iconPath = elementIconPath(card.elements[0]);
              this.drawIcon(ctx, iconPath, elementIconX, elementIconY, elementIconSize, elementIconSize);
            }

            // Boss indicator
            if (tags.includes("Boss")) {
              ctx.fillStyle = "#ef4444";
              ctx.font = "10px system-ui";
              const bossText = "👑";
              const bossTextWidth = ctx.measureText(bossText).width;
              ctx.fillText("👑", unitX + unitIconSize / 2 - bossTextWidth / 2, unitsY - 2);
            }
          }
        }
      });

      // Clickable region
      this.stageRegions.push({
        stageIndex: index,
        x: stageX,
        y: stageY,
        w: stageW,
        h: stageHeight,
        enabled: !isLocked,
      });
    });
  }

  private drawIconWithAspectRatio(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
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
    const fullPath = resolvePath(path);
    assets.loadImage(fullPath).then((img) => {
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

      // Back button
      if (this.backButtonRegion && this.pointInRect(x, y, this.backButtonRegion)) {
        if (this.onBackToBase) {
          this.onBackToBase();
        }
        return;
      }

      // Stage clicks
      for (const stageRegion of this.stageRegions) {
        if (this.pointInRect(x, y, stageRegion) && stageRegion.enabled) {
          const clickedStageIndex = stageRegion.stageIndex;
          const isUnlocked = this.state.isStageUnlocked(this.worldId, clickedStageIndex);

          if (!isUnlocked) {
            console.log(`Stage ${clickedStageIndex} is locked`);
            return;
          }

          if (clickedStageIndex === this.currentStageIndex) {
            // Enter battle for current stage
            if (this.onEnterBattle && this.world) {
              const stage = this.world.stages[clickedStageIndex];
              this.onEnterBattle(this.worldId, stage.id);
            }
          } else if (clickedStageIndex != this.currentStageIndex && isUnlocked) {
            this.currentStageIndex = clickedStageIndex;
          }
          return;
        }
      }
    }
  }

  private pointInRect(x: number, y: number, r: { x: number; y: number; w: number; h: number }): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }
}
