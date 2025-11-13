import { Scene } from "../engine/Scene";
import { drawPanel, drawText } from "../ui/UiPrimitives";
import { CanvasSize } from "../ui/Layouts";
import { loadYaml } from "../data/loadYaml";
import type { WorldDef } from "../data/types";

export class WorldScene extends Scene {
  private world?: WorldDef;

  constructor(private worldId: string) {
    super();
  }

  async init() {
    try {
      const worlds = await loadYaml<WorldDef[]>("/config/worlds.yaml");
      this.world = worlds.find((w) => w.id === this.worldId) ?? worlds[0];
    } catch {}
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#0f1014";
    ctx.fillRect(0, 0, CanvasSize.width, CanvasSize.height);
    drawPanel(ctx, 80, 80, 640, 440, "World");
    if (!this.world) {
      drawText(ctx, "World not found", 100, 120);
      return;
    }
    drawText(ctx, `Name: ${this.world.name}`, 100, 120);
    drawText(ctx, `Level: ${this.world.level}`, 100, 144);
    drawText(ctx, `Primary Element: ${this.world.primaryElement}`, 100, 168);
    drawText(ctx, `Stages: ${this.world.stages}`, 100, 192);
    drawText(ctx, "Advance/Retreat placeholders", 100, 232);
  }
}
