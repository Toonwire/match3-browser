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
  panelH: number,
  worlds: WorldDef[],
  selectedWorldIndex: number,
  drawIcon: (iconPath: string, x: number, y: number, w: number, h: number) => void,
  elementIconPath: (el: WorldDef["primaryElement"]) => string,
  getHighestCompletedStage?: (worldId: string) => number | undefined
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
  const statBlockX = textX;
  const statBlockY = textY;
  const lineHeight = 24;
  const statBlockPadding = 8;
  const descriptionLineHeight = 18; // Smaller for description

  // Calculate total stages early for progress display
  const totalStages = world.stages ? world.stages.length : 0;

  // Calculate stat block height based on content (difficulty, element, progress - 3 lines)
  const statBlockHeight = lineHeight * 3 + statBlockPadding * 2;

  // Calculate center-center positions for image, button, and arrows
  // Center horizontally: (panelX + panelW) / 2
  // Center vertically: panelY + panelH / 2
  const centerX = panelX + panelW / 2;
  const centerY = panelY + panelH / 2;

  // Calculate positions for image, button, and arrows (centered horizontally and vertically)
  const totalWidth = arrowSize + arrowGap + imageSize + arrowGap + arrowSize; // prev arrow + gap + image + gap + next arrow
  const startX = centerX - totalWidth / 2;
  const prevArrowX = startX;
  const imageX = prevArrowX + arrowSize + arrowGap;
  const nextArrowX = imageX + imageSize + arrowGap;

  // Calculate vertical positions - center the group (image + button + gap) vertically
  const buttonGap = 16;
  const enterButtonH = 32;
  const totalGroupHeight = imageSize + buttonGap + enterButtonH;
  const imageY = centerY - totalGroupHeight / 2 + 30;
  const arrowY = imageY + (imageSize - arrowSize) / 2; // Arrows vertically centered with image

  // Enter button is below the image
  const enterButtonY = imageY + imageSize + buttonGap;
  const enterButtonW = imageSize;
  const enterButtonX = imageX;

  // Name and description go above the image
  const nameDescriptionY = imageY - 90; // Space above image for name and description
  const nameDescriptionX = centerX; // Center horizontally

  // Draw stat block background for left side (difficulty, element, progress)
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

  // Draw selected world's stats in left block
  const worldY = statBlockY + 12;
  let currentY = worldY;

  // Difficulty
  drawText(ctx, `Difficulty: ${world.difficulty}`, statBlockX, currentY);
  currentY += lineHeight;

  // Primary Element
  const elementText = "Primary element:";
  drawText(ctx, elementText, statBlockX, currentY);

  // Draw element icon next to element text
  const elementIconSize = 16;
  const elementTextWidth = ctx.measureText(elementText).width;
  const elementIconX = statBlockX + elementTextWidth + 8;
  const elementIconY = currentY - elementIconSize + 2;
  const iconPath = elementIconPath(world.primaryElement);
  drawIcon(iconPath, elementIconX, elementIconY, elementIconSize, elementIconSize);
  currentY += lineHeight;

  // Progress/Completion Status
  if (getHighestCompletedStage) {
    const highestCompleted = getHighestCompletedStage(world.id);

    let completedStages: number;
    let progressText: string;
    let progressColor: string;

    if (highestCompleted === undefined) {
      // World not discovered yet
      completedStages = 0;
      progressText = `Progress: ${completedStages}/${totalStages} stages`;
      progressColor = "#9aa3b2"; // Gray for not started
    } else {
      // World has been discovered
      // highestCompleted: -1 = no stages completed, 0 = stage 0 completed, 1 = stages 0-1 completed, etc.
      completedStages = highestCompleted >= 0 ? highestCompleted + 1 : 0;
      progressText = `Progress: ${completedStages}/${totalStages} stages`;

      // Color code based on completion
      if (completedStages === totalStages && totalStages > 0) {
        progressColor = "#4ade80"; // Green for completed
      } else if (completedStages > 0) {
        progressColor = "#fbbf24"; // Yellow/amber for in progress
      } else {
        // Discovered but no stages completed
        progressColor = "#9aa3b2"; // Gray for not started
      }
    }

    // Draw progress text with the determined color
    drawText(ctx, progressText, statBlockX, currentY, 16, progressColor);
  }

  // Draw name and description above the world image (centered)
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Name
  drawText(ctx, world.name, nameDescriptionX, nameDescriptionY, 26);
  let descY = nameDescriptionY + lineHeight + 4;

  // Description (if available)
  if (world.description && world.description.length > 0) {
    // Set font for measuring and drawing
    const descFontSize = 18;
    ctx.font = `${descFontSize}px system-ui`;
    // Wrap description text if needed
    const words = world.description.split(" ");
    let line = "";
    const maxWidth = imageSize + 100; // Slightly wider than image for description
    const descriptionLines: string[] = [];

    for (let i = 0; i < words.length; i++) {
      const testLine = line + (line ? " " : "") + words[i];
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && line) {
        descriptionLines.push(line);
        line = words[i];
      } else {
        line = testLine;
      }
    }
    if (line) {
      descriptionLines.push(line);
    }

    // Draw description lines (centered)
    descriptionLines.forEach((descLine) => {
      drawText(ctx, descLine, nameDescriptionX, descY, descFontSize, "#9aa3b2");
      descY += descriptionLineHeight;
    });
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Draw selected world's image (centered)
  if (world.imagePath) {
    drawIcon(world.imagePath, imageX, imageY, imageSize, imageSize);
  }

  // Draw "Enter World" button below the image (centered)
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

  // Draw navigation arrows (centered)
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
