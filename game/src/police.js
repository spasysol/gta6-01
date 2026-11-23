// The Solmar Police Department: wanted stars, interceptor spawns, foot cops,
// busts and heat decay. The louder Rook plays, the harder the city answers.
import { clamp, dist } from './util.js';
import { makePoliceCar } from './vehicles.js';
import { WORLD } from './city.js';

export class Police {
  constructor() {
    this.cars = [];        // interceptor vehicles
    this.cops = [];        // on-foot officers
    this.spawnTimer = 0;
    this.siren = false;
  }

  maxUnits(wanted) {
    return wanted <= 0 ? 0 : wanted <= 1 ? 2 : wanted <= 2 ? 3 : wanted <= 3 ? 5 : wanted <= 4 ? 7 : 9;
  }

  update(dt, player, city, rng) {
    const wanted = player.wanted;
    this.siren = wanted > 0;
    this.spawnTimer -= dt;
    const want = this.maxUnits(wanted);
    if (wanted > 0 && this.spawnTimer <= 0 && this.cars.length + this.cops.length < want) {
      this.spawnTimer = wanted >= 4 ? 1.2 : 2.4;
      this.spawnUnit(player, wanted);
    }
    // Despawn units that fell far behind when the heat is off.
    if (wanted === 0) {
      this.cars = this.cars.filter((c) => dist(c.x, c.y, player.x, player.y) < 1400);
      this.cops = this.cops.filter((c) => dist(c.x, c.y, player.x, player.y) < 900);
    }
    // Foot cops chase on foot; in a car the player is pursued by interceptors.
    for (const cop of this.cops) {
      const d = dist(cop.x, cop.y, player.x, player.y);
      const ang = Math.atan2(player.y - cop.y, player.x - cop.x);
      cop.angle = ang;
      const sp = d > 200 ? 235 : 190;
      cop.x += Math.cos(ang) * sp * dt;
      cop.y += Math.sin(ang) * sp * dt;
      cop.walkPhase += dt * 9;
      // Busted: a cop reaches Rook on foot.
      if (d < 26 && player.onFoot && !player.dead) {
        player.busted = true;
      }
      // A cop that catches a slow car drags Rook out.
      if (d < 30 && player.car && Math.abs(player.car.speed) < 60) {
        player.exitCar();
        player.busted = true;
      }
    }
    // Keep cops inside the world.
    for (const cop of this.cops) {
      cop.x = clamp(cop.x, 10, WORLD - 10);
      cop.y = clamp(cop.y, 10, WORLD - 10);
    }
  }

  spawnUnit(player, wanted) {
    // Spawn just off-screen from the player, on a road.
    const ang = Math.random() * Math.PI * 2;
    const r = 700 + Math.random() * 200;
    let x = player.x + Math.cos(ang) * r;
    let y = player.y + Math.sin(ang) * r;
    x = clamp(x, 60, WORLD - 60);
    y = clamp(y, 60, WORLD - 60);
    if (wanted >= 2 || player.car || Math.random() < 0.6) {
      const car = makePoliceCar(x, y);
      car.angle = Math.atan2(player.y - y, player.x - x);
      this.cars.push(car);
    } else {
      this.cops.push({ x, y, angle: 0, walkPhase: 0 });
    }
  }

  // Pay-and-spray: lose the heat for cash at a garage.
  clearHeat(player) {
    if (player.wanted === 0) return false;
    const cost = 150 * player.wanted;
    if (player.money < cost) return false;
    player.money -= cost;
    player.wanted = 0;
    player.wantedTimer = 0;
    this.cars = [];
    this.cops = [];
    return true;
  }
}
