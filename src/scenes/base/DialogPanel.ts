import type { NPC } from "../../data/types";
import { drawPanel, drawText } from "../../ui/UiPrimitives";

export interface DialogPanelRegions {
  panel: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export function renderDialogPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  npc: NPC | undefined,
  dialogText: string[],
  drawIcon?: (iconPath: string, x: number, y: number, w: number, h: number) => void
): DialogPanelRegions {
  const npcIconSize = 64;
  const padding = 20;
  const textSize = 16;
  const lineHeight = 24;
  const headerY = y + 44; // Start content after title bar (same as shop panel)
  const contentStartY = headerY + 24; // Start text content (same as shop panel)

  // Set font for text measurement
  ctx.font = `${textSize}px system-ui`;

  // Calculate panel dimensions (same as other panels: 832x456)
  const panelX = x;
  const panelY = y;
  const panelW = width;
  const panelH = height; // Use provided height to match other panels

  // Draw panel
  drawPanel(ctx, panelX, panelY, panelW, panelH, npc?.name || "Dialog");

  // Draw NPC icon on the left (top area, after title bar - same as shop panel)
  if (npc && drawIcon) {
    drawIcon(npc.imagePath, panelX + padding, headerY, npcIconSize, npcIconSize);
  }

  // Draw dialog text (starting after header, similar to shop panel)
  const textStartX = panelX + padding + (npc ? npcIconSize + padding : 0);
  const textStartY = contentStartY;
  const textMaxWidth = panelW - (textStartX - panelX) - padding * 2;

  ctx.fillStyle = "#e5e7eb";
  ctx.font = `${textSize}px system-ui`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  let currentY = textStartY;
  for (const line of dialogText) {
    // Word wrap text if needed
    const words = line.split(" ");
    let currentLine = "";
    let lineY = currentY;

    for (const word of words) {
      const testLine = currentLine + (currentLine ? " " : "") + word;
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > textMaxWidth && currentLine) {
        // Draw current line and start new line
        drawText(ctx, currentLine, textStartX, lineY);
        lineY += lineHeight;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    // Draw remaining line
    if (currentLine) {
      drawText(ctx, currentLine, textStartX, lineY);
      lineY += lineHeight;
    }

    currentY = lineY + lineHeight / 2; // Add spacing between paragraphs
  }

  // Reset text alignment
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  return {
    panel: {
      x: panelX,
      y: panelY,
      w: panelW,
      h: panelH,
    },
  };
}
