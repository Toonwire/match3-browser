export interface EnemyState {
  id: string;
  name: string;
  hp: number;
  element?: "Fire" | "Water" | "Grass" | "Dark" | "Light" | "Healing";
  attack: number;
}

export function enemyTurn(
  enemies: EnemyState[],
  playerHp: number,
): { playerHp: number } {
  let hp = playerHp;
  for (const e of enemies) {
    if (e.hp > 0) {
      hp -= e.attack;
    }
  }
  return { playerHp: Math.max(0, hp) };
}
