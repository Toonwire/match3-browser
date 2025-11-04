import type { WorldDef } from "../../data/types";
import { drawText } from "../../ui/UiPrimitives";

export function renderWorldsPanel(
  ctx: CanvasRenderingContext2D,
  textX: number,
  textY: number,
  panelX: number,
  panelY: number,
  panelW: number,
  world: WorldDef | undefined,
  drawIcon: (iconPath: string, x: number, y: number, w: number, h: number) => void,
  elementIconPath: (el: WorldDef["primaryElement"]) => string
) {
  if (!world) {
    drawText(ctx, "No worlds", textX, textY);
    return;
  }
  drawText(ctx, `Name:     ${world.name}`, textX, textY);
  drawText(ctx, `Level:    ${world.level}`, textX, textY + 24);
  drawText(ctx, `Element:  ${world.primaryElement}`, textX, textY + 48);
  const p = elementIconPath(world.primaryElement);
  drawIcon(p, panelX + panelW - 56, panelY + 20, 28, 28);
}


