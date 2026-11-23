// Vehicles: parked cars to steal, traffic that cruises the road grid, and
// police interceptors. All cars are plain data + steering, drawn by render.js.
import { clamp, dist, angleDiff, angleTo, pick } from './util.js';
import { hitBuilding, nearestRoadPoint, onRoad, randomStreetPoint, WORLD, ROAD_STEP } from './city.js';

const CAR_MODELS = [
  { name: 'Comet GT', color: '#e4572e', topSpeed: 560, accel: 420, handling: 2.6, len: 46, wid: 22 },
  { name: 'Sunrise Sedan', color: '#3c7ac9', topSpeed: 430, accel: 320, handling: 2.2, len: 44, wid: 21 },
  { name: 'Palmetto', color: '#c9a13c', topSpeed: 400, accel: 300, handling: 2.0, len: 42, wid: 21 },
  { name: 'Vulture Lowrider', color: '#8a5ac9', topSpeed: 470, accel: 360, handling: 2.3, len: 45, wid: 22 },
  { name: 'Dock Hauler', color: '#3c9a5a', topSpeed: 340, accel: 240, handling: 1.6, len: 54, wid: 24 },
  { name: 'Taxi Cab', color: '#e8c832', topSpeed: 440, accel: 330, handling: 2.2, len: 44, wid: 21 },
];

export function makeCar(x, y, angle, modelIdx, opts) {
  const m = CAR_MODELS[modelIdx % CAR_MODELS.length];
  return {
    x, y, angle, speed: 0,
    model: m.name, color: m.color,
    topSpeed: m.topSpeed, accel: m.accel, handling: m.handling,
    len: m.len, wid: m.wid,
    driver: null, stolen: false, wrecked: false,
    isPolice: !!(opts && opts.police),
    isTraffic: !!(opts && opts.traffic),
    targetAngle: angle, cruise: 150 + Math.random() * 60,
    stuck: 0, honk: 0,
  };
}

export function spawnParkedCars(city, rng, count) {
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard++ < count * 40) {
    const p = randomStreetPoint(rng);
    const road = nearestRoadPoint(p.x, p.y);
    const alongRoad = Math.abs(p.x - road.x) < Math.abs(p.y - road.y);
    const x = road.x + (alongRoad ? (rng() < 0.5 ? -34 : 34) : (rng() * 40 - 20));
    const y = road.y + (alongRoad ? (rng() * 40 - 20) : (rng() < 0.5 ? -34 : 34));
    if (hitBuilding(city, x, y, 30)) continue;
    if (!onRoad(x, y)) continue; // parked cars sit on the road, never on buildings
    cars.push(makeCar(x, y, alongRoad ? 0 : Math.PI / 2, Math.floor(rng() * CAR_MODELS.length), {}));
  }
  return cars;
}

export function spawnTraffic(city, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = randomStreetPoint(rng);
    const road = nearestRoadPoint(p.x, p.y);
    const c = makeCar(road.x, road.y, rng() < 0.5 ? 0 : Math.PI / 2, Math.floor(rng() * CAR_MODELS.length), { traffic: true });
    c.speed = c.cruise;
    cars.push(c);
  }
  return cars;
}

export function makePoliceCar(x, y) {
  const c = makeCar(x, y, 0, 1, { police: true });
  c.model = 'SPD Interceptor';
  c.color = '#222831';
  c.topSpeed = 600; c.accel = 460; c.handling = 2.9;
  return c;
}

// Traffic cars follow the road grid: drive along their lane, turn at intersections.
export function updateTraffic(car, dt, city, rng) {
  if (car.driver) return; // player-driven
  const target = car.speed < car.cruise ? car.cruise : car.speed;
  car.speed += (target - car.speed) * dt * 0.8;
  // At an intersection, sometimes turn.
  const onX = Math.abs(car.x % ROAD_STEP) < 6 || Math.abs(car.x % ROAD_STEP - ROAD_STEP) < 6;
  const onY = Math.abs(car.y % ROAD_STEP) < 6 || Math.abs(car.y % ROAD_STEP - ROAD_STEP) < 6;
  if (onX && onY && rng() < dt * 0.5) {
    car.angle = Math.round(car.angle / (Math.PI / 2)) * (Math.PI / 2) + (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) * (rng() < 0.5 ? 1 : 0);
  }
  // Steer toward the nearest road centre line.
  const road = nearestRoadPoint(car.x, car.y);
  const wantAngle = Math.abs(car.x - road.x) < Math.abs(car.y - road.y)
    ? (car.angle > -Math.PI / 2 && car.angle < Math.PI / 2 ? 0 : Math.PI)
    : (car.angle > 0 && car.angle < Math.PI ? Math.PI / 2 : -Math.PI / 2);
  car.angle += angleDiff(car.angle, wantAngle) * Math.min(1, dt * 2.2);
  // Gentle pull onto the lane.
  if (Math.abs(car.x - road.x) < Math.abs(car.y - road.y)) car.x += (road.x - car.x) * dt * 1.5;
  else car.y += (road.y - car.y) * dt * 1.5;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (hitBuilding(city, car.x, car.y, 20)) {
    car.angle += Math.PI / 2;
    car.x -= Math.cos(car.angle) * car.speed * dt * 2;
    car.y -= Math.sin(car.angle) * car.speed * dt * 2;
  }
  car.x = clamp(car.x, 10, WORLD - 10);
  car.y = clamp(car.y, 10, WORLD - 10);
}

// Police interceptor: pursue the player, ram to stop them.
export function updatePoliceCar(car, dt, player, city) {
  const d = dist(car.x, car.y, player.x, player.y);
  const want = angleTo(car.x, car.y, player.x, player.y);
  car.angle += angleDiff(car.angle, want) * Math.min(1, dt * 3.2);
  const targetSpeed = d > 320 ? car.topSpeed : car.topSpeed * 0.75;
  car.speed += (targetSpeed - car.speed) * dt * 1.2;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!hitBuilding(city, nx, ny, 20)) { car.x = nx; car.y = ny; }
  else { car.angle += Math.PI * 0.5; car.speed *= 0.4; }
  // Ram: damage the player's car / player on contact.
  if (d < 46) {
    if (player.car) {
      player.car.speed *= 0.86;
      if (Math.abs(player.car.speed) > 200) player.damage(3 * dt * 10);
    } else if (!player.dead) {
      player.damage(14 * dt);
    }
  }
  return d;
}
