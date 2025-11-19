function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function fitCanvasToContainer(canvas: HTMLCanvasElement, container: HTMLElement) {
  const resize = () => {
    const scale = Math.min(container.clientWidth / canvas.width, container.clientHeight / canvas.height);
    canvas.style.width = `${Math.floor(canvas.width * scale)}px`;
    canvas.style.height = `${Math.floor(canvas.height * scale)}px`;
  };
  window.addEventListener("resize", resize);
  resize();
}

import { Game } from "./engine/Game";
import { BaseScene } from "./scenes/base/BaseScene";
import { WorldScene } from "./scenes/world/WorldScene";
import { BattleScene } from "./scenes/battle/BattleScene";
import { CanvasSize } from "./ui/Layouts";

const app = document.getElementById("app")!;
const canvas = createCanvas(CanvasSize.width, CanvasSize.height);
app.appendChild(canvas);
fitCanvasToContainer(canvas, app);

let baseScene: BaseScene;
let game: Game;

const navigateToBattle = (worldId: string, stageId: string) => {
  const battleScene = new BattleScene(worldId, stageId, () => {
    // Return to world scene
    const worldScene = new WorldScene(
      worldId,
      () => {
        game.setScene(baseScene);
      },
      navigateToBattle
    );
    game.setScene(worldScene);
    worldScene.init();
  });
  game.setScene(battleScene);
  battleScene.init();
};

const navigateToWorld = (worldId: string) => {
  const worldScene = new WorldScene(
    worldId,
    () => {
      // Return to base scene
      game.setScene(baseScene);
    },
    navigateToBattle
  );
  game.setScene(worldScene);
  worldScene.init();
};

baseScene = new BaseScene(navigateToWorld);
game = new Game(canvas, baseScene);
game.start();
