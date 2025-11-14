import { Card } from "../data/types";
import { GameState } from "../state/GameState";

export function drawPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, title?: string) {
  ctx.fillStyle = "#141720";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#2b2f3a";
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (title) {
    ctx.fillStyle = "#9aa3b2";
    ctx.font = "14px system-ui";
    ctx.fillText(title, x + 8, y + 20);
  }
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size = 16,
  color = "#e5e7eb"
) {
  ctx.fillStyle = color;
  ctx.font = `${size}px system-ui`;
  ctx.fillText(text, x, y);
}

export function drawProgressBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  fg = "#3b82f6",
  bg = "#23262d"
) {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fg;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, ratio)) * w, h);
  ctx.strokeStyle = "#2b2f3a";
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

export function drawTopBar(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  state: GameState,
  cards: Card[],
  drawIcon?: (iconPath: string, x: number, y: number, w: number, h: number) => void
) {
  const height = 36;
  // Background strip
  ctx.fillStyle = "#111319";
  ctx.fillRect(0, 0, canvasWidth, height);
  // Bottom border
  ctx.strokeStyle = "#2b2f3a";
  ctx.beginPath();
  ctx.moveTo(0, height + 0.5);
  ctx.lineTo(canvasWidth, height + 0.5);
  ctx.stroke();

  // Text and icons
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "14px system-ui";
  const leftPad = 12;
  const gap = 28;
  const iconSize = 16;
  const iconGap = 6;
  const textY = 22;

  const gold = state.currencies.gold;
  const plovmand = state.currencies.plovmand;
  // map reduce loadout leader and member attack and hp
  const loadoutAttack = [state.loadout.leader, ...state.loadout.members].reduce(
    (acc, cardId) => acc + (cards.find((card) => card.id === cardId)?.attack ?? 0),
    0
  );
  const loadoutHp = [state.loadout.leader, ...state.loadout.members].reduce(
    (acc, cardId) => acc + (cards.find((card) => card.id === cardId)?.hp ?? 0),
    0
  );

  // Gold: amount + icon
  const goldText = `${gold}`;
  ctx.fillText(goldText, leftPad, textY);
  const goldTextWidth = ctx.measureText(goldText).width;
  if (drawIcon) {
    drawIcon(
      "/assets/currencies/coin.png",
      leftPad + goldTextWidth + iconGap,
      (height - iconSize) / 2,
      iconSize,
      iconSize
    );
  }
  const goldTotalWidth = goldTextWidth + (drawIcon ? iconSize + iconGap : 0);

  // Plovmand: amount + icon
  const plovmandText = `${plovmand}`;
  ctx.fillText(plovmandText, leftPad + goldTotalWidth + gap, textY);
  const plovmandTextWidth = ctx.measureText(plovmandText).width;
  if (drawIcon) {
    drawIcon(
      "/assets/currencies/plovmand.png",
      leftPad + goldTotalWidth + gap + plovmandTextWidth + iconGap,
      (height - iconSize) / 2,
      iconSize,
      iconSize
    );
  }

  // loadout attack and hp values in center of the top bar

  const attackText = `Attack: ${loadoutAttack}`;
  ctx.fillText(attackText, (canvasWidth - 80) / 2, textY);
  const loadoutAttackWidth = ctx.measureText(attackText).width;
  const hpText = `HP: ${loadoutHp}`;
  ctx.fillText(hpText, (canvasWidth - 80) / 2 + loadoutAttackWidth + gap, textY);

  // Save/Load buttons on the right
  const buttonHeight = 24;
  const buttonY = (height - buttonHeight) / 2;
  const buttonGap = 8;
  const buttonPadding = 12;
  const rightPad = 12;
  ctx.font = "13px system-ui";

  // Calculate button widths first
  const saveText = "Save";
  const loadText = "Load";
  const saveWidth = ctx.measureText(saveText).width + buttonPadding * 2;
  const loadWidth = ctx.measureText(loadText).width + buttonPadding * 2;

  // Position buttons from right to left
  const loadX = canvasWidth - loadWidth - rightPad;
  const saveX = loadX - saveWidth - buttonGap;

  // Save button
  ctx.fillStyle = "#23262d";
  ctx.fillRect(saveX, buttonY, saveWidth, buttonHeight);
  ctx.strokeStyle = "#2b2f3a";
  ctx.strokeRect(saveX + 0.5, buttonY + 0.5, saveWidth - 1, buttonHeight - 1);
  ctx.fillStyle = "#e5e7eb";
  ctx.fillText(saveText, saveX + buttonPadding, buttonY + 16);

  // Load button
  ctx.fillStyle = "#23262d";
  ctx.fillRect(loadX, buttonY, loadWidth, buttonHeight);
  ctx.strokeStyle = "#2b2f3a";
  ctx.strokeRect(loadX + 0.5, buttonY + 0.5, loadWidth - 1, buttonHeight - 1);
  ctx.fillStyle = "#e5e7eb";
  ctx.fillText(loadText, loadX + buttonPadding, buttonY + 16);
}

export interface TopBarButtonRegions {
  save: { x: number; y: number; w: number; h: number };
  load: { x: number; y: number; w: number; h: number };
}

export function getTopBarButtonRegions(canvasWidth: number): TopBarButtonRegions {
  const height = 36;
  const buttonHeight = 24;
  const buttonY = (height - buttonHeight) / 2;
  const buttonGap = 8;
  const buttonPadding = 12;
  const rightPad = 12;

  // Measure text width (same as in drawTopBar)
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) {
    // Fallback if canvas context unavailable
    return {
      save: { x: 0, y: 0, w: 0, h: 0 },
      load: { x: 0, y: 0, w: 0, h: 0 },
    };
  }
  ctx.font = "13px system-ui";
  const saveWidth = ctx.measureText("Save").width + buttonPadding * 2;
  const loadWidth = ctx.measureText("Load").width + buttonPadding * 2;

  // Position buttons from right to left (same as in drawTopBar)
  const loadX = canvasWidth - loadWidth - rightPad;
  const saveX = loadX - saveWidth - buttonGap;

  return {
    save: { x: saveX, y: buttonY, w: saveWidth, h: buttonHeight },
    load: { x: loadX, y: buttonY, w: loadWidth, h: buttonHeight },
  };
}
