// Solmar city layout: a deterministic road grid, building blocks, a beach strip
// on the south shore and container docks on the east edge.
import { mulberry32, pick } from './util.js';

export const WORLD = 3600;          // world is WORLD x WORLD pixels
export const ROAD_STEP = 320;       // distance between road centre lines
export const ROAD_W = 96;           // road width
export const BEACH_Y = WORLD - 260; // beach strip starts here
export const DOCK_X = WORLD - 300;  // docks start here

const ROOF_COLORS = ['#b5654a', '#7a6a8a', '#4a7a8c', '#8c6a4a', '#5a4a6a', '#a05a6a', '#6a8a5a'];
const WALL_COLORS = ['#c9a06a', '#b08a7a', '#9a8a6a', '#8a7a9a', '#7a9a8a', '#c9b18a'];

export function generateCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const parks = [];
  const trees = [];
  // Blocks between roads: roads run at x = i*ROAD_STEP, blocks sit between them.
  for (let bx = 0; bx < WORLD / ROAD_STEP - 1; bx++) {
    for (let by = 0; by < WORLD / ROAD_STEP - 1; by++) {
      const x0 = bx * ROAD_STEP + ROAD_W / 2 + 14;
      const y0 = by * ROAD_STEP + ROAD_W / 2 + 14;
      const w = ROAD_STEP - ROAD_W - 28;
      const h = ROAD_STEP - ROAD_W - 28;
      if (y0 > BEACH_Y - 40 || x0 > DOCK_X - 40) continue; // beach / docks, no blocks
      const roll = rng();
      if (roll < 0.16) {
        parks.push({ x: x0, y: y0, w, h, seed: Math.floor(rng() * 1e9) });
        for (let t = 0; t < 7; t++) {
          trees.push({ x: x0 + 20 + rng() * (w - 40), y: y0 + 20 + rng() * (h - 40), r: 10 + rng() * 8 });
        }
        continue;
      }
      // 1-4 buildings per block, never overlapping each other.
      const n = 1 + Math.floor(rng() * 3);
      const placed = [];
      for (let i = 0; i < n; i++) {
        const bw = 60 + rng() * (w / 2);
        const bh = 60 + rng() * (h / 2);
        const bx2 = x0 + rng() * Math.max(1, w - bw);
        const by2 = y0 + rng() * Math.max(1, h - bh);
        let overlaps = false;
        for (const o of placed) {
          if (bx2 < o.x + o.w + 10 && bx2 + bw + 10 > o.x && by2 < o.y + o.h + 10 && by2 + bh + 10 > o.y) { overlaps = true; break; }
        }
        if (overlaps) continue;
        const b = {
          x: bx2, y: by2, w: bw, h: bh,
          height: 1 + Math.floor(rng() * 4),
          roof: pick(rng, ROOF_COLORS), wall: pick(rng, WALL_COLORS),
          name: pick(rng, ['HOTEL', 'APTS', 'OFFICE', 'SHOP', 'Diner', 'Motel', 'Arcade', 'Gym', 'Bank']),
        };
        placed.push(b);
        buildings.push(b);
      }
    }
  }
  // Docks: container rows on the east edge.
  const containers = [];
  for (let i = 0; i < 26; i++) {
    containers.push({
      x: DOCK_X + 20 + (i % 5) * 56,
      y: 200 + Math.floor(i / 5) * 90 + (rng() * 20 - 10),
      w: 48, h: 76,
      color: pick(rng, ['#c9563c', '#3c7ac9', '#c9a13c', '#3c9a5a', '#8a5ac9']),
    });
  }
  return { buildings, parks, trees, containers, seed };
}

export function onRoad(x, y) {
  if (x < 0 || y < 0 || x > WORLD || y > WORLD) return false;
  const mx = x % ROAD_STEP, my = y % ROAD_STEP;
  return mx < ROAD_W / 2 || mx > ROAD_STEP - ROAD_W / 2 || my < ROAD_W / 2 || my > ROAD_STEP - ROAD_W / 2;
}

export function inBeach(x, y) { return y > BEACH_Y && x < DOCK_X; }
export function inWater(x, y) { return y > WORLD - 70 || x > WORLD - 60; }
export function inDocks(x, y) { return x > DOCK_X && y < BEACH_Y; }

// Nearest point on a road centre line (for spawning traffic / snapping).
export function nearestRoadPoint(x, y) {
  const cx = Math.round(x / ROAD_STEP) * ROAD_STEP;
  const cy = Math.round(y / ROAD_STEP) * ROAD_STEP;
  const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
  return dx < dy ? { x: cx, y } : { x, y: cy };
}

// Circle vs building AABB collision; returns the building hit or null.
export function hitBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  for (const c of city.containers) {
    if (x + r > c.x && x - r < c.x + c.w && y + r > c.y && y - r < c.y + c.h) return c;
  }
  return null;
}

export function randomStreetPoint(rng) {
  const i = Math.floor(rng() * (WORLD / ROAD_STEP));
  const j = Math.floor(rng() * (WORLD / ROAD_STEP));
  return { x: i * ROAD_STEP + (rng() * 60 - 30), y: j * ROAD_STEP + (rng() * 60 - 30) };
}
