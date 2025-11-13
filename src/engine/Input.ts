export class Input {
  private pressedKeys = new Set<string>();
  private pointerDown = false;
  private pointerX = 0;
  private pointerY = 0;

  constructor(private readonly element: HTMLElement) {
    window.addEventListener("keydown", (e) => this.pressedKeys.add(e.key));
    window.addEventListener("keyup", (e) => this.pressedKeys.delete(e.key));

    element.addEventListener("pointerdown", (e) => {
      this.pointerDown = true;
      this.updatePointer(e);
    });
    element.addEventListener("pointermove", (e) => this.updatePointer(e));
    window.addEventListener("pointerup", () => {
      this.pointerDown = false;
    });
  }

  isKeyDown(key: string): boolean {
    return this.pressedKeys.has(key);
  }

  isPointerDown(): boolean {
    return this.pointerDown;
  }

  getPointer(): { x: number; y: number } {
    return { x: this.pointerX, y: this.pointerY };
  }

  private updatePointer(e: PointerEvent) {
    const rect = this.element.getBoundingClientRect();
    this.pointerX = e.clientX - rect.left;
    this.pointerY = e.clientY - rect.top;
  }
}
