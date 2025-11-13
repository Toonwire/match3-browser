export abstract class Scene {
  init(): Promise<void> | void {}
  update(_dt: number): void {}
  render(_ctx: CanvasRenderingContext2D): void {}
  onEvent(_e: Event): void {}
}
