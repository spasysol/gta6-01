// Pedestrians: Solmar citizens strolling the sidewalks, fleeing gunfire and
// crashes, and occasionally flagging a taxi. Pure ambience with a little fear.
import { clamp, dist, pick, angleTo } from './util.js';
import { hitBuilding, randomStreetPoint, WORLD } from './city.js';

const SHIRTS = ['#e4572e', '#3c7ac9', '#c9a13c', '#3c9a5a', '#e8e8e8', '#c95a8a', '#5a8ac9', '#f2f2f2'];
const SKINS = ['#f2c89b', '#d9a06b', '#a06b3f', '#8a5a32', '#e8b88a'];

export function spawnPedestrians(city, rng, count) {
  const peds = [];
  let guard = 0;
  while (peds.length < count && guard++ < count * 30) {
    const p = randomStreetPoint(rng);
    const x = p.x + (rng() * 80 - 40), y = p.y + (rng() * 80 - 40);
    if (hitBuilding(city, x, y, 12)) continue; // never spawn inside a building
    peds.push({
      x, y,
      angle: rng() * Math.PI * 2,
      speed: 34 + rng() * 30,
      shirt: pick(rng, SHIRTS), skin: pick(rng, SKINS),
      walkPhase: rng() * Math.PI * 2,
      panic: 0, panicAngle: 0,
      wanderTimer: 1 + rng() * 3,
    });
  }
  return peds;
}

export function updatePedestrians(peds, dt, city, player, gunfire) {
  for (const p of peds) {
    p.walkPhase += dt * 6;
    // Panic: gunfire nearby, or the player speeding through in a car.
    let threat = null;
    if (gunfire && dist(p.x, p.y, gunfire.x, gunfire.y) < 260) threat = gunfire;
    else if (player.car && player.speed > 240 && dist(p.x, p.y, player.x, player.y) < 130) threat = player;
    else if (!player.car && player.speed > 200 && dist(p.x, p.y, player.x, player.y) < 60) threat = player;
    if (threat) {
      p.panic = 2.2;
      p.panicAngle = angleTo(threat.x, threat.y, p.x, p.y);
    }
    p.panic = Math.max(0, p.panic - dt);
    if (p.panic > 0) {
      p.angle = p.panicAngle;
      movePed(p, dt, city, 190);
    } else {
      p.wanderTimer -= dt;
      if (p.wanderTimer <= 0) {
        p.wanderTimer = 2 + Math.random() * 4;
        p.angle += (Math.random() - 0.5) * 2.4;
      }
      movePed(p, dt, city, p.speed);
    }
  }
}

function movePed(p, dt, city, speed) {
  const nx = p.x + Math.cos(p.angle) * speed * dt;
  const ny = p.y + Math.sin(p.angle) * speed * dt;
  if (!hitBuilding(city, nx, p.y, 8)) p.x = nx;
  if (!hitBuilding(city, p.x, ny, 8)) p.y = ny;
  p.x = clamp(p.x, 10, WORLD - 10);
  p.y = clamp(p.y, 10, WORLD - 10);
  if (hitBuilding(city, p.x, p.y, 8)) p.angle += Math.PI / 2;
}

// A pedestrian hit by a fast car: ragdolls away and counts as a crime.
export function carHitsPed(player, peds, cars) {
  for (const p of peds) {
    if (p.down) continue;
    for (const c of cars) {
      if (c.driver !== player || Math.abs(c.speed) < 120) continue;
      if (dist(p.x, p.y, c.x, c.y) < 26) {
        p.down = true;
        p.downTimer = 6;
        player.addWanted(1);
        return p;
      }
    }
  }
  return null;
}
