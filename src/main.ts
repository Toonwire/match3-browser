function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function fitCanvasToContainer(canvas: HTMLCanvasElement, container: HTMLElement) {
  const resize = () => {
    const scale = Math.min(
      container.clientWidth / canvas.width,
      container.clientHeight / canvas.height
    );
    canvas.style.width = `${Math.floor(canvas.width * scale)}px`;
    canvas.style.height = `${Math.floor(canvas.height * scale)}px`;
  };
  window.addEventListener('resize', resize);
  resize();
}

import { Game } from './engine/Game';
import { BaseScene } from './scenes/base/BaseScene';

const app = document.getElementById('app')!;
const canvas = createCanvas(800, 600);
app.appendChild(canvas);
fitCanvasToContainer(canvas, app);

const game = new Game(canvas, new BaseScene());
game.start();


