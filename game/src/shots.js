// Screenshot scenes: deterministic setups for the entry's 3-4 screenshots,
// driven by the ?shot= query parameter. Each scene places Rook, cars, police
// and a mission so the frame shows the game at its best.
import { makeCar, makePoliceCar } from './vehicles.js';
import { SPOTS } from './missions.js';
import { hitBuilding } from './city.js';

export function applyShot(game, shot) {
  const p = game.player;
  const rng = game.rng;
  // Common: clear free-roam clutter, fix the clock at golden hour.
  game.clockMinutes = 18 * 60 + 24; // 6:24 PM, sunset light
  game.traffic = game.traffic.filter(() => false);
  game.police.cars = [];
  game.police.cops = [];
  game.combat.enemies = [];
  game.combat.pickups = [];
  p.wanted = 0;
  p.health = 100;
  p.money = 2450;
  p.respect = 60;
  p.invulnerable = true; // screenshot scenes never kill Rook
  if (shot === 'chase') {
    // Cover: Rook fleeing a 3-star chase through downtown, mission on the HUD.
    p.reset(1600, 1600);
    p.invulnerable = true;
    const car = makeCar(1600, 1600, Math.PI / 2, 0, {});
    car.speed = 420;
    game.cars.push(car);
    p.enterCar(car);
    p.shotDrive = true; // keep the getaway rolling for the camera
    p.addWanted(3);
    game.missions.start(4, game); // Getaway Driver — timed drive to the safehouse
    game.missions.timer = 58;
    game.missions.step = 0;
    game.missions.updateMarker();
    spawnChase(game, 5);
    spawnTrafficNear(game, 1600, 1600, 7);
    game.camera.x = 1600 - 640; game.camera.y = 1600 - 360;
  } else if (shot === 'drive') {
    // Sunset cruise down the main strip, traffic all around.
    p.reset(960, 960);
    p.invulnerable = true;
    const car = makeCar(960, 960, 0, 1, {});
    car.speed = 380;
    game.cars.push(car);
    p.enterCar(car);
    p.shotDrive = true;
    game.missions.start(0, game);
    game.missions.step = 1; // delivering the Comet
    game.missions.updateMarker();
    spawnTrafficNear(game, 960, 960, 9);
    spawnPedsNear(game, 960, 960, 8);
    game.camera.x = 960 - 640; game.camera.y = 960 - 360;
  } else if (shot === 'shootout') {
    // On foot at the warehouse: Vultures, muzzle flashes, health bar low.
    p.reset(960, 2400);
    p.invulnerable = true;
    p.health = 62;
    p.money = 1875;
    game.missions.start(3, game); // Payback
    game.missions.step = 0;
    game.missions.updateMarker();
    game.spawnMissionEnemies(SPOTS.warehouse);
    game.combat.pickups.push({ x: 900, y: 2500, kind: 'health', amount: 0 });
    game.combat.pickups.push({ x: 1020, y: 2470, kind: 'cash', amount: 240 });
    spawnParkedNear(game, 960, 2400, 4);
    game.camera.x = 960 - 640; game.camera.y = 2400 - 360;
  } else {
    // 'roam': Rook on foot near the beach strip, city behind him.
    p.reset(1600, 3200);
    p.invulnerable = true;
    game.missions.start(1, game);
    game.missions.step = 0;
    game.missions.updateMarker();
    spawnPedsNear(game, 1600, 3200, 10);
    spawnParkedNear(game, 1600, 3200, 5);
    spawnTrafficNear(game, 1600, 3200, 4);
    game.camera.x = 1600 - 640; game.camera.y = 3200 - 360;
  }
  // Aim the player toward the action so the aim line reads on camera.
  p.aimAngle = p.angle;
}

function spawnChase(game, n) {
  const p = game.player;
  // Interceptors trail Rook from behind (he drives south down the x=1600
  // road), in the same lane so they stay on the asphalt and in frame.
  p.car.topSpeed = 430;
  for (let i = 0; i < n; i++) {
    const car = makePoliceCar(p.x + (i - (n - 1) / 2) * 30, p.y - 230 - i * 70);
    car.angle = Math.PI / 2;
    car.speed = 470;
    car.topSpeed = 500;
    game.police.cars.push(car);
  }
}

function spawnTrafficNear(game, x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = makeCar(x + Math.cos(a) * (180 + i * 55), y + Math.sin(a) * (160 + i * 40), a, i % 6, { traffic: true });
    c.speed = 150;
    game.traffic.push(c);
  }
}

function spawnPedsNear(game, x, y, n) {
  const rng = game.rng;
  for (let i = 0; i < n; i++) {
    const px = x + (rng() * 500 - 250), py = y + (rng() * 360 - 180);
    if (hitBuilding(game.city, px, py, 12)) continue; // never on a rooftop
    game.pedestrians.push({
      x: px, y: py,
      angle: rng() * Math.PI * 2, speed: 40, shirt: '#e4572e', skin: '#f2c89b',
      walkPhase: rng() * 6, panic: 0, panicAngle: 0, wanderTimer: 2,
    });
  }
}

function spawnParkedNear(game, x, y, n) {
  for (let i = 0; i < n; i++) {
    const c = makeCar(x + (i - n / 2) * 70, y - 120, 0, i % 6, {});
    game.cars.push(c);
  }
}
