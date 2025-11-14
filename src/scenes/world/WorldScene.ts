import { loadYaml } from "../../data/loadYaml";
import type { Unit, WorldDef } from "../../data/types";
import { Scene } from "../../engine/Scene";
import { GameState } from "../../state/GameState";
import { elementIconPath } from "../../ui/ElementIcons";
import { CanvasSize } from "../../ui/Layouts";
import {
  drawPanel,
  drawText,
  drawTopBar,
  getTopBarButtonRegions,
} from "../../ui/UiPrimitives";

export class WorldScene extends Scene {
  private world?: WorldDef;
  private units: Unit[] = [];
  private unitsMap = new Map<string, Unit>();
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

  constructor(private worldId: string, onBackToBase?: () => void) {
    super();
    this.onBackToBase = onBackToBase;
  }

  async init() {
    try {
      // Load world
      const worlds = await loadYaml<WorldDef[]>("/config/worlds.yaml");
      this.world = worlds.find((w) => w.id === this.worldId);

      if (!this.world) {
        console.error(`World not found: ${this.worldId}`);
        return;
      }

      // Load units
      this.units = await loadYaml<Unit[]>("/config/units.yaml");
      this.unitsMap = new Map(this.units.map((u) => [u.id, u]));

      // Load background
      const bg = new Image();
      bg.src = this.world.imagePath;
      await bg
        .decode()
        .catch(() => new Promise((res) => (bg.onload = () => res(undefined))));
      this.background = bg;

      // Load world progression from state (if any)
      // For now, start at stage 0
      this.currentStageIndex = 0;
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
    drawTopBar(
      ctx,
      CanvasSize.width,
      this.state.currencies.gold,
      this.state.currencies.plovmand,
      (iconPath, x, y, w, h) => this.drawIcon(ctx, iconPath, x, y, w, h)
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
    ctx.strokeRect(
      backButtonX + 0.5,
      backButtonY + 0.5,
      backButtonW - 1,
      backButtonH - 1
    );
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
      const isCompleted = index < this.currentStageIndex;
      const isCurrent = index === this.currentStageIndex;
      const isLocked = index > this.currentStageIndex;

      // Stage panel
      const bgColor = isCurrent
        ? "#1a2332"
        : isCompleted
        ? "#1a241a"
        : "#1a1a1a";
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

      // Units preview (show unit icons)
      const unitIconSize = 32;
      const unitGap = 5;
      const unitsStartX = stageX + 10;
      const unitsY = stageY + 55;

      stage.units.forEach((stageUnit, unitIndex) => {
        const unit = this.unitsMap.get(stageUnit.unitId);
        if (unit) {
          const unitX = unitsStartX + unitIndex * (unitIconSize + unitGap);
          // Draw unit icon placeholder (small square)
          ctx.fillStyle = isLocked ? "#2b2f3a" : "#23262d";
          ctx.fillRect(unitX, unitsY, unitIconSize, unitIconSize);
          ctx.strokeStyle = "#2b2f3a";
          ctx.strokeRect(
            unitX + 0.5,
            unitsY + 0.5,
            unitIconSize - 1,
            unitIconSize - 1
          );

          // Draw unit image if available
          if (unit.imagePath) {
            this.drawIcon(
              ctx,
              unit.imagePath,
              unitX,
              unitsY,
              unitIconSize,
              unitIconSize
            );
          }

          // Draw element icon overlay (small, top-right)
          if (unit.elements && unit.elements.length > 0) {
            const elementIconSize = 12;
            const elementIconX = unitX + unitIconSize - elementIconSize - 2;
            const elementIconY = unitsY + 2;
            const iconPath = elementIconPath(unit.elements[0]);
            this.drawIcon(
              ctx,
              iconPath,
              elementIconX,
              elementIconY,
              elementIconSize,
              elementIconSize
            );
          }

          // Boss indicator
          if (unit.tags.includes("Boss")) {
            ctx.fillStyle = "#ef4444";
            ctx.font = "10px system-ui";
            ctx.fillText("BOSS", unitX, unitsY - 2);
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

  private async getIcon(path: string): Promise<HTMLImageElement> {
    if (this.iconCache.has(path)) return this.iconCache.get(path)!;
    const img = new Image();
    img.src = path;
    await img
      .decode()
      .catch(() => new Promise((res) => (img.onload = () => res(undefined))));
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

  private drawIcon(
    ctx: CanvasRenderingContext2D,
    path: string,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
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

      // Back button
      if (
        this.backButtonRegion &&
        this.pointInRect(x, y, this.backButtonRegion)
      ) {
        if (this.onBackToBase) {
          this.onBackToBase();
        }
        return;
      }

      // Stage clicks
      for (const stageRegion of this.stageRegions) {
        if (this.pointInRect(x, y, stageRegion) && stageRegion.enabled) {
          console.log(
            `Clicked stage ${stageRegion.stageIndex}: ${
              this.world?.stages[stageRegion.stageIndex].name
            }`
          );
          // TODO: Navigate to battle scene with this stage
          // For now, just update current stage if clicking ahead
          if (stageRegion.stageIndex === this.currentStageIndex) {
            // Enter battle
            console.log("Entering battle...");
          } else if (stageRegion.stageIndex < this.currentStageIndex) {
            // View completed stage
            this.currentStageIndex = stageRegion.stageIndex;
          }
          return;
        }
      }
    }
  }

  private pointInRect(
    x: number,
    y: number,
    r: { x: number; y: number; w: number; h: number }
  ): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }
}
