const SIZE = 25;

function modules(seed: string): boolean[][] {
  let state = 0;
  for (const char of seed) state = (Math.imul(state, 31) + char.charCodeAt(0)) >>> 0;
  const grid = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => false));
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      grid[y][x] = (state >>> 16) % 2 === 0;
    }
  }
  const finder = (left: number, top: number) => {
    for (let y = -1; y <= 7; y += 1) {
      for (let x = -1; x <= 7; x += 1) {
        const gx = left + x;
        const gy = top + y;
        if (gx < 0 || gy < 0 || gx >= SIZE || gy >= SIZE) continue;
        const edge = x === 0 || x === 6 || y === 0 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        grid[gy][gx] = x >= 0 && x <= 6 && y >= 0 && y <= 6 && (edge || core);
      }
    }
  };
  finder(0, 0);
  finder(SIZE - 7, 0);
  finder(0, SIZE - 7);
  return grid;
}

export function MockQr({ value, label, size = 168 }: { value: string; label: string; size?: number }) {
  const grid = modules(value);
  return (
    <svg width={size} height={size} viewBox={`-2 -2 ${SIZE + 4} ${SIZE + 4}`} role="img" aria-label={label} shapeRendering="crispEdges" data-tk="mock-qr">
      <rect x="-2" y="-2" width={SIZE + 4} height={SIZE + 4} fill="#fff" />
      {grid.flatMap((row, y) => row.map((on, x) => (on ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#111" /> : null)))}
    </svg>
  );
}
