export type Cell = string; // element id

export interface MatchCell {
  x: number;
  y: number;
}
export interface Match {
  element: Cell;
  cells: MatchCell[];
  shape: "line" | "L" | "T";
}

export function findMatches(grid: Cell[][]): Match[] {
  const width = grid[0]?.length ?? 0;
  const height = grid.length;
  const visited = Array.from({ length: height }, () => Array(width).fill(false));
  const matches: Match[] = [];

  // horizontal
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      const e = grid[y][x];
      let len = 1;
      while (x + len < width && grid[y][x + len] === e) len++;
      if (len >= 3) {
        const cells: MatchCell[] = [];
        for (let i = 0; i < len; i++) {
          cells.push({ x: x + i, y });
          visited[y][x + i] = true;
        }
        matches.push({ element: e, cells, shape: "line" });
      }
      x += len;
    }
  }

  // vertical
  for (let x = 0; x < width; x++) {
    let y = 0;
    while (y < height) {
      const e = grid[y][x];
      let len = 1;
      while (y + len < height && grid[y + len][x] === e) len++;
      if (len >= 3) {
        const cells: MatchCell[] = [];
        for (let i = 0; i < len; i++) {
          cells.push({ x, y: y + i });
          visited[y + i][x] = true;
        }
        matches.push({ element: e, cells, shape: "line" });
      }
      y += len;
    }
  }

  // Merge overlapping (to detect L/T)
  if (matches.length > 0) {
    const merged: Match[] = [];
    for (const m of matches) {
      let appended = false;
      for (const mm of merged) {
        if (mm.element === m.element && overlaps(mm.cells, m.cells)) {
          mm.cells = uniqueCells([...mm.cells, ...m.cells]);
          mm.shape = detectShape(mm.cells);
          appended = true;
          break;
        }
      }
      if (!appended) merged.push({ ...m });
    }
    return merged.map((m) => ({
      ...m,
      cells: uniqueCells(m.cells),
      shape: detectShape(m.cells),
    }));
  }

  return [];
}

function overlaps(a: MatchCell[] | undefined, b: MatchCell[] | undefined): boolean {
  if (!a || !b) return false;
  const set = new Set(a.map((c) => `${c.x},${c.y}`));
  return b.some((c) => set.has(`${c.x},${c.y}`));
}

function detectShape(cells: MatchCell[]): "line" | "L" | "T" {
  // Simple heuristic: if both axes have at least 3 covered coordinates, call it L/T
  const xs = new Map<number, number>();
  const ys = new Map<number, number>();
  for (const c of cells) {
    xs.set(c.x, (xs.get(c.x) ?? 0) + 1);
    ys.set(c.y, (ys.get(c.y) ?? 0) + 1);
  }
  const hasLineX = [...ys.values()].some((v) => v >= 3);
  const hasLineY = [...xs.values()].some((v) => v >= 3);
  return hasLineX && hasLineY ? "T" : "line";
}

function uniqueCells(cells: MatchCell[]): MatchCell[] {
  const seen = new Set<string>();
  const out: MatchCell[] = [];
  for (const c of cells) {
    const k = `${c.x},${c.y}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(c);
    }
  }
  return out;
}
