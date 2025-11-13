import type { Card, Element, Loadout } from "../../data/types";
import { drawText } from "../../ui/UiPrimitives";
import { elementIconPath } from "../../ui/ElementIcons";

export interface ArmoryPanelRegions {
  galleryCards: Array<{
    cardId: string;
    x: number;
    y: number;
    w: number;
    h: number;
    enabled: boolean;
  }>;
  loadoutSlots: Array<{
    slotIndex: number;
    x: number;
    y: number;
    w: number;
    h: number;
  }>;
}

export function renderArmoryPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  panelY: number,
  panelHeight: number,
  cards: Card[],
  cardCollection: Record<string, number>,
  loadout: Loadout,
  drawIcon?: (
    iconPath: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => void,
): ArmoryPanelRegions {
  drawText(ctx, "Loadout", x, y + 5);
  const loadoutRegions = renderLoadout(
    ctx,
    x,
    y + 10,
    width,
    100,
    cards,
    loadout,
    drawIcon,
  );
  drawText(ctx, "Gallery", x, y + 145);
  const galleryRegions = renderGallery(
    ctx,
    x,
    y + 150,
    width,
    panelY,
    panelHeight,
    cards,
    cardCollection,
    drawIcon,
  );

  return {
    galleryCards: galleryRegions.galleryCards,
    loadoutSlots: loadoutRegions.loadoutSlots,
  };
}

function renderLoadout(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  cards: Card[],
  loadout: Loadout,
  drawIcon?: (
    iconPath: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => void,
): {
  loadoutSlots: Array<{
    slotIndex: number;
    x: number;
    y: number;
    w: number;
    h: number;
  }>;
} {
  // Draw a 4x1 grid (4 columns, 1 row) with square cells, where the first cell on the left is a leader slot and the rest are regular slots
  const cols = 4;
  const rows = 1;
  const cellGap = 8;
  const gridMarginX = 16; // Horizontal margins on left and right
  const gridMarginY = 4; // Bottom margin
  const gridStartY = y + gridMarginY;
  const gridStartX = x + gridMarginX;

  // Calculate available width
  const availableWidth = width - gridMarginX * 2;
  const totalGapWidth = (cols - 1) * cellGap;
  const maxCellSizeByWidth = (availableWidth - totalGapWidth) / cols;

  // Calculate available height
  const availableHeight = height - gridMarginY * 2;
  const totalGapHeight = (rows - 1) * cellGap;
  const maxCellSizeByHeight = (availableHeight - totalGapHeight) / rows;

  const cellSize = Math.min(maxCellSizeByWidth, maxCellSizeByHeight);

  // Get card IDs in loadout order: leader first, then members (all slots, including empty ones)
  const loadoutCardIds = [loadout.leader, ...loadout.members];

  const loadoutSlots: Array<{
    slotIndex: number;
    x: number;
    y: number;
    w: number;
    h: number;
  }> = [];

  for (let col = 0; col < cols; col++) {
    let cellX = gridStartX + col * (cellSize + cellGap);
    const cellY = gridStartY;
    // add extra margin to the first cell
    if (col > 0) {
      cellX += cellGap * 3;
    }
    ctx.fillStyle = "#23262d";
    ctx.fillRect(cellX, cellY, cellSize, cellSize);
    ctx.strokeStyle = "#2b2f3a";
    ctx.strokeRect(cellX + 0.5, cellY + 0.5, cellSize - 1, cellSize - 1);

    // Store click region for this slot (slotIndex: 0 = leader, 1-3 = members)
    loadoutSlots.push({
      slotIndex: col,
      x: cellX,
      y: cellY,
      w: cellSize,
      h: cellSize,
    });

    // Draw card if present in loadout (col 0 = leader, col 1-3 = members)
    if (col < 4 && drawIcon) {
      const cardId = loadoutCardIds[col];
      if (cardId) {
        const card = cards.find((c) => c.id === cardId);
        if (card && card.imagePath) {
          drawIcon(card.imagePath, cellX, cellY, cellSize, cellSize);
        }
      }
    }
  }

  return { loadoutSlots };
}

function renderGallery(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  panelY: number,
  panelHeight: number,
  cards: Card[],
  cardCollection: Record<string, number>,
  drawIcon?: (
    iconPath: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => void,
): {
  galleryCards: Array<{
    cardId: string;
    x: number;
    y: number;
    w: number;
    h: number;
    enabled: boolean;
  }>;
} {
  // Draw 5x3 grid (5 columns, 3 rows) with square cells
  const cols = 5;
  const rows = 2;
  const cellGap = 8;
  const gridMarginX = 16; // Horizontal margins on left and right
  const gridMarginY = 8; // Bottom margin
  const gridStartY = y + gridMarginY;
  const gridStartX = x + gridMarginX;

  // Calculate available width
  const availableWidth = width - gridMarginX * 2;
  const totalGapWidth = (cols - 1) * cellGap;
  const maxCellSizeByWidth = (availableWidth - totalGapWidth) / cols;

  // Calculate available height
  const panelBottom = panelY + panelHeight;
  const availableHeight = panelBottom - gridStartY - gridMarginY;
  const totalGapHeight = (rows - 1) * cellGap;
  const maxCellSizeByHeight = (availableHeight - totalGapHeight) / rows;

  // Use the smaller of the two to ensure cells fit within bounds and remain square
  const cellSize = Math.min(maxCellSizeByWidth, maxCellSizeByHeight);

  const galleryRegions: {
    galleryCards: Array<{
      cardId: string;
      x: number;
      y: number;
      w: number;
      h: number;
      enabled: boolean;
    }>;
  } = { galleryCards: [] };

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellX = gridStartX + col * (cellSize + cellGap);
      const cellY = gridStartY + row * (cellSize + cellGap);

      // Draw cell background
      ctx.fillStyle = "#23262d";
      ctx.fillRect(cellX, cellY, cellSize, cellSize);

      // Draw cell border
      ctx.strokeStyle = "#2b2f3a";
      ctx.strokeRect(cellX + 0.5, cellY + 0.5, cellSize - 1, cellSize - 1);

      // Draw card image
      if (drawIcon) {
        const cardIndex = row * cols + col; // 0-based index
        const card = cards[cardIndex];

        if (card) {
          // Check if card is in collection
          const count = cardCollection[card.id] || 0;
          const isInCollection = count > 0;

          // Store click region (only enabled if in collection)
          galleryRegions.galleryCards.push({
            cardId: card.id,
            x: cellX,
            y: cellY,
            w: cellSize,
            h: cellSize,
            enabled: isInCollection,
          });

          const cardPath = card.imagePath;
          drawIcon(cardPath, cellX, cellY, cellSize, cellSize);

          // Draw disabled overlay if not in collection
          if (!isInCollection) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
            ctx.fillRect(cellX, cellY, cellSize, cellSize);
          }

          // Draw collection count in top left corner (if card exists in collection)
          if (card.id in cardCollection) {
            const count = cardCollection[card.id];
            const countText = count.toString();
            const textSize = Math.max(10, cellSize * 0.12);
            const textMargin = 4;

            const prevFont = ctx.font;
            const prevFillStyle = ctx.fillStyle;
            const prevTextAlign = ctx.textAlign;
            const prevTextBaseline = ctx.textBaseline;

            ctx.font = `${textSize}px system-ui`;
            ctx.fillStyle = "#e5e7eb";
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.fillText(countText, cellX + textMargin, cellY + textMargin);

            ctx.font = prevFont;
            ctx.fillStyle = prevFillStyle;
            ctx.textAlign = prevTextAlign;
            ctx.textBaseline = prevTextBaseline;
          }

          // Draw element icons at top right corner
          if (card.elements) {
            const elementIconSize = Math.max(12, cellSize * 0.15); // Scale icon size with cell size
            const iconMargin = 4;
            const iconGap = 2;
            const iconStartX = cellX + cellSize - iconMargin - elementIconSize;
            const iconStartY = cellY + iconMargin;

            // Draw element icons, stacking vertically if multiple
            card.elements.forEach((element: Element, idx: number) => {
              const iconY = iconStartY + idx * (elementIconSize + iconGap);
              const iconPath = elementIconPath(element);
              drawIcon(
                iconPath,
                iconStartX,
                iconY,
                elementIconSize,
                elementIconSize,
              );
            });
          }
        }
      }
    }
  }

  return galleryRegions;
}
