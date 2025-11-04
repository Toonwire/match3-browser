import type { Cell, Match } from './MatchLogic';
import { findMatches } from './MatchLogic';

export class Match3Grid {
  private grid: Cell[][];

  constructor(
    public readonly width = 5,
    public readonly height = 5,
    private readonly elements: Cell[] = ['Fire', 'Water', 'Grass', 'Dark', 'Light', 'Healing']
  ) {
    this.grid = Array.from({ length: height }, () => Array<Cell>(width).fill(''));
    this.refillAll();
    // Ensure no immediate matches on spawn by reshuffling offending cells
    while (findMatches(this.grid).length > 0) {
      this.refillAll();
    }
  }

  getGrid(): ReadonlyArray<ReadonlyArray<Cell>> {
    return this.grid;
  }

  swap(x1: number, y1: number, x2: number, y2: number): { valid: boolean; matches: Match[] } {
    if (!this.inBounds(x1, y1) || !this.inBounds(x2, y2)) return { valid: false, matches: [] };
    if (Math.abs(x1 - x2) + Math.abs(y1 - y2) !== 1) return { valid: false, matches: [] };
    this.swapCells(x1, y1, x2, y2);
    const matches = findMatches(this.grid);
    if (matches.length === 0) {
      // swap back
      this.swapCells(x1, y1, x2, y2);
      return { valid: false, matches: [] };
    }
    return { valid: true, matches };
  }

  resolveAll(): { totalCleared: number; cascades: number; lastMatches: Match[] } {
    let cascades = 0;
    let totalCleared = 0;
    let last: Match[] = [];
    while (true) {
      const matches = findMatches(this.grid);
      if (matches.length === 0) break;
      last = matches;
      totalCleared += this.clearMatches(matches);
      this.compactAndRefill();
      cascades++;
    }
    return { totalCleared, cascades, lastMatches: last };
  }

  private inBounds(x: number, y: number) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  private swapCells(x1: number, y1: number, x2: number, y2: number) {
    const t = this.grid[y1][x1];
    this.grid[y1][x1] = this.grid[y2][x2];
    this.grid[y2][x2] = t;
  }

  private clearMatches(matches: Match[]): number {
    const toClear = new Set<string>();
    for (const m of matches) {
      for (const c of m.cells) toClear.add(`${c.x},${c.y}`);
    }
    for (const key of toClear) {
      const [x, y] = key.split(',').map(Number);
      this.grid[y][x] = '' as Cell; // empty
    }
    return toClear.size;
  }

  private compactAndRefill() {
    // Drop cells down
    for (let x = 0; x < this.width; x++) {
      let writeY = this.height - 1;
      for (let y = this.height - 1; y >= 0; y--) {
        const cell = this.grid[y][x];
        if (cell !== '' && cell !== undefined) {
          this.grid[writeY][x] = cell;
          if (writeY !== y) this.grid[y][x] = '' as Cell;
          writeY--;
        }
      }
      // Refill remaining
      for (let y = writeY; y >= 0; y--) {
        this.grid[y][x] = this.randomElement();
      }
    }
  }

  private refillAll() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.grid[y][x] = this.randomElement();
      }
    }
  }

  private randomElement(): Cell {
    const i = Math.floor(Math.random() * this.elements.length);
    return this.elements[i];
  }
}


