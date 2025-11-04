import { drawProgressBar, drawText } from "../../ui/UiPrimitives";

export function renderArmoryPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number
) {
  drawText(ctx, "Leader", x, y);
  drawText(ctx, "[     ]   [     ]  [     ]  [     ]", x, y + 40);
  drawText(ctx, "Gallery", x, y + 100);
  let gy = y + 120;
  for (let r = 0; r < 3; r++) {
    drawProgressBar(ctx, x, gy, width, 24, 0, "#374151");
    gy += 30;
  }
}


