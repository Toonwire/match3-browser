import type { WorldDef } from "../../data/types";
import { drawText } from "../../ui/UiPrimitives";

export interface WorldsPanelRegions {
  prevArrow: { x: number; y: number; w: number; h: number };
  nextArrow: { x: number; y: number; w: number; h: number };
  enterWorld: { x: number; y: number; w: number; h: number };
  worldId: string;
}

export function renderWorldsPanel(
  ctx: CanvasRenderingContext2D,
  textX: number,
  textY: number,
  panelX: number,
  panelY: number,
  panelW: number,
  worlds: WorldDef[],
  selectedWorldIndex: number,
  drawIcon: (iconPath: string, x: number, y: number, w: number, h: number) => void,
  elementIconPath: (el: WorldDef["primaryElement"]) => string
): WorldsPanelRegions {
  const arrowSize = 32;
  const arrowGap = 8;

  if (!worlds || worlds.length === 0) {
    drawText(ctx, "No worlds", textX, textY);
    return {
      prevArrow: { x: 0, y: 0, w: 0, h: 0 },
      nextArrow: { x: 0, y: 0, w: 0, h: 0 },
      enterWorld: { x: 0, y: 0, w: 0, h: 0 },
      worldId: "",
    };
  }

  // Clamp selected index to valid range
  const clampedIndex = Math.max(0, Math.min(selectedWorldIndex, worlds.length - 1));
  const world = worlds[clampedIndex];

  const statBlockWidth = 150;
  const imageSize = 200;
  const imageY = panelY + 90;
  const statBlockX = textX;
  const statBlockY = textY;
  const lineHeight = 24;
  const statBlockPadding = 8;
  const statBlockHeight = lineHeight * 3 + statBlockPadding * 2;

  // Calculate arrow and image positions
  const prevArrowX = panelX + panelW - imageSize - 64 - arrowSize - arrowGap;
  const imageX = prevArrowX + arrowSize + arrowGap;
  const nextArrowX = imageX + imageSize + arrowGap;
  const arrowY = imageY + (imageSize - arrowSize) / 2;

  // Draw stat block background for single world
  ctx.fillStyle = "#1a1d24";
  ctx.fillRect(
    statBlockX - statBlockPadding,
    statBlockY - statBlockPadding,
    statBlockWidth + statBlockPadding * 2,
    statBlockHeight
  );
  ctx.strokeStyle = "#2b2f3a";
  ctx.strokeRect(
    statBlockX - statBlockPadding,
    statBlockY - statBlockPadding,
    statBlockWidth + statBlockPadding * 2,
    statBlockHeight
  );

  // Draw selected world's stats
  const worldY = statBlockY + 12;

  // Name
  drawText(ctx, `Name: ${world.name}`, statBlockX, worldY);

  // Difficulty
  drawText(ctx, `Difficulty: ${world.difficulty}`, statBlockX, worldY + lineHeight);

  // Primary Element
  const elementText = "Primary element:";
  drawText(ctx, elementText, statBlockX, worldY + lineHeight * 2);

  // Draw element icon next to element text
  const elementIconSize = 16;
  const elementTextWidth = ctx.measureText(elementText).width;
  const elementIconX = statBlockX + elementTextWidth + 8;
  const elementIconY = worldY + lineHeight * 2 - elementIconSize + 2;
  const iconPath = elementIconPath(world.primaryElement);
  drawIcon(iconPath, elementIconX, elementIconY, elementIconSize, elementIconSize);

  // Draw selected world's image on the right
  if (world.imagePath) {
    drawIcon(world.imagePath, imageX, imageY, imageSize, imageSize);
  }

  // Draw "Enter World" button below the image
  const enterButtonY = imageY + imageSize + 16;
  const enterButtonW = imageSize;
  const enterButtonH = 32;
  const enterButtonX = imageX;
  ctx.fillStyle = "#3b82f6";
  ctx.fillRect(enterButtonX, enterButtonY, enterButtonW, enterButtonH);
  ctx.strokeStyle = "#2563eb";
  ctx.strokeRect(enterButtonX + 0.5, enterButtonY + 0.5, enterButtonW - 1, enterButtonH - 1);
  ctx.fillStyle = "#ffffff";
  ctx.font = "14px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Enter World", enterButtonX + enterButtonW / 2, enterButtonY + enterButtonH / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Draw navigation arrows
  const canGoPrev = clampedIndex > 0;
  const canGoNext = clampedIndex < worlds.length - 1;

  // Previous arrow "<"
  ctx.fillStyle = canGoPrev ? "#3b82f6" : "#6b7280";
  ctx.strokeStyle = canGoPrev ? "#2563eb" : "#4b5563";
  ctx.fillRect(prevArrowX, arrowY, arrowSize, arrowSize);
  ctx.strokeRect(prevArrowX + 0.5, arrowY + 0.5, arrowSize - 1, arrowSize - 1);

  ctx.fillStyle = canGoPrev ? "#ffffff" : "#9ca3af";
  ctx.font = "20px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("<", prevArrowX + arrowSize / 2, arrowY + arrowSize / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Next arrow ">"
  ctx.fillStyle = canGoNext ? "#3b82f6" : "#6b7280";
  ctx.strokeStyle = canGoNext ? "#2563eb" : "#4b5563";
  ctx.fillRect(nextArrowX, arrowY, arrowSize, arrowSize);
  ctx.strokeRect(nextArrowX + 0.5, arrowY + 0.5, arrowSize - 1, arrowSize - 1);

  ctx.fillStyle = canGoNext ? "#ffffff" : "#9ca3af";
  ctx.font = "20px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(">", nextArrowX + arrowSize / 2, arrowY + arrowSize / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  return {
    prevArrow: {
      x: prevArrowX,
      y: arrowY,
      w: arrowSize,
      h: arrowSize,
    },
    nextArrow: {
      x: nextArrowX,
      y: arrowY,
      w: arrowSize,
      h: arrowSize,
    },
    enterWorld: {
      x: enterButtonX,
      y: enterButtonY,
      w: enterButtonW,
      h: enterButtonH,
    },
    worldId: world.id,
  };
}
