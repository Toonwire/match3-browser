import type { Card, Element, Item, NPC, Shop, ShopItem } from "../../data/types";
import { elementIconPath } from "../../ui/ElementIcons";
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
  items: Item[],
  gold: number,
  plovmand: number,
  drawIcon?: (iconPath: string, x: number, y: number, w: number, h: number) => void,
  inventory?: Record<string, number> // Player's inventory to filter out scrolls
): ShopPanelRegions {
  const iconSize = 16;
  const iconGap = 6;
  const textSize = 16;
  const npcIconSize = 64;
  const headerY = y + 96;
  const itemStartY = headerY + 24;
  const elementIconSize = 24;

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
  const plovmandX = x + width - plovmandTextWidth - (drawIcon ? iconSize + iconGap : 0);

  drawText(ctx, plovmandText, plovmandX, currencyY);
  if (drawIcon) {
    drawIcon("/assets/currencies/plovmand.png", plovmandX + plovmandTextWidth + iconGap, iconY, iconSize, iconSize);
  }

  const goldText = `Gold: ${gold}g`;
  const goldTextWidth = ctx.measureText(goldText).width;
  const gap = 28;
  const goldX = plovmandX - goldTextWidth - gap - (drawIcon ? iconSize + iconGap : 0);

  drawText(ctx, goldText, goldX, currencyY);
  if (drawIcon) {
    drawIcon("/assets/currencies/coin.png", goldX + goldTextWidth + iconGap, iconY, iconSize, iconSize);
  }

  // Draw header row
  const nameColX = x + 20;
  const elementColX = nameColX + 200;
  const costColX = elementColX + 80;
  const stockColX = costColX + 80;
  const buyColX = x + width - 60; // Rightmost column for buy button
  const rowHeight = 42; // Increased to fit larger icons
  const buyButtonSize = 18;
  const itemIconSize = 36; // Size for card/item icons before name (increased from 24)
  const itemIconGap = 8; // Gap between icon and name

  // drawText(ctx, "NAME", nameColX, headerY);
  // drawText(ctx, "ELEMENT", elementColX, headerY);
  // drawText(ctx, "COST", costColX, headerY);
  // drawText(ctx, "STOCK", stockColX, headerY);

  let cy = itemStartY;
  const regions: ShopItemRegion[] = [];

  // Render card items
  for (const shopItem of shop.items.cards) {
    const card = cards.find((c) => c.id === shopItem.id);
    if (!card) continue;

    // Check if player can afford this item
    const canAfford = shopItem.unit === "gold" ? gold >= shopItem.cost : plovmand >= shopItem.cost;
    const hasStock = shopItem.stock > 0;

    const name = card.name;
    const costText = shopItem.unit === "gold" ? `${shopItem.cost}g` : `${shopItem.cost} plov`;

    // Draw card icon before name
    const iconY = cy - itemIconSize + 2;
    if (card.imagePath && drawIcon) {
      drawIcon(card.imagePath, nameColX, iconY, itemIconSize, itemIconSize);
    }

    // Draw text (adjusted for icon)
    ctx.fillStyle = canAfford && hasStock ? "#e5e7eb" : "#6b7280";
    const nameX = nameColX + (card.imagePath && drawIcon ? itemIconSize + itemIconGap : 0);
    drawText(ctx, name, nameX, cy);

    // Draw element icons or text
    if (card.elements && card.elements.length > 0 && drawIcon) {
      // Draw element icons
      const elementIconY = cy - elementIconSize + 2;
      card.elements.forEach((element: Element, idx: number) => {
        const elementIconX = elementColX + idx * (elementIconSize + iconGap);
        const iconPath = elementIconPath(element);
        drawIcon(iconPath, elementIconX, elementIconY, elementIconSize, elementIconSize);
      });
    } else if (card.elements && card.elements.length > 0) {
      // Fallback to text if drawIcon not available
      const elements = card.elements.join(", ");
      drawText(ctx, elements, elementColX, cy);
    }

    drawText(ctx, costText, costColX, cy);

    // Draw stock count
    const stockText = `(${shopItem.stock.toString()})`;
    drawText(ctx, stockText, stockColX, cy);

    // Draw buy button/icon at rightmost column
    const buyButtonY = cy - 16;
    const buyButtonX = buyColX;

    if (canAfford && hasStock) {
      // Draw buy button background
      ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
      ctx.strokeStyle = "#3b82f6";
      ctx.fillRect(buyButtonX, buyButtonY, 50, buyButtonSize);
      ctx.strokeRect(buyButtonX, buyButtonY, 50, buyButtonSize);

      // Draw "Buy" text
      ctx.fillStyle = "#3b82f6";
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Buy", buyButtonX + 25, buyButtonY + buyButtonSize / 2);

      // Reset text alignment
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    } else {
      // Draw disabled buy button
      ctx.fillStyle = "rgba(107, 114, 128, 0.1)";
      ctx.strokeStyle = "#6b7280";
      ctx.fillRect(buyButtonX, buyButtonY, 50, buyButtonSize);
      ctx.strokeRect(buyButtonX, buyButtonY, 50, buyButtonSize);

      // Draw "Buy" text (grayed out)
      ctx.fillStyle = "#6b7280";
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Buy", buyButtonX + 25, buyButtonY + buyButtonSize / 2);

      // Reset text alignment
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }

    // Reset fill style
    ctx.fillStyle = "#e5e7eb";
    ctx.font = `${textSize}px system-ui`;

    // Store clickable region (only for the buy button)
    regions.push({
      itemId: shopItem.id,
      itemType: "card",
      shopItem,
      x: buyButtonX,
      y: buyButtonY,
      w: 50,
      h: buyButtonSize,
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
    // Skip mutation scrolls if player already has them in inventory
    const isMutationScroll =
      shopItem.id === "item_02_mutation_scroll_basic" || shopItem.id === "item_03_mutation_scroll_advanced";
    if (isMutationScroll && inventory && (inventory[shopItem.id] || 0) > 0) {
      continue; // Skip this scroll if already in inventory
    }

    // Check if player can afford this item
    const canAfford = shopItem.unit === "gold" ? gold >= shopItem.cost : plovmand >= shopItem.cost;
    const hasStock = shopItem.stock > 0;

    const item = items.find((i) => i.id === shopItem.id);
    const name = item?.name || shopItem.id.replace("item_", "").replace(/_/g, " ");
    const costText = shopItem.unit === "gold" ? `${shopItem.cost}g` : `${shopItem.cost} plov`;

    // Draw item icon before name
    const iconY = cy - itemIconSize + 2;
    if (item?.imagePath && drawIcon) {
      drawIcon(item.imagePath, nameColX, iconY, itemIconSize, itemIconSize);
    }

    // Draw text (adjusted for icon)
    ctx.fillStyle = canAfford && hasStock ? "#e5e7eb" : "#6b7280";
    const nameX = nameColX + (item?.imagePath && drawIcon ? itemIconSize + itemIconGap : 0);
    drawText(ctx, name, nameX, cy);

    // Draw element icons or "???" if no element
    if (item?.elements && item.elements.length > 0 && drawIcon) {
      // Draw element icons
      const elementIconY = cy - elementIconSize + 2;
      item.elements.forEach((element: Element, idx: number) => {
        const elementIconX = elementColX + idx * (elementIconSize + iconGap);
        const iconPath = elementIconPath(element);
        drawIcon(iconPath, elementIconX, elementIconY, elementIconSize, elementIconSize);
      });
    } else if (item?.elements && item.elements.length > 0) {
      // Fallback to text if drawIcon not available
      const elements = item.elements.join(", ");
      drawText(ctx, elements, elementColX, cy);
    }

    drawText(ctx, costText, costColX, cy);

    // Draw stock count
    const stockText = `(${shopItem.stock.toString()})`;
    drawText(ctx, stockText, stockColX, cy);

    // Draw buy button/icon at rightmost column
    const buyButtonY = cy - 16;
    const buyButtonX = buyColX;

    if (canAfford && hasStock) {
      // Draw buy button background
      ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
      ctx.strokeStyle = "#3b82f6";
      ctx.fillRect(buyButtonX, buyButtonY, 50, buyButtonSize);
      ctx.strokeRect(buyButtonX, buyButtonY, 50, buyButtonSize);

      // Draw "Buy" text
      ctx.fillStyle = "#3b82f6";
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Buy", buyButtonX + 25, buyButtonY + buyButtonSize / 2);

      // Reset text alignment
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    } else {
      // Draw disabled buy button
      ctx.fillStyle = "rgba(107, 114, 128, 0.1)";
      ctx.strokeStyle = "#6b7280";
      ctx.fillRect(buyButtonX, buyButtonY, 50, buyButtonSize);
      ctx.strokeRect(buyButtonX, buyButtonY, 50, buyButtonSize);

      // Draw "Buy" text (grayed out)
      ctx.fillStyle = "#6b7280";
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Buy", buyButtonX + 25, buyButtonY + buyButtonSize / 2);

      // Reset text alignment
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }

    // Reset fill style
    ctx.fillStyle = "#e5e7eb";
    ctx.font = `${textSize}px system-ui`;

    // Store clickable region (only for the buy button)
    regions.push({
      itemId: shopItem.id,
      itemType: "consumable",
      shopItem,
      x: buyButtonX,
      y: buyButtonY,
      w: 50,
      h: buyButtonSize,
      enabled: canAfford && hasStock,
    });

    cy += rowHeight;
  }

  return { items: regions };
}
