import type { Card } from "../../data/types";
import { drawText } from "../../ui/UiPrimitives";

export function renderShopPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  cards: Card[],
  gold: number,
  plovmand: number,
  drawIcon?: (iconPath: string, x: number, y: number, w: number, h: number) => void
) {
  const iconSize = 16;
  const iconGap = 6;
  const textSize = 16; // drawText default size
  const textY = y;
  const iconY = textY - iconSize + 2; // Align icon with text baseline

  // Set font for text measurement (drawText will set it again, but we need it for measureText)
  ctx.font = `${textSize}px system-ui`;

  // Draw gold amount and icon
  const goldAmountText = `${gold}`;
  drawText(ctx, goldAmountText, x, textY);
  const goldTextWidth = ctx.measureText(goldAmountText).width;
  if (drawIcon) {
    drawIcon("/assets/currencies/coin.png", x + goldTextWidth + iconGap, iconY, iconSize, iconSize);
  }
  const goldTotalWidth = goldTextWidth + (drawIcon ? iconSize + iconGap : 0);

  // Draw plovmand amount and icon
  const gap = 28;
  const plovmandText = `${plovmand}`;
  drawText(ctx, plovmandText, x + goldTotalWidth + gap, textY);
  const plovmandTextWidth = ctx.measureText(plovmandText).width;
  if (drawIcon) {
    drawIcon("/assets/currencies/plovmand.png", x + goldTotalWidth + gap + plovmandTextWidth + iconGap, iconY, iconSize, iconSize);
  }
  let cy = y + 28;
  const items = cards.filter(
    (c) =>
      c.rank === 1 &&
      (c.elements.includes("Fire") ||
        c.elements.includes("Water") ||
        c.elements.includes("Grass"))
  );
  for (const it of items) {
    drawText(
      ctx,
      `${it.name.padEnd(12, " ")} ${it.elements.join(", ").padEnd(10, " ")} 5g`,
      x,
      cy
    );
    cy += 22;
  }
  cy += 10;
  drawText(ctx, "Mutagen           ???                 1 plovmand", x, cy);
}


