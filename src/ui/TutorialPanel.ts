import { elementIconPath } from "./ElementIcons";
import { drawPanel, drawText, drawTextWithShadow } from "./UiPrimitives";
import { CanvasSize } from "./Layouts";

export interface TutorialPanelRegions {
  panel: { x: number; y: number; w: number; h: number };
}

export function renderTutorialPanel(
  ctx: CanvasRenderingContext2D,
  scrollOffset: number = 0,
  drawIcon?: (iconPath: string, x: number, y: number, w: number, h: number) => void
): TutorialPanelRegions {
  const panelX = 224;
  const panelY = 80;
  const panelW = 832;
  const panelH = 560;
  const padding = 24;
  const lineHeight = 24;
  const sectionGap = 32;
  const contentStartY = panelY + 44; // Start of scrollable content area
  const contentHeight = panelH - 44; // Available height for content

  // Dim background
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, CanvasSize.width, CanvasSize.height);

  // Draw panel
  drawPanel(ctx, panelX, panelY, panelW, panelH, "Game Mechanics");

  // Set up clipping region to only render inside the panel content area
  ctx.save();
  ctx.beginPath();
  ctx.rect(panelX, contentStartY, panelW, contentHeight);
  ctx.clip();

  // Calculate starting Y position with scroll offset
  let currentY = contentStartY + padding - scrollOffset;

  // Title
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "20px system-ui";
  ctx.fillText("Game Mechanics", panelX + padding, currentY);
  currentY += lineHeight * 2;

  // Weapon Triangle Section
  ctx.fillStyle = "#3b82f6";
  ctx.font = "18px system-ui";
  ctx.fillText("Weapon Triangle", panelX + padding, currentY);
  currentY += lineHeight + 8;

  ctx.fillStyle = "#e5e7eb";
  ctx.font = "14px system-ui";
  ctx.fillText("Elements have strengths and weaknesses:", panelX + padding, currentY);
  currentY += lineHeight + 12;

  // Draw weapon triangle diagram
  const triangleCenterX = panelX + panelW / 2;
  const triangleY = currentY;
  const triangleRadius = 100;
  const iconSize = 32;

  // For an equilateral triangle, the height is radius * sqrt(3) / 2
  // If Grass and Water are at triangleY + triangleRadius * 0.5 (base),
  // Fire should be at baseY - height = triangleY + triangleRadius * 0.5 - triangleRadius * sqrt(3) / 2
  const triangleHeight = (triangleRadius * Math.sqrt(3)) / 2;
  const baseY = triangleY + triangleRadius * 0.5;
  const fireY = baseY - triangleHeight;

  // Fire (top)
  const fireX = triangleCenterX;
  if (drawIcon) {
    drawIcon(elementIconPath("Fire"), fireX - iconSize / 2, fireY - iconSize / 2, iconSize, iconSize);
  }
  ctx.fillStyle = "#ef4444";
  ctx.font = "12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("Fire", fireX, fireY + iconSize / 2 + 16);

  // Grass (bottom left)
  const grassX = triangleCenterX - triangleRadius * 0.866;
  const grassY = triangleY + triangleRadius * 0.5;
  if (drawIcon) {
    drawIcon(elementIconPath("Grass"), grassX - iconSize / 2, grassY - iconSize / 2, iconSize, iconSize);
  }
  ctx.fillStyle = "#22c55e";
  ctx.fillText("Grass", grassX, grassY + iconSize / 2 + 16);

  // Water (bottom right)
  const waterX = triangleCenterX + triangleRadius * 0.866;
  const waterY = triangleY + triangleRadius * 0.5;
  if (drawIcon) {
    drawIcon(elementIconPath("Water"), waterX - iconSize / 2, waterY - iconSize / 2, iconSize, iconSize);
  }
  ctx.fillStyle = "#3b82f6";
  ctx.fillText("Water", waterX, waterY + iconSize / 2 + 16);

  // Draw arrows showing relationships with arrowheads
  ctx.strokeStyle = "#10b981";
  ctx.fillStyle = "#10b981";
  ctx.lineWidth = 2;
  const arrowHeadSize = 8;

  // Helper function to draw an arrow from point A to point B
  const drawArrow = (fromX: number, fromY: number, toX: number, toY: number) => {
    // Calculate angle
    const angle = Math.atan2(toY - fromY, toX - fromX);

    // Draw line
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // Draw arrowhead
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - arrowHeadSize * Math.cos(angle - Math.PI / 6),
      toY - arrowHeadSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      toX - arrowHeadSize * Math.cos(angle + Math.PI / 6),
      toY - arrowHeadSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  };

  // Fire -> Grass
  drawArrow(fireX - 10, fireY + iconSize / 2, grassX + 10, grassY - iconSize / 2);

  // Grass -> Water
  drawArrow(grassX + iconSize / 2, grassY + 10, waterX - iconSize / 2, waterY + 10);

  // Water -> Fire
  drawArrow(waterX - 10, waterY - iconSize / 2, fireX + 10, fireY + iconSize / 2);

  currentY += triangleRadius * 1.5;

  // Dark/Light subsection within Weapon Triangle - positioned right below the triangle

  // Center Dark/Light visuals
  const darkLightGap = 120;
  const darkLightTotalWidth = iconSize * 2 + darkLightGap;
  const darkLightStartX = triangleCenterX - darkLightTotalWidth / 2;
  const darkLightY = currentY;

  // Dark
  const darkX = darkLightStartX;
  if (drawIcon) {
    drawIcon(elementIconPath("Dark"), darkX, darkLightY, iconSize, iconSize);
  }
  ctx.fillStyle = "#6b21a8";
  ctx.font = "12px system-ui";
  ctx.fillText("Dark", darkX + iconSize / 2, darkLightY + iconSize + 16);

  // Bidirectional arrow with proper arrowheads
  const arrowCenterY = darkLightY + iconSize / 2;
  const arrowStartX = darkX + iconSize + 10;
  const arrowEndX = darkX + iconSize + darkLightGap - 10;

  ctx.strokeStyle = "#f59e0b";
  ctx.fillStyle = "#f59e0b";
  ctx.lineWidth = 2;

  // Draw main arrow line
  ctx.beginPath();
  ctx.moveTo(arrowStartX, arrowCenterY);
  ctx.lineTo(arrowEndX, arrowCenterY);
  ctx.stroke();

  // Draw left arrowhead (pointing right)
  ctx.beginPath();
  ctx.moveTo(arrowStartX, arrowCenterY);
  ctx.lineTo(arrowStartX + arrowHeadSize, arrowCenterY - arrowHeadSize / 2);
  ctx.lineTo(arrowStartX + arrowHeadSize, arrowCenterY + arrowHeadSize / 2);
  ctx.closePath();
  ctx.fill();

  // Draw right arrowhead (pointing left)
  ctx.beginPath();
  ctx.moveTo(arrowEndX, arrowCenterY);
  ctx.lineTo(arrowEndX - arrowHeadSize, arrowCenterY - arrowHeadSize / 2);
  ctx.lineTo(arrowEndX - arrowHeadSize, arrowCenterY + arrowHeadSize / 2);
  ctx.closePath();
  ctx.fill();

  // Light
  const lightX = darkX + iconSize + darkLightGap;
  if (drawIcon) {
    drawIcon(elementIconPath("Light"), lightX, darkLightY, iconSize, iconSize);
  }
  ctx.fillStyle = "#fbbf24";
  ctx.fillText("Light", lightX + iconSize / 2, darkLightY + iconSize + 16);

  currentY += iconSize + 40;

  // All explanations follow the visuals
  ctx.textAlign = "left";
  ctx.fillStyle = "#9aa3b2";
  ctx.font = "13px system-ui";
  ctx.fillText("• Fire deals 1.5x damage to Grass", panelX + padding, currentY);
  currentY += lineHeight;
  ctx.fillText("• Grass deals 1.5x damage to Water", panelX + padding, currentY);
  currentY += lineHeight;
  ctx.fillText("• Water deals 1.5x damage to Fire", panelX + padding, currentY);
  currentY += lineHeight;
  ctx.fillText("• Weak elements take 0.75x damage from their counter", panelX + padding, currentY);
  currentY += lineHeight;
  ctx.fillText("• Dark and Light deal 1.5x damage to each other", panelX + padding, currentY);
  currentY += lineHeight + sectionGap;

  // AoE Section
  ctx.fillStyle = "#3b82f6";
  ctx.font = "18px system-ui";
  ctx.fillText("Area of Effect (AoE)", panelX + padding, currentY);
  currentY += lineHeight + 8;

  ctx.fillStyle = "#e5e7eb";
  ctx.font = "14px system-ui";
  ctx.fillText("Special match patterns deal damage to all enemies:", panelX + padding, currentY);
  currentY += lineHeight + 16;

  // L-shape example
  ctx.fillStyle = "#9aa3b2";
  ctx.font = "13px system-ui";
  ctx.fillText("L-Shape Match:", panelX + padding, currentY);
  currentY += lineHeight;

  const exampleGridSize = 20;
  const exampleGridGap = 2;
  const exampleStartX = panelX + padding + 20;
  const exampleStartY = currentY;
  const exampleColor = "#3b82f6";

  // Draw L-shape pattern
  ctx.fillStyle = exampleColor;
  // Vertical line (3 tiles)
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(
      exampleStartX,
      exampleStartY + i * (exampleGridSize + exampleGridGap),
      exampleGridSize,
      exampleGridSize
    );
  }
  // Horizontal line (2 tiles, excluding the corner)
  for (let i = 1; i < 3; i++) {
    ctx.fillRect(
      exampleStartX + i * (exampleGridSize + exampleGridGap),
      exampleStartY + 2 * (exampleGridSize + exampleGridGap),
      exampleGridSize,
      exampleGridSize
    );
  }

  ctx.strokeStyle = "#2b2f3a";
  ctx.lineWidth = 1;
  // Draw grid outline
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      ctx.strokeRect(
        exampleStartX + j * (exampleGridSize + exampleGridGap),
        exampleStartY + i * (exampleGridSize + exampleGridGap),
        exampleGridSize,
        exampleGridSize
      );
    }
  }

  currentY += 100;

  // T-shape example
  ctx.fillStyle = "#9aa3b2";
  ctx.font = "13px system-ui";
  ctx.fillText("T-Shape Match:", panelX + padding, currentY);
  currentY += lineHeight;

  const tStartX = panelX + padding + 20;
  const tStartY = currentY;

  // Draw T-shape pattern
  ctx.fillStyle = exampleColor;
  // Horizontal line (3 tiles)
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(tStartX + i * (exampleGridSize + exampleGridGap), tStartY, exampleGridSize, exampleGridSize);
  }
  // Vertical line (2 tiles, excluding the center)
  for (let i = 1; i < 3; i++) {
    ctx.fillRect(
      tStartX + (exampleGridSize + exampleGridGap),
      tStartY + i * (exampleGridSize + exampleGridGap),
      exampleGridSize,
      exampleGridSize
    );
  }

  // Draw grid outline
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      ctx.strokeRect(
        tStartX + j * (exampleGridSize + exampleGridGap),
        tStartY + i * (exampleGridSize + exampleGridGap),
        exampleGridSize,
        exampleGridSize
      );
    }
  }

  currentY += 100;

  ctx.fillStyle = "#9aa3b2";
  ctx.font = "13px system-ui";
  ctx.fillText("• L and T matches hit ALL enemies (or ALL allies for healing)", panelX + padding, currentY);
  currentY += lineHeight;
  ctx.fillText("• Regular line matches hit only one target", panelX + padding, currentY);
  currentY += lineHeight;
  ctx.fillText("• Look for [AoE] in the combat log to see area attacks", panelX + padding, currentY);
  currentY += lineHeight;
  ctx.fillText("• AoE matches require at least 5 tiles (instead of 3)", panelX + padding, currentY);

  // Restore clipping
  ctx.restore();

  return {
    panel: {
      x: panelX,
      y: panelY,
      w: panelW,
      h: panelH,
    },
  };
}
