// Rook Marlow: on-foot movement, driving, health, money, wanted heat.
import { clamp, dist, angleDiff } from './util.js';
import { hitBuilding, onRoad, inWater, WORLD } from './city.js';

export const WALK_SPEED = 210;
export const RUN_SPEED = 330;

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.angle = -Math.PI / 2;      // facing
    this.speed = 0;
    this.health = 100;
    this.money = 120;
    this.respect = 0;
    this.wanted = 0;                // 0..5 stars
    this.wantedTimer = 0;           // time since last crime
    this.car = null;                // vehicle object when driving
    this.aimAngle = 0;
    this.shootCooldown = 0;
    this.hurtFlash = 0;
    this.dead = false;
    this.busted = false;
    this.onFoot = true;
  }

  reset(x, y) {
    this.x = x; this.y = y;
    this.health = 100; this.wanted = 0; this.wantedTimer = 0;
    this.car = null; this.onFoot = true; this.dead = false; this.busted = false;
    this.angle = -Math.PI / 2;
  }

  addWanted(n) {
    this.wanted = clamp(this.wanted + n, 0, 5);
    this.wantedTimer = 0;
  }

  update(dt, input, city, camera) {
    if (this.dead || this.busted) return;
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.wantedTimer += dt;
    // Wanted cools off after 45 s with no new crime and no cop nearby.
    if (this.wanted > 0 && this.wantedTimer > 45) {
      this.wanted -= 1;
      this.wantedTimer = 0;
    }
    if (this.car) {
      this.drive(dt, input);
    } else {
      this.walk(dt, input, city);
    }
    // Aim follows the mouse (screen -> world).
    const wx = camera.x + input.mouseX / camera.zoom;
    const wy = camera.y + input.mouseY / camera.zoom;
    this.aimAngle = Math.atan2(wy - this.y, wx - this.x);
    if (!this.car) this.angle = this.aimAngle;
  }

  walk(dt, input, city) {
    const a = input.axes();
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const sp = (sprint ? RUN_SPEED : WALK_SPEED);
    let vx = a.x * sp, vy = a.y * sp;
    if (vx !== 0 && vy !== 0) { vx *= 0.7071; vy *= 0.7071; }
    this.speed = Math.sqrt(vx * vx + vy * vy);
    const nx = this.x + vx * dt, ny = this.y + vy * dt;
    if (!hitBuilding(city, nx, this.y, 12) && !inWater(nx, this.y)) this.x = nx;
    if (!hitBuilding(city, this.x, ny, 12) && !inWater(this.x, ny)) this.y = ny;
    this.x = clamp(this.x, 10, WORLD - 10);
    this.y = clamp(this.y, 10, WORLD - 10);
  }

  drive(dt, input) {
    const car = this.car;
    const a = input.axes();
    const forward = this.shotDrive ? 1 : -a.y; // shot scenes keep the car rolling
    const steer = a.x;
    const handbrake = input.down('Space');
    const maxSpeed = car.topSpeed;
    car.speed += forward * car.accel * dt;
    if (forward === 0) car.speed *= (1 - 0.6 * dt); // coast drag
    if (handbrake) car.speed *= (1 - 3.2 * dt);
    car.speed = clamp(car.speed, -maxSpeed * 0.45, maxSpeed);
    const turn = steer * car.handling * (car.speed / maxSpeed) * (car.speed >= 0 ? 1 : -1);
    car.angle += turn * dt * (handbrake ? 1.5 : 1);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const hit = hitBuilding(this.cityRef, nx, ny, 20);
    if (hit) {
      if (Math.abs(car.speed) > 260) {
        this.damage(6);
        if (this.onCrash) this.onCrash();
      }
      car.speed *= -0.25;
    } else {
      car.x = nx; car.y = ny;
    }
    car.x = clamp(car.x, 10, WORLD - 10);
    car.y = clamp(car.y, 10, WORLD - 10);
    this.x = car.x; this.y = car.y;
    this.speed = Math.abs(car.speed);
    this.angle = car.angle;
  }

  enterCar(car) {
    this.car = car;
    this.onFoot = false;
    car.driver = this;
    car.stolen = true;
  }

  exitCar() {
    if (!this.car) return;
    const car = this.car;
    car.driver = null;
    const side = car.angle + Math.PI / 2;
    this.x = car.x + Math.cos(side) * 34;
    this.y = car.y + Math.sin(side) * 34;
    this.car = null;
    this.onFoot = true;
  }

  damage(n) {
    if (this.dead || this.invulnerable) return;
    this.health -= n;
    this.hurtFlash = 0.35;
    if (this.health <= 0) { this.health = 0; this.dead = true; }
  }

  heal(n) { this.health = clamp(this.health + n, 0, 100); }

  // Nearest drivable car within reach (used by the E key).
  nearestCar(cars, maxDist) {
    let best = null, bd = maxDist;
    for (const c of cars) {
      if (c.wrecked) continue;
      const d = dist(this.x, this.y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
}
