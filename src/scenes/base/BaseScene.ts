import { loadYaml } from "../../data/loadYaml";
import type { Card, WorldDef } from "../../data/types";
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
import { renderArmoryPanel } from "./ArmoryPanel";
import { renderShopPanel } from "./ShopPanel";
import { renderWorldsPanel } from "./WorldsPanel";

export class BaseScene extends Scene {
  private cards: Card[] = [];
  private worlds: WorldDef[] = [];
  private iconCache = new Map<string, HTMLImageElement>();
  private activePopup: "shop" | "armory" | "worlds" | null = null;
  private background?: HTMLImageElement;
  private state: GameState = GameState.load();

  private shopPoly = [
    { x: 15, y: 85 },
    { x: 120, y: 85 },
    { x: 120, y: 255 },
    { x: 15, y: 255 },
  ];
  private armoryPoly = [
    { x: 555, y: 85 },
    { x: 755, y: 85 },
    { x: 755, y: 255 },
    { x: 555, y: 255 },
  ];
  private worldsPoly = [
    { x: 310, y: 520 },
    { x: 500, y: 520 },
    { x: 500, y: 585 },
    { x: 310, y: 585 },
  ];

  async init() {
    try {
      this.cards = await loadYaml<Card[]>("/config/cards.yaml");
      this.worlds = await loadYaml<WorldDef[]>("/config/worlds.yaml");
      const bg = new Image();
      bg.src = "/assets/backgrounds/base_background.png";
      await bg
        .decode()
        .catch(() => new Promise((res) => (bg.onload = () => res(undefined))));
      this.background = bg;
    } catch {}
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
      this.state.currencies.plovmand
    );

    // Active popup overlay
    if (this.activePopup) this.renderPopup(ctx, this.activePopup);
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
      ctx.drawImage(cached, x, y, w, h);
      return;
    }
    this.getIcon(path).then(() => {
      ctx.drawImage(this.iconCache.get(path)!, x, y, w, h);
    });
  }

  onEvent(e: Event): void {
    if (e.type === "scene-click") {
      const { x, y } = (e as CustomEvent).detail as { x: number; y: number };

      // Close popup on outside click
      if (this.activePopup) {
        if (!this.pointInRect(x, y, { x: 140, y: 100, w: 520, h: 380 })) {
          this.activePopup = null;
        }
        return;
      }

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

      // Open popups
      if (this.pointInPolygon(x, y, this.shopPoly)) {
        this.activePopup = "shop";
        return;
      }
      if (this.pointInPolygon(x, y, this.armoryPoly)) {
        this.activePopup = "armory";
        return;
      }
      if (this.pointInPolygon(x, y, this.worldsPoly)) {
        this.activePopup = "worlds";
        return;
      }
    }
  }

  private renderPopup(
    ctx: CanvasRenderingContext2D,
    kind: "shop" | "armory" | "worlds"
  ) {
    // Dim background
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, CanvasSize.width, CanvasSize.height);
    // Modal panel
    const px = 140,
      py = 100,
      pw = 520,
      ph = 380;
    drawPanel(
      ctx,
      px,
      py,
      pw,
      ph,
      kind.charAt(0).toUpperCase() + kind.slice(1)
    );
    const tx = px + 16,
      ty = py + 44;

    if (kind === "shop") {
      renderShopPanel(ctx, tx, ty, pw - 32, this.cards);
    } else if (kind === "armory") {
      renderArmoryPanel(ctx, tx, ty, pw - 32);
    } else if (kind === "worlds") {
      const w = this.worlds[0];
      renderWorldsPanel(
        ctx,
        tx,
        ty,
        px,
        py,
        pw,
        w,
        (icon, x, y, iw, ih) => this.drawIcon(ctx, icon, x, y, iw, ih),
        elementIconPath
      );
    }

    // Close hint
    drawText(
      ctx,
      "Click outside to close",
      px + pw - 200,
      py + ph - 16,
      12,
      "#9aa3b2"
    );
  }

  private pointInRect(
    x: number,
    y: number,
    r: { x: number; y: number; w: number; h: number }
  ): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  private pointInPolygon(
    x: number,
    y: number,
    pts: { x: number; y: number }[]
  ): boolean {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x,
        yi = pts[i].y;
      const xj = pts[j].x,
        yj = pts[j].y;
      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }
}
