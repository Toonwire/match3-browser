export const CanvasSize = { width: 1280, height: 720 } as const;

export const BattleLayout = {
  enemies: { x: 704, y: 96, w: 512, h: 192 }, // Scaled and increased height for larger enemies
  enemyHp: { x: 704, y: 245, w: 512, h: 28 }, // Scaled and increased height
  timer: { x: 64, y: 300, w: 1152, h: 20 }, // Wider and taller for better visibility
  playerHp: { x: 64, y: 332, w: 1152, h: 20 }, // Wider and taller
  grid: { x: 64, y: 364, w: 1152, h: 324 }, // Much larger grid area
};

export const BaseLayout = {
  shop: { x: 64, y: 48, w: 512, h: 264 },
  armory: { x: 704, y: 48, w: 512, h: 264 },
  worlds: { x: 192, y: 360, w: 896, h: 288 },
};
