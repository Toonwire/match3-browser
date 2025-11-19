import { Scene } from "./Scene";

export class Game {
  private currentScene: Scene;
  private lastTime = performance.now();

  constructor(private readonly canvas: HTMLCanvasElement, scene: Scene) {
    this.currentScene = scene;
    // Forward pointer clicks to the active scene with canvas-space coordinates
    this.canvas.addEventListener("click", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const ev = new CustomEvent("scene-click", { detail: { x, y } });
      this.currentScene.onEvent(ev);
    });

    // Forward wheel events for scrolling
    this.canvas.addEventListener("wheel", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const ev = new CustomEvent("scene-wheel", {
        detail: { x, y, deltaY: e.deltaY },
      });
      this.currentScene.onEvent(ev);
      e.preventDefault();
    });

    // Forward mouse down events
    this.canvas.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return; // Only handle left mouse button
      e.preventDefault(); // Prevent text selection during drag
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const ev = new CustomEvent("scene-mousedown", { detail: { x, y } });
      this.currentScene.onEvent(ev);
    });

    // Forward mouse move events
    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const ev = new CustomEvent("scene-mousemove", { detail: { x, y } });
      this.currentScene.onEvent(ev);
    });

    // Forward mouse up events (on window to catch even if mouse leaves canvas)
    window.addEventListener("mouseup", (e) => {
      if (e.button !== 0) return; // Only handle left mouse button
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const ev = new CustomEvent("scene-mouseup", { detail: { x, y } });
      this.currentScene.onEvent(ev);
    });

    // // Throttled mouse move logging for hit region tuning
    // let lastLog = 0;
    // this.canvas.addEventListener("mousemove", (e) => {
    //   const now = performance.now();
    //   if (now - lastLog < 50) return; // ~20 fps logging
    //   lastLog = now;
    //   const rect = this.canvas.getBoundingClientRect();
    //   const scaleX = this.canvas.width / rect.width;
    //   const scaleY = this.canvas.height / rect.height;
    //   const x = (e.clientX - rect.left) * scaleX;
    //   const y = (e.clientY - rect.top) * scaleY;
    //   // Round for readability
    //   console.log(`mouse: ${Math.round(x)}, ${Math.round(y)}`);
    // });
  }

  async start() {
    await this.currentScene.init();
    const frame = (time: number) => {
      const deltaSeconds = (time - this.lastTime) / 1000;
      this.lastTime = time;
      this.currentScene.update(deltaSeconds);
      const ctx = this.canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.currentScene.render(ctx);
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  setScene(scene: Scene) {
    this.currentScene = scene;
  }
}
