import type { Card } from "../../data/types";
import { drawText } from "../../ui/UiPrimitives";

export function renderShopPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  cards: Card[]
) {
  drawText(ctx, "Plovmand: 2    Gold: 123g", x, y);
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


