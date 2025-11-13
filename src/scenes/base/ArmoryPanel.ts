import type { Card, Element, Loadout } from "../../data/types";
import { drawText } from "../../ui/UiPrimitives";
import { elementIconPath } from "../../ui/ElementIcons";

export interface ArmoryPanelRegions {
  galleryCards: Array<{ cardId: string; x: number; y: number; w: number; h: number }>;
  loadoutSlots: Array<{ slotIndex: number; x: number; y: number; w: number; h: number }>;
}

export function renderArmoryPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  panelY: number,
  panelHeight: number,
  cards: Card[],
  loadout: Loadout,
  drawIcon?: (iconPath: string, x: number, y: number, w: number, h: number) => void
): ArmoryPanelRegions {
  drawText(ctx, "Loadout", x, y + 5);
  const loadoutRegions = renderLoadout(ctx, x, y + 10, width, 100, cards, loadout, drawIcon);
  drawText(ctx, "Gallery", x, y + 145);
  const galleryRegions = renderGallery(ctx, x, y + 150, width, panelY, panelHeight, cards, drawIcon);
  
  return {
    galleryCards: galleryRegions.galleryCards,
    loadoutSlots: loadoutRegions.loadoutSlots
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
): { loadoutSlots: Array<{ slotIndex: number; x: number; y: number; w: number; h: number }> } {
  // Draw a 4x1 grid (4 columns, 1 row) with square cells, where the first cell on the left is a leader slot and the rest are regular slots
  const cols = 4;
  const rows = 1;
  const cellGap = 8;
  const gridMarginX = 16; // Horizontal margins on left and right
  const gridMarginY = 4; // Bottom margin
  const gridStartY = y + gridMarginY;
  const gridStartX = x + gridMarginX;

  // Calculate available width
  const availableWidth = width - (gridMarginX * 2);
  const totalGapWidth = (cols - 1) * cellGap;
  const maxCellSizeByWidth = (availableWidth - totalGapWidth) / cols;

  // Calculate available height
  const availableHeight = height - (gridMarginY * 2);
  const totalGapHeight = (rows - 1) * cellGap;
  const maxCellSizeByHeight = (availableHeight - totalGapHeight) / rows;

  const cellSize = Math.min(maxCellSizeByWidth, maxCellSizeByHeight);

  // Get card IDs in loadout order: leader first, then members (all slots, including empty ones)
  const loadoutCardIds = [loadout.leader, ...loadout.members];

  const loadoutSlots: Array<{ slotIndex: number; x: number; y: number; w: number; h: number }> = [];

  for (let col = 0; col < cols; col++) {
    let cellX = gridStartX + col * (cellSize + cellGap);
    const cellY = gridStartY;
    // add extra margin to the first cell
    if (col > 0) {
      cellX += cellGap*3;
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
      h: cellSize
    });
    
    // Draw card if present in loadout (col 0 = leader, col 1-3 = members)
    if (col < 4 && drawIcon) {
      const cardId = loadoutCardIds[col];
      if (cardId) {
        const card = cards.find(c => c.id === cardId);
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
  drawIcon?: (iconPath: string, x: number, y: number, w: number, h: number) => void
): { galleryCards: Array<{ cardId: string; x: number; y: number; w: number; h: number }> } {

  // Draw 5x3 grid (5 columns, 3 rows) with square cells
  const cols = 5;
  const rows = 2;
  const cellGap = 8;
  const gridMarginX = 16; // Horizontal margins on left and right
  const gridMarginY = 8; // Bottom margin
  const gridStartY = y + gridMarginY;
  const gridStartX = x + gridMarginX;
  
  // Calculate available width
  const availableWidth = width - (gridMarginX * 2);
  const totalGapWidth = (cols - 1) * cellGap;
  const maxCellSizeByWidth = (availableWidth - totalGapWidth) / cols;
  
  // Calculate available height
  const panelBottom = panelY + panelHeight;
  const availableHeight = panelBottom - gridStartY - gridMarginY;
  const totalGapHeight = (rows - 1) * cellGap;
  const maxCellSizeByHeight = (availableHeight - totalGapHeight) / rows;
  
  // Use the smaller of the two to ensure cells fit within bounds and remain square
  const cellSize = Math.min(maxCellSizeByWidth, maxCellSizeByHeight);

  
  const cardFiles = [
    'card_01_whelp.png',
    'card_02_whelpier.png',
    'card_03_whelpiest.png',
    'card_04_slime.png',
    'card_05_slimer.png',
    'card_06_slimest.png',
    'card_07_wisp.png',
    'card_08_wispier.png',
    'card_09_wispiest.png',
  ];
  
  // Map card IDs to their order in the gallery
  const cardOrder = ['whelp', 'whelpier', 'whelpiest', 'slime', 'slimer', 'slimest', 'wisp', 'wispier', 'wispiest'];
  
  const galleryRegions: { galleryCards: Array<{ cardId: string; x: number; y: number; w: number; h: number }> } = { galleryCards: [] };
  
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
      
      // Draw card image (card_01, card_02, etc.)
      if (drawIcon) {
        const cardIndex = row * cols + col; // 0-based index
        const cardId = cardOrder[cardIndex];
        const card = cards.find(c => c.id === cardId);
        
        if (cardIndex < cardFiles.length && card) {
          // Store click region
          galleryRegions.galleryCards.push({
            cardId: card.id,
            x: cellX,
            y: cellY,
            w: cellSize,
            h: cellSize
          });
          
          const cardPath = card.imagePath || `/assets/cards/${cardFiles[cardIndex]}`;
          drawIcon(cardPath, cellX, cellY, cellSize, cellSize);
          
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
  
  return galleryRegions;
}