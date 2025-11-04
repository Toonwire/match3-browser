export class Timer {
  private elapsed = 0;

  update(dtSeconds: number) {
    this.elapsed += dtSeconds;
  }

  getElapsed(): number {
    return this.elapsed;
  }

  reset() {
    this.elapsed = 0;
  }
}


