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
  mutateButton: {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null;
  mutateSlots: Array<{
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
  scrollOffset: number = 0,
  showMutateView: boolean = false,
  mutateSlots: [string | null, string | null] = [null, null],
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

  let mutateSlotRegions: Array<{
    slotIndex: number;
    x: number;
    y: number;
    w: number;
    h: number;
  }> = [];

  if (showMutateView) {
    // Render mutate view instead of loadout
    drawText(ctx, "Mutate", x, y + 5);
    mutateSlotRegions = renderMutate(
      ctx,
      x,
      loadoutY,
      width,
      loadoutHeight,
      cards,
      cardCollection,
      mutateSlots,
      drawIcon
    );
  } else {
    // Render loadout view
    drawText(ctx, "Loadout", x, y + 5);
    loadoutRegions = renderLoadout(ctx, x, loadoutY, width, loadoutHeight, cards, loadout, drawIcon);
  }

  // Render mutate button aligned with loadout, at the right edge of the panel
  const mutateButtonRegion = renderMutateButton(ctx, x, loadoutY, width, loadoutHeight, drawIcon);

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
    mutateButton: mutateButtonRegion,
    mutateSlots: mutateSlotRegions,
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
  mutateSlots: [string | null, string | null],
  drawIcon?: (iconPath: string, x: number, y: number, w: number, h: number) => void
): Array<{
  slotIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
}> {
  const gridMarginY = 4;
  const availableWidth = width;
  const availableHeight = height - gridMarginY * 2;

  // Calculate card slot size - make them square and fit two slots with gap and arrow
  const gap = 40; // Space for arrow between slots
  const slotSize = Math.min((availableWidth - gap) / 2, availableHeight);

  // Center the slots vertically
  const slotY = y + gridMarginY + (availableHeight - slotSize) / 2;

  // Calculate total width of both slots + gap
  const totalWidth = slotSize * 2 + gap;

  // Center horizontally
  const startX = x + (availableWidth - totalWidth) / 2;

  // Calculate positions for two slots (centered)
  const leftSlotX = startX;
  const rightSlotX = startX + slotSize + gap;

  const mutateSlotRegions: Array<{
    slotIndex: number;
    x: number;
    y: number;
    w: number;
    h: number;
  }> = [];

  // Draw left slot (input card 1)
  ctx.fillStyle = "#23262d";
  ctx.fillRect(leftSlotX, slotY, slotSize, slotSize);
  ctx.strokeStyle = "#2b2f3a";
  ctx.strokeRect(leftSlotX + 0.5, slotY + 0.5, slotSize - 1, slotSize - 1);

  // Store click region for left slot
  mutateSlotRegions.push({
    slotIndex: 0,
    x: leftSlotX,
    y: slotY,
    w: slotSize,
    h: slotSize,
  });

  // Draw card in left slot if present
  if (mutateSlots[0] && drawIcon) {
    const card = cards.find((c) => c.id === mutateSlots[0]);
    if (card && card.imagePath) {
      drawIcon(card.imagePath, leftSlotX, slotY, slotSize, slotSize);
    }
  }

  // Draw right slot (input card 2)
  ctx.fillStyle = "#23262d";
  ctx.fillRect(rightSlotX, slotY, slotSize, slotSize);
  ctx.strokeStyle = "#2b2f3a";
  ctx.strokeRect(rightSlotX + 0.5, slotY + 0.5, slotSize - 1, slotSize - 1);

  // Store click region for right slot
  mutateSlotRegions.push({
    slotIndex: 1,
    x: rightSlotX,
    y: slotY,
    w: slotSize,
    h: slotSize,
  });

  // Draw card in right slot if present
  if (mutateSlots[1] && drawIcon) {
    const card = cards.find((c) => c.id === mutateSlots[1]);
    if (card && card.imagePath) {
      drawIcon(card.imagePath, rightSlotX, slotY, slotSize, slotSize);
    }
  }

  // Draw double arrow connection between slots
  const arrowStartX = leftSlotX + slotSize;
  const arrowEndX = rightSlotX;
  const arrowY = slotY + slotSize / 2;
  const arrowHeadSize = 8;

  // Draw arrow line
  ctx.strokeStyle = "#9aa3b2";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(arrowStartX, arrowY);
  ctx.lineTo(arrowEndX, arrowY);
  ctx.stroke();

  // Draw left arrow head (pointing right →)
  ctx.fillStyle = "#9aa3b2";
  ctx.beginPath();
  ctx.moveTo(arrowStartX + arrowHeadSize, arrowY);
  ctx.lineTo(arrowStartX, arrowY - arrowHeadSize / 2);
  ctx.lineTo(arrowStartX, arrowY + arrowHeadSize / 2);
  ctx.closePath();
  ctx.fill();

  // Draw right arrow head (pointing left ←)
  ctx.beginPath();
  ctx.moveTo(arrowEndX - arrowHeadSize, arrowY);
  ctx.lineTo(arrowEndX, arrowY - arrowHeadSize / 2);
  ctx.lineTo(arrowEndX, arrowY + arrowHeadSize / 2);
  ctx.closePath();
  ctx.fill();

  // Reset line width
  ctx.lineWidth = 1;

  return mutateSlotRegions;
}

function renderMutateButton(
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

  // Position mutate button at the right edge of the panel, aligned with loadout
  const mutateButtonMargin = 16; // Margin from right edge
  const mutateButtonSize = cellSize; // Make mutate button same size as loadout cells
  const mutateButtonX = x + width - mutateButtonMargin - mutateButtonSize;
  const mutateButtonY = gridStartY; // Align with loadout grid Y position

  // Draw mutate button background
  ctx.fillStyle = "#23262d";
  ctx.fillRect(mutateButtonX, mutateButtonY, mutateButtonSize, mutateButtonSize);
  ctx.strokeStyle = "#2b2f3a";
  ctx.strokeRect(mutateButtonX + 0.5, mutateButtonY + 0.5, mutateButtonSize - 1, mutateButtonSize - 1);

  // Draw mutate button icon
  if (drawIcon) {
    drawIcon("assets/misc/mutate_scroll.png", mutateButtonX, mutateButtonY, mutateButtonSize, mutateButtonSize);
  }

  return {
    x: mutateButtonX,
    y: mutateButtonY,
    w: mutateButtonSize,
    h: mutateButtonSize,
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
