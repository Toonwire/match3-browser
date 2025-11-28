import { loadYaml } from "../../data/loadYaml";
import type { Card, Item, Mutation, NPC, Shop, WorldDef } from "../../data/types";
import { Scene } from "../../engine/Scene";
import { GameState } from "../../state/GameState";
import { elementIconPath } from "../../ui/ElementIcons";
import { BaseLayout, CanvasSize } from "../../ui/Layouts";
import { drawPanel, drawText, drawTopBar, getTopBarButtonRegions } from "../../ui/UiPrimitives";
import { renderArmoryPanel } from "./ArmoryPanel";
import { renderShopPanel, type ShopPanelRegions } from "./ShopPanel";
import { renderWorldsPanel, type WorldsPanelRegions } from "./WorldsPanel";

export type OnNavigateToWorld = (worldId: string) => void;

export class BaseScene extends Scene {
  private cards: Card[] = [];
  private items: Item[] = [];
  private worlds: WorldDef[] = [];
  private shop?: Shop;
  private npcs: NPC[] = [];
  private mutations: Mutation[] = [];
  private iconCache = new Map<string, HTMLImageElement>();
  private activePopup: "shop" | "armory" | "worlds" | null = null;
  private showMutateView: boolean = false;
  private mutateSlots: (string | null)[] = [null, null];
  private background?: HTMLImageElement;
  private state: GameState = GameState.load();
  private onNavigateToWorld?: OnNavigateToWorld;

  constructor(onNavigateToWorld?: OnNavigateToWorld) {
    super();
    this.onNavigateToWorld = onNavigateToWorld;
  }
  private armoryRegions: {
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
    performMutateButton: {
      x: number;
      y: number;
      w: number;
      h: number;
      enabled: boolean;
    } | null;
  } | null = null;
  private shopRegions: ShopPanelRegions | null = null;
  private galleryScrollOffset: number = 0;
  private selectedWorldIndex: number = 0;
  private worldsRegions: WorldsPanelRegions | null = null;

  private shopPoly = [
    { x: BaseLayout.shop.x, y: BaseLayout.shop.y },
    { x: BaseLayout.shop.x + BaseLayout.shop.w, y: BaseLayout.shop.y },
    { x: BaseLayout.shop.x + BaseLayout.shop.w, y: BaseLayout.shop.y + BaseLayout.shop.h },
    { x: BaseLayout.shop.x, y: BaseLayout.shop.y + BaseLayout.shop.h },
  ];
  private armoryPoly = [
    { x: BaseLayout.armory.x, y: BaseLayout.armory.y },
    { x: BaseLayout.armory.x + BaseLayout.armory.w, y: BaseLayout.armory.y },
    { x: BaseLayout.armory.x + BaseLayout.armory.w, y: BaseLayout.armory.y + BaseLayout.armory.h },
    { x: BaseLayout.armory.x, y: BaseLayout.armory.y + BaseLayout.armory.h },
  ];
  private worldsPoly = [
    { x: BaseLayout.worlds.x, y: BaseLayout.worlds.y },
    { x: BaseLayout.worlds.x + BaseLayout.worlds.w, y: BaseLayout.worlds.y },
    { x: BaseLayout.worlds.x + BaseLayout.worlds.w, y: BaseLayout.worlds.y + BaseLayout.worlds.h },
    { x: BaseLayout.worlds.x, y: BaseLayout.worlds.y + BaseLayout.worlds.h },
  ];

  async init() {
    try {
      this.cards = await loadYaml<Card[]>("/config/cards.yaml");
      this.items = await loadYaml<Item[]>("/config/items.yaml");
      this.worlds = await loadYaml<WorldDef[]>("/config/worlds.yaml");
      const shops = await loadYaml<Shop[]>("/config/shops.yaml");
      this.shop = shops.find((shop) => shop.id === "shop_01_base");
      this.npcs = await loadYaml<NPC[]>("/config/npcs.yaml");
      this.mutations = await loadYaml<Mutation[]>("/config/mutations.yaml");
      const bg = new Image();
      bg.src = "/assets/backgrounds/base_background_v5.png";
      await bg.decode().catch(() => new Promise((res) => (bg.onload = () => res(undefined))));
      this.background = bg;

      // Initialize test collection with cards from cards.yaml
      // this.state.initializeTestCollection(this.cards);
    } catch {}
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Background
    ctx.fillStyle = "#0f1014";
    ctx.fillRect(0, 0, CanvasSize.width, CanvasSize.height);

    if (this.background) {
      ctx.drawImage(this.background, 0, 0, CanvasSize.width, CanvasSize.height);
    }

    // Top bar
    drawTopBar(ctx, CanvasSize.width, this.state, this.cards, (iconPath, x, y, w, h) =>
      this.drawIcon(ctx, iconPath, x, y, w, h)
    );

    // Active popup overlay
    if (this.activePopup) this.renderPopup(ctx, this.activePopup);
  }

  private async getIcon(path: string): Promise<HTMLImageElement> {
    if (this.iconCache.has(path)) return this.iconCache.get(path)!;
    const img = new Image();
    img.src = path;
    await img.decode().catch(() => new Promise((res) => (img.onload = () => res(undefined))));
    this.iconCache.set(path, img);
    return img;
  }

  private drawIconWithAspectRatio(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    // Preserve aspect ratio
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const targetAspect = w / h;
    let drawWidth = w;
    let drawHeight = h;
    let drawX = x;
    let drawY = y;

    if (imgAspect > targetAspect) {
      // Image is wider - fit to width
      drawHeight = w / imgAspect;
      drawY = y + (h - drawHeight) / 2;
    } else {
      // Image is taller - fit to height
      drawWidth = h * imgAspect;
      drawX = x + (w - drawWidth) / 2;
    }

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
  }

  private drawIcon(ctx: CanvasRenderingContext2D, path: string, x: number, y: number, w: number, h: number) {
    const cached = this.iconCache.get(path);
    if (cached) {
      this.drawIconWithAspectRatio(ctx, cached, x, y, w, h);
      return;
    }
    this.getIcon(path).then(() => {
      const img = this.iconCache.get(path)!;
      this.drawIconWithAspectRatio(ctx, img, x, y, w, h);
    });
  }

  onEvent(e: Event): void {
    if (e.type === "scene-wheel") {
      const { x, y, deltaY } = (e as CustomEvent).detail as {
        x: number;
        y: number;
        deltaY: number;
      };

      // Handle wheel events for gallery scrolling
      if (this.activePopup === "armory") {
        const px = 224,
          py = 120,
          pw = 832,
          ph = 456;
        const ty = py + 44; // Text area Y
        const loadoutHeight = 140; // Loadout section height
        const galleryStartY = ty + loadoutHeight + 50; // Gallery starts after loadout + spacing
        const galleryY = galleryStartY + 5; // Gallery content Y (after "Gallery" text)
        const galleryHeight = ph - (galleryY - py) - 8; // Available height for gallery (minus bottom margin)

        // Check if mouse is over gallery area
        if (x >= px && x <= px + pw && y >= galleryY && y <= galleryY + galleryHeight) {
          // Scroll the gallery
          const scrollSpeed = 20;
          this.galleryScrollOffset += deltaY > 0 ? scrollSpeed : -scrollSpeed;
          // Clamping will be done in renderGallery based on actual content height
          this.galleryScrollOffset = Math.max(0, this.galleryScrollOffset);
          return;
        }
      }
      return;
    }

    if (e.type === "scene-click") {
      const { x, y } = (e as CustomEvent).detail as { x: number; y: number };

      // Handle clicks inside popup
      if (this.activePopup) {
        const px = 224,
          py = 120,
          pw = 832,
          ph = 456;

        // Handle shop panel clicks
        if (this.activePopup === "shop" && this.shopRegions) {
          for (const itemRegion of this.shopRegions.items) {
            if (this.pointInRect(x, y, itemRegion) && itemRegion.enabled) {
              const success = this.state.buyItem(
                itemRegion.itemId,
                itemRegion.itemType,
                itemRegion.shopItem.cost,
                itemRegion.shopItem.unit,
                itemRegion.shopItem.stock
              );
              if (success) {
                console.log(`Bought ${itemRegion.itemId}`);
                // Decrement stock (in a real implementation, this would be in shop state)
                itemRegion.shopItem.stock -= 1;
              } else {
                console.log("Cannot buy item (insufficient funds or out of stock)");
              }
              return;
            }
          }
        }

        // Handle worlds panel clicks
        if (this.activePopup === "worlds" && this.worldsRegions) {
          // Check if click is on previous arrow
          if (this.pointInRect(x, y, this.worldsRegions.prevArrow)) {
            if (this.selectedWorldIndex > 0) {
              this.selectedWorldIndex--;
            }
            return;
          }

          // Check if click is on next arrow
          if (this.pointInRect(x, y, this.worldsRegions.nextArrow)) {
            if (this.selectedWorldIndex < this.worlds.length - 1) {
              this.selectedWorldIndex++;
            }
            return;
          }

          // Check if click is on enter world button
          if (this.pointInRect(x, y, this.worldsRegions.enterWorld)) {
            if (this.onNavigateToWorld) {
              this.onNavigateToWorld(this.worldsRegions.worldId);
            }
            return;
          }
        }

        // Handle armory panel clicks
        if (this.activePopup === "armory" && this.armoryRegions) {
          // Check if click is on mutate button
          if (this.armoryRegions.mutateButton && this.pointInRect(x, y, this.armoryRegions.mutateButton)) {
            this.showMutateView = !this.showMutateView;
            // Reset mutate slots when switching views
            if (!this.showMutateView) {
              const hasAdvancedScroll = (this.state.inventory.items["item_03_mutation_scroll_advanced"] || 0) > 0;
              this.mutateSlots = hasAdvancedScroll ? [null, null, null] : [null, null];
            } else {
              // When entering mutate view, ensure slots array has correct length
              const hasAdvancedScroll = (this.state.inventory.items["item_03_mutation_scroll_advanced"] || 0) > 0;
              const requiredSlots = hasAdvancedScroll ? 3 : 2;
              while (this.mutateSlots.length < requiredSlots) {
                this.mutateSlots.push(null);
              }
              // Trim to required length if too long
              if (this.mutateSlots.length > requiredSlots) {
                this.mutateSlots = this.mutateSlots.slice(0, requiredSlots);
              }
            }
            return;
          }

          if (this.showMutateView) {
            // Handle mutate view clicks
            // Check if click is on perform mutate button
            if (
              this.armoryRegions.performMutateButton &&
              this.pointInRect(x, y, this.armoryRegions.performMutateButton) &&
              this.armoryRegions.performMutateButton.enabled
            ) {
              this.tryPerformMutation();
              return;
            }

            // Check if click is on a mutate slot (remove card from slot)
            for (const slotRegion of this.armoryRegions.mutateSlots) {
              if (this.pointInRect(x, y, slotRegion)) {
                // Remove card from slot (card stays in collection)
                this.mutateSlots[slotRegion.slotIndex] = null;
                return;
              }
            }

            // Check if click is on a gallery card (only if enabled)
            for (const cardRegion of this.armoryRegions.galleryCards) {
              if (this.pointInRect(x, y, cardRegion) && cardRegion.enabled) {
                // Check if card is available in collection
                const count = this.state.cardCollection[cardRegion.cardId] || 0;
                if (count <= 0) {
                  return;
                }

                // Count how many times this card is already in slots
                const cardId = cardRegion.cardId;
                const alreadyInSlots = this.mutateSlots.filter((slot) => slot === cardId).length;

                // Check if we have enough copies (need at least alreadyInSlots + 1)
                if (count <= alreadyInSlots) {
                  return; // Not enough copies
                }

                // Find first empty mutate slot
                for (let i = 0; i < this.mutateSlots.length; i++) {
                  if (this.mutateSlots[i] === null) {
                    this.mutateSlots[i] = cardId;
                    break;
                  }
                }
                return;
              }
            }
          } else {
            // Handle loadout view clicks
            // Check if click is on a loadout slot (prioritize removing over adding)
            for (const slotRegion of this.armoryRegions.loadoutSlots) {
              if (this.pointInRect(x, y, slotRegion)) {
                this.state.removeCardFromLoadout(slotRegion.slotIndex);
                return;
              }
            }

            // Check if click is on a gallery card (only if enabled)
            for (const cardRegion of this.armoryRegions.galleryCards) {
              if (this.pointInRect(x, y, cardRegion) && cardRegion.enabled) {
                const success = this.state.addCardToLoadout(cardRegion.cardId);
                if (!success) {
                  console.log("Loadout is full");
                }
                return;
              }
            }
          }
        }

        // Close popup on outside click
        if (!this.pointInRect(x, y, { x: px, y: py, w: pw, h: ph })) {
          this.activePopup = null;
          this.armoryRegions = null;
          this.shopRegions = null;
          this.worldsRegions = null;
          this.galleryScrollOffset = 0; // Reset scroll when closing
          this.showMutateView = false; // Reset mutate view when closing
          // Clear mutate slots when closing (cards stay in collection)
          this.mutateSlots = this.mutateSlots.map(() => null);
        }
        return;
      }

      // Top bar Save/Load
      const buttonRegions = getTopBarButtonRegions(CanvasSize.width);
      if (this.pointInRect(x, y, buttonRegions.save)) {
        this.state.save();
        console.log("Game saved");
        return;
      }
      if (this.pointInRect(x, y, buttonRegions.load)) {
        this.state = GameState.load();
        console.log("Game loaded");
        return;
      }

      // Open popups
      if (this.pointInPolygon(x, y, this.shopPoly)) {
        this.activePopup = "shop";
        return;
      }
      if (this.pointInPolygon(x, y, this.armoryPoly)) {
        this.activePopup = "armory";
        this.showMutateView = false; // Reset to loadout view when opening armory
        // Reset mutate slots when opening armory (ensure we have at least 2 slots)
        const hasAdvancedScroll = (this.state.inventory.items["item_03_mutation_scroll_advanced"] || 0) > 0;
        this.mutateSlots = hasAdvancedScroll ? [null, null, null] : [null, null];
        return;
      }
      if (this.pointInPolygon(x, y, this.worldsPoly)) {
        this.activePopup = "worlds";
        return;
      }
    }
  }

  private renderPopup(ctx: CanvasRenderingContext2D, kind: "shop" | "armory" | "worlds") {
    // Dim background
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, CanvasSize.width, CanvasSize.height);
    // Modal panel
    const px = 224,
      py = 120,
      pw = 832,
      ph = 456;
    drawPanel(ctx, px, py, pw, ph, kind.charAt(0).toUpperCase() + kind.slice(1));
    const tx = px + 16,
      ty = py + 44;

    if (kind === "shop") {
      if (!this.shop) return;
      const npc = this.npcs.find((npc) => npc.id === this.shop!.npcId);
      this.shopRegions = renderShopPanel(
        ctx,
        tx,
        ty,
        pw - 32,
        this.shop,
        npc,
        this.cards,
        this.items,
        this.state.currencies.gold,
        this.state.currencies.plovmand,
        (iconPath, x, y, iw, ih) => this.drawIcon(ctx, iconPath, x, y, iw, ih)
      );
    } else if (kind === "armory") {
      // Ensure mutate slots array has correct length based on advanced scroll
      const hasAdvancedScroll = (this.state.inventory.items["item_03_mutation_scroll_advanced"] || 0) > 0;
      const requiredSlots = hasAdvancedScroll ? 3 : 2;
      while (this.mutateSlots.length < requiredSlots) {
        this.mutateSlots.push(null);
      }
      // Trim to required length if too long
      if (this.mutateSlots.length > requiredSlots) {
        this.mutateSlots = this.mutateSlots.slice(0, requiredSlots);
      }

      this.armoryRegions = renderArmoryPanel(
        ctx,
        tx,
        ty,
        pw - 32,
        py,
        ph,
        this.cards,
        this.state.cardCollection,
        this.state.loadout,
        this.galleryScrollOffset,
        this.showMutateView,
        this.mutateSlots,
        this.state.inventory.items,
        (iconPath, x, y, iw, ih) => this.drawIcon(ctx, iconPath, x, y, iw, ih)
      );
    } else if (kind === "worlds") {
      this.worldsRegions = renderWorldsPanel(
        ctx,
        tx,
        ty,
        px,
        py,
        pw,
        this.worlds,
        this.selectedWorldIndex,
        (icon, x, y, iw, ih) => this.drawIcon(ctx, icon, x, y, iw, ih),
        elementIconPath
      );
    }
  }

  private pointInRect(x: number, y: number, r: { x: number; y: number; w: number; h: number }): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  private pointInPolygon(x: number, y: number, pts: { x: number; y: number }[]): boolean {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x,
        yi = pts[i].y;
      const xj = pts[j].x,
        yj = pts[j].y;
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private tryPerformMutation(): void {
    // Get all filled slots
    const filledSlots = this.mutateSlots.filter((slot) => slot !== null) as string[];

    // Need at least 2 cards
    if (filledSlots.length < 2) {
      return;
    }

    // Find matching mutation (order-independent, accounting for duplicates)
    const mutation = this.mutations.find((m) => {
      if (m.inputCards.length !== filledSlots.length) {
        return false;
      }

      // Create frequency maps for both arrays
      const mutationCounts = new Map<string, number>();
      const slotCounts = new Map<string, number>();

      m.inputCards.forEach((cardId) => {
        mutationCounts.set(cardId, (mutationCounts.get(cardId) || 0) + 1);
      });

      filledSlots.forEach((cardId) => {
        slotCounts.set(cardId, (slotCounts.get(cardId) || 0) + 1);
      });

      // Check if frequency maps match
      if (mutationCounts.size !== slotCounts.size) {
        return false;
      }

      for (const [cardId, count] of mutationCounts.entries()) {
        if (slotCounts.get(cardId) !== count) {
          return false;
        }
      }

      return true;
    });

    if (!mutation) {
      console.log("No valid mutation found for these cards");
      return;
    }

    // Perform mutation
    const success = this.state.performMutation(filledSlots, mutation.resultCard);
    if (success) {
      console.log(`Mutation successful! Created ${mutation.resultCard}`);
      // Clear mutate slots
      this.mutateSlots = this.mutateSlots.map(() => null);
    } else {
      console.log("Mutation failed (cards not available)");
    }
  }
}
