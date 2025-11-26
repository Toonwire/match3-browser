export const CanvasSize = { width: 1280, height: 720 } as const;

export const BattleLayout = {
  playerUnits: { x: 64, y: 96, w: 512, h: 192 }, // Player loadout units on left side
  playerUnitHp: { x: 64, y: 245, w: 512, h: 28 }, // Player unit HP bars
  enemies: { x: 704, y: 96, w: 512, h: 192 }, // Scaled and increased height for larger enemies
  enemyHp: { x: 704, y: 245, w: 512, h: 28 }, // Scaled and increased height
  timer: { x: 64, y: 332, w: 1152, h: 20 }, // Wider and taller
  grid: { x: 64, y: 364, w: 800, h: 324 }, // Grid area (reduced width to make room for combat log)
  combatLog: { x: 880, y: 364, w: 336, h: 324 }, // Combat log to the right of grid
};

export const BaseLayout = {
  shop: { x: 315, y: 120, w: 295, h: 264 },
  armory: { x: 645, y: 120, w: 255, h: 250 },
  worlds: { x: 500, y: 440, w: 215, h: 240 },
};
