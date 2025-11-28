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
  scrollButton: {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null;
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
  scrollOffset: number = 0,
  showMutateView: boolean = false,
  drawIcon?: (iconPath: string, x: number, y: number, w: number, h: number) => void
): ArmoryPanelRegions {
  const loadoutHeight = 140; // Increased from 100 to use more vertical space
  const loadoutY = y + 10;

  let loadoutRegions: {
    loadoutSlots: Array<{
      slotIndex: number;
      x: number;
      y: number;
      w: number;
      h: number;
    }>;
  } = { loadoutSlots: [] };

  if (showMutateView) {
    // Render mutate view instead of loadout
    drawText(ctx, "Mutate", x, y + 5);
    renderMutate(ctx, x, loadoutY, width, loadoutHeight, cards, cardCollection, drawIcon);
  } else {
    // Render loadout view
    drawText(ctx, "Loadout", x, y + 5);
    loadoutRegions = renderLoadout(ctx, x, loadoutY, width, loadoutHeight, cards, loadout, drawIcon);
  }

  // Render scroll button aligned with loadout, at the right edge of the panel
  const scrollButtonRegion = renderScroll(ctx, x, loadoutY, width, loadoutHeight, drawIcon);

  const galleryStartY = y + loadoutHeight + 120; // Better spacing between loadout and gallery
  drawText(ctx, "Gallery", x, galleryStartY);
  const galleryY = galleryStartY + 5;

  const galleryRegions = renderGallery(
    ctx,
    x,
    galleryY,
    width,
    panelY,
    panelHeight,
    cards,
    cardCollection,
    scrollOffset,
    drawIcon
  );

  return {
    galleryCards: galleryRegions.galleryCards,
    loadoutSlots: loadoutRegions.loadoutSlots,
    scrollButton: scrollButtonRegion,
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
  drawIcon?: (iconPath: string, x: number, y: number, w: number, h: number) => void
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

    // Draw "Leader" text below the leader slot (col 0)
    if (col === 0) {
      const textY = cellY + cellSize + 4;
      ctx.font = "12px system-ui";
      ctx.fillStyle = "#9aa3b2";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("Leader", cellX + cellSize / 2, textY);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }

    // Check if leader has ability and get leader card
    const leaderCard = loadout.leader ? cards.find((c) => c.id === loadout.leader) : undefined;
    const hasLeaderAbility = leaderCard && leaderCard.leaderPassive && Array.isArray(leaderCard.leaderPassive);

    // Draw leader ability description if leader is set and has ability
    if (hasLeaderAbility && leaderCard && Array.isArray(leaderCard.leaderPassive)) {
      const leaderPassive = leaderCard.leaderPassive;
      const abilityY = y + 10 + height + 8; // Below loadout + gap (use height parameter)
      ctx.font = "12px system-ui";
      ctx.fillStyle = "#9aa3b2";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      // Draw each ability description
      leaderPassive.forEach((ability: any, idx: number) => {
        if (ability && typeof ability === "object" && "description" in ability) {
          const descY = abilityY + 16 + idx * 16;
          ctx.fillStyle = "#9aa3b2";
          ctx.fillText(`• ${ability.description}`, x + 8, descY);
        }
      });

      // Reset text baseline
      ctx.textBaseline = "alphabetic";
    }
  }

  return { loadoutSlots };
}

function renderMutate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  cards: Card[],
  cardCollection: Record<string, number>,
  drawIcon?: (iconPath: string, x: number, y: number, w: number, h: number) => void
): void {
  // Placeholder for mutate view - render centered text for now
  ctx.font = "24px system-ui";
  ctx.fillStyle = "#9aa3b2";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Mutate View", x + width / 2, y + height / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function renderScroll(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  loadoutHeight: number,
  drawIcon?: (iconPath: string, x: number, y: number, w: number, h: number) => void
): {
  x: number;
  y: number;
  w: number;
  h: number;
} | null {
  // Calculate cell size to match loadout cells (same calculation as in renderLoadout)
  const cols = 4;
  const cellGap = 8;
  const gridMarginX = 16;
  const gridMarginY = 4;
  const gridStartY = y + gridMarginY;
  const availableWidth = width - gridMarginX * 2;
  const totalGapWidth = (cols - 1) * cellGap;
  const maxCellSizeByWidth = (availableWidth - totalGapWidth) / cols;
  const availableHeight = loadoutHeight - gridMarginY * 2;
  const cellSize = Math.min(maxCellSizeByWidth, availableHeight);

  // Position scroll icon at the right edge of the panel, aligned with loadout
  const scrollIconMargin = 16; // Margin from right edge
  const scrollIconSize = cellSize; // Make scroll icon same size as loadout cells
  const scrollIconX = x + width - scrollIconMargin - scrollIconSize;
  const scrollIconY = gridStartY; // Align with loadout grid Y position

  // Draw scroll icon background
  ctx.fillStyle = "#23262d";
  ctx.fillRect(scrollIconX, scrollIconY, scrollIconSize, scrollIconSize);
  ctx.strokeStyle = "#2b2f3a";
  ctx.strokeRect(scrollIconX + 0.5, scrollIconY + 0.5, scrollIconSize - 1, scrollIconSize - 1);

  // Draw scroll icon
  if (drawIcon) {
    drawIcon("assets/misc/scroll.png", scrollIconX, scrollIconY, scrollIconSize, scrollIconSize);
  }

  return {
    x: scrollIconX,
    y: scrollIconY,
    w: scrollIconSize,
    h: scrollIconSize,
  };
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
  scrollOffset: number = 0,
  drawIcon?: (iconPath: string, x: number, y: number, w: number, h: number) => void
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
  // Increased columns from 5 to 8 to better use the wider canvas (832px panel width)
  const cols = 8;
  const cellGap = 8;
  const gridMarginX = 16; // Horizontal margins on left and right
  const gridMarginY = 8; // Bottom margin
  const gridStartY = y + gridMarginY;
  const gridStartX = x + gridMarginX;

  // Calculate available width
  const availableWidth = width - gridMarginX * 2;
  const totalGapWidth = (cols - 1) * cellGap;
  const maxCellSizeByWidth = (availableWidth - totalGapWidth) / cols;

  // Calculate available height for visible area
  const panelBottom = panelY + panelHeight;
  const availableHeight = panelBottom - gridStartY - gridMarginY;

  // Calculate how many rows we need based on total cards
  const totalRows = Math.ceil(cards.length / cols);

  // Calculate how many visible rows fit in the available height
  // We'll use a temporary cell size to estimate
  const tempCellSize = Math.min(maxCellSizeByWidth, 60); // Use a reasonable default
  const cellHeight = tempCellSize + cellGap;
  const visibleRows = Math.floor(availableHeight / cellHeight);

  // Calculate actual cell size based on visible rows
  const totalGapHeight = (visibleRows - 1) * cellGap;
  const maxCellSizeByHeight = (availableHeight - totalGapHeight) / visibleRows;
  const cellSize = Math.min(maxCellSizeByWidth, maxCellSizeByHeight);

  // Calculate max scroll offset (in pixels)
  const totalContentHeight = totalRows * (cellSize + cellGap) - cellGap;
  const maxScrollOffset = Math.max(0, totalContentHeight - availableHeight);

  // Clamp scroll offset
  const clampedScrollOffset = Math.max(0, Math.min(maxScrollOffset, scrollOffset));

  // Calculate which rows to render (only visible ones)
  const startRow = Math.floor(clampedScrollOffset / (cellSize + cellGap));
  const endRow = Math.min(totalRows, startRow + visibleRows + 1); // +1 for partial row at bottom

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

  // Set up clipping region for the gallery area
  ctx.save();
  ctx.beginPath();
  ctx.rect(gridStartX, gridStartY, availableWidth, availableHeight);
  ctx.clip();

  for (let row = startRow; row < endRow; row++) {
    for (let col = 0; col < cols; col++) {
      const cellX = gridStartX + col * (cellSize + cellGap);
      const cellY = gridStartY + row * (cellSize + cellGap) - clampedScrollOffset;

      // Draw cell background
      ctx.fillStyle = "#23262d";
      ctx.fillRect(cellX, cellY, cellSize, cellSize);

      // Draw cell border
      ctx.strokeStyle = "#2b2f3a";
      ctx.strokeRect(cellX + 0.5, cellY + 0.5, cellSize - 1, cellSize - 1);

      // Draw card image
      if (drawIcon) {
        const cardIndex = row * cols + col; // 0-based index

        // Skip if card index is out of bounds
        if (cardIndex >= cards.length) {
          continue;
        }

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
              drawIcon(iconPath, iconStartX, iconY, elementIconSize, elementIconSize);
            });
          }
        }
      }
    }
  }

  ctx.restore();
  return galleryRegions;
}
