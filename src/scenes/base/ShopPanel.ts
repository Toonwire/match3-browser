import type { Card, NPC, Shop, ShopItem } from "../../data/types";
import { drawText } from "../../ui/UiPrimitives";

export interface ShopItemRegion {
  itemId: string;
  itemType: "card" | "consumable";
  shopItem: ShopItem;
  x: number;
  y: number;
  w: number;
  h: number;
  enabled: boolean; // Whether player can afford it
}

export interface ShopPanelRegions {
  items: ShopItemRegion[];
}

export function renderShopPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  shop: Shop,
  npc: NPC | undefined,
  cards: Card[],
  gold: number,
  plovmand: number,
  drawIcon?: (
    iconPath: string,
    x: number,
    y: number,
    w: number,
    h: number
  ) => void
): ShopPanelRegions {
  const iconSize = 16;
  const iconGap = 6;
  const textSize = 16;
  const npcIconSize = 64;
  const headerY = y + 60;
  const itemStartY = headerY + 24;

  // Set font for text measurement
  ctx.font = `${textSize}px system-ui`;

  // Draw NPC icon on the left (top area)
  if (npc && drawIcon) {
    drawIcon(npc.imagePath, x, y, npcIconSize, npcIconSize);
  }

  // Draw currencies on the top right
  const currencyY = y;
  const iconY = currencyY - iconSize + 2;

  // Calculate positions for right-aligned currencies
  const plovmandText = `Plovmand: ${plovmand}`;
  const plovmandTextWidth = ctx.measureText(plovmandText).width;
  const plovmandX =
    x + width - plovmandTextWidth - (drawIcon ? iconSize + iconGap : 0);

  drawText(ctx, plovmandText, plovmandX, currencyY);
  if (drawIcon) {
    drawIcon(
      "/assets/currencies/plovmand.png",
      plovmandX + plovmandTextWidth + iconGap,
      iconY,
      iconSize,
      iconSize
    );
  }

  const goldText = `Gold: ${gold}g`;
  const goldTextWidth = ctx.measureText(goldText).width;
  const gap = 28;
  const goldX =
    plovmandX - goldTextWidth - gap - (drawIcon ? iconSize + iconGap : 0);

  drawText(ctx, goldText, goldX, currencyY);
  if (drawIcon) {
    drawIcon(
      "/assets/currencies/coin.png",
      goldX + goldTextWidth + iconGap,
      iconY,
      iconSize,
      iconSize
    );
  }

  // Draw header row
  const nameColX = x + 80; // Start after NPC icon area
  const elementColX = nameColX + 120;
  const costColX = elementColX + 120;
  const rowHeight = 22;
  const rowWidth = width - (nameColX - x);

  drawText(ctx, "NAME", nameColX, headerY);
  drawText(ctx, "ELEMENT", elementColX, headerY);
  drawText(ctx, "COST", costColX, headerY);

  let cy = itemStartY;
  const regions: ShopItemRegion[] = [];

  // Render card items
  for (const shopItem of shop.items.cards) {
    const card = cards.find((c) => c.id === shopItem.id);
    if (!card) continue;

    // Check if player can afford this item
    const canAfford =
      shopItem.unit === "gold"
        ? gold >= shopItem.cost
        : plovmand >= shopItem.cost;
    const hasStock = shopItem.stock > 0;

    // Draw bounding box
    ctx.strokeStyle = canAfford && hasStock ? "#4b5563" : "#374151";
    ctx.fillStyle =
      canAfford && hasStock ? "rgba(75, 85, 99, 0.1)" : "rgba(55, 65, 81, 0.1)";
    ctx.fillRect(nameColX - 4, cy - 16, rowWidth, rowHeight);
    ctx.strokeRect(nameColX - 4, cy - 16, rowWidth, rowHeight);

    const name = card.name;
    const elements = card.elements.join(", ");
    const costText =
      shopItem.unit === "gold"
        ? `${shopItem.cost}g`
        : `${shopItem.cost} plovmand`;

    // Draw text with appropriate color based on affordability
    ctx.fillStyle = canAfford && hasStock ? "#e5e7eb" : "#6b7280";
    drawText(ctx, name, nameColX, cy);
    drawText(ctx, elements, elementColX, cy);
    drawText(ctx, costText, costColX, cy);

    // Reset fill style
    ctx.fillStyle = "#e5e7eb";

    // Store clickable region
    regions.push({
      itemId: shopItem.id,
      itemType: "card",
      shopItem,
      x: nameColX - 4,
      y: cy - 16,
      w: rowWidth,
      h: rowHeight,
      enabled: canAfford && hasStock,
    });

    cy += rowHeight;
  }

  // Add spacing between cards and consumables
  if (shop.items.cards.length > 0 && shop.items.consumables.length > 0) {
    cy += 10;
  }

  // Render consumable items
  for (const shopItem of shop.items.consumables) {
    // Check if player can afford this item
    const canAfford =
      shopItem.unit === "gold"
        ? gold >= shopItem.cost
        : plovmand >= shopItem.cost;
    const hasStock = shopItem.stock > 0;

    // Draw bounding box
    ctx.strokeStyle = canAfford && hasStock ? "#4b5563" : "#374151";
    ctx.fillStyle =
      canAfford && hasStock ? "rgba(75, 85, 99, 0.1)" : "rgba(55, 65, 81, 0.1)";
    ctx.fillRect(nameColX - 4, cy - 16, rowWidth, rowHeight);
    ctx.strokeRect(nameColX - 4, cy - 16, rowWidth, rowHeight);

    const name = shopItem.id.replace("item_", "").replace(/_/g, " ");
    const costText =
      shopItem.unit === "gold"
        ? `${shopItem.cost}g`
        : `${shopItem.cost} plovmand`;

    // Draw text with appropriate color based on affordability
    ctx.fillStyle = canAfford && hasStock ? "#e5e7eb" : "#6b7280";
    // For consumables, show "???" for element
    drawText(ctx, name, nameColX, cy);
    drawText(ctx, "???", elementColX, cy);
    drawText(ctx, costText, costColX, cy);

    // Reset fill style
    ctx.fillStyle = "#e5e7eb";

    // Store clickable region
    regions.push({
      itemId: shopItem.id,
      itemType: "consumable",
      shopItem,
      x: nameColX - 4,
      y: cy - 16,
      w: rowWidth,
      h: rowHeight,
      enabled: canAfford && hasStock,
    });

    cy += rowHeight;
  }

  return { items: regions };
}
