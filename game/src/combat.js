// Combat: Rook's pistol, rival Vultures who shoot back, bullets, muzzle
// flashes, particles, health and cash pickups.
import { dist, angleTo, clamp } from './util.js';
import { hitBuilding } from './city.js';

export class Combat {
  constructor() {
    this.bullets = [];   // {x,y,angle,speed,fromPlayer,life}
    this.enemies = [];   // rival gang members {x,y,health,angle,shootTimer,walkPhase}
    this.particles = []; // {x,y,vx,vy,life,color,size}
    this.pickups = [];   // {x,y,kind:'health'|'cash',amount}
    this.lastShotPos = null;
  }

  spawnEnemies(list) {
    for (const e of list) {
      this.enemies.push({ ...e, health: 100, angle: 0, shootTimer: 1 + Math.random(), walkPhase: 0 });
    }
  }

  clearEnemies() { this.enemies = []; }

  playerShoot(player) {
    if (player.shootCooldown > 0 || player.car || player.dead) return false;
    player.shootCooldown = 0.22;
    const a = player.aimAngle;
    this.bullets.push({
      x: player.x + Math.cos(a) * 22, y: player.y + Math.sin(a) * 22,
      angle: a, speed: 900, fromPlayer: true, life: 0.9,
    });
    this.lastShotPos = { x: player.x, y: player.y };
    this.spawnParticles(player.x + Math.cos(a) * 26, player.y + Math.sin(a) * 26, 4, '#ffd166', 90);
    return true;
  }

  spawnParticles(x, y, n, color, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + Math.random() * 0.3, color, size: 2 + Math.random() * 3 });
    }
  }

  update(dt, player, city, sound) {
    // Bullets fly, hit buildings, enemies or the player.
    for (const b of this.bullets) {
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      b.life -= dt;
      if (hitBuilding(city, b.x, b.y, 2)) {
        b.life = 0;
        this.spawnParticles(b.x, b.y, 3, '#c9c9c9', 60);
      }
    }
    for (const b of this.bullets) {
      if (b.life <= 0) continue;
      if (b.fromPlayer) {
        for (const e of this.enemies) {
          if (e.health > 0 && dist(b.x, b.y, e.x, e.y) < 16) {
            e.health -= 34;
            b.life = 0;
            this.spawnParticles(e.x, e.y, 8, '#e4572e', 140);
            if (e.health <= 0) {
              this.spawnParticles(e.x, e.y, 18, '#e4572e', 200);
              this.pickups.push({ x: e.x, y: e.y, kind: 'cash', amount: 80 + Math.floor(Math.random() * 120) });
              if (sound) sound.cash();
            }
            break;
          }
        }
      } else if (!player.dead && dist(b.x, b.y, player.x, player.y) < 14) {
        player.damage(9);
        b.life = 0;
        this.spawnParticles(player.x, player.y, 6, '#e4572e', 120);
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
    // Enemies: close in and shoot when they have line of sight.
    for (const e of this.enemies) {
      if (e.health <= 0) continue;
      const d = dist(e.x, e.y, player.x, player.y);
      e.walkPhase += dt * 7;
      if (d > 320) {
        const a = angleTo(e.x, e.y, player.x, player.y);
        e.angle = a;
        const nx = e.x + Math.cos(a) * 120 * dt;
        const ny = e.y + Math.sin(a) * 120 * dt;
        if (!hitBuilding(city, nx, e.y, 10)) e.x = nx;
        if (!hitBuilding(city, e.x, ny, 10)) e.y = ny;
      } else {
        e.angle = angleTo(e.x, e.y, player.x, player.y);
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && !player.dead) {
          e.shootTimer = 0.9 + Math.random() * 0.7;
          const spread = (Math.random() - 0.5) * 0.22;
          this.bullets.push({
            x: e.x + Math.cos(e.angle) * 20, y: e.y + Math.sin(e.angle) * 20,
            angle: e.angle + spread, speed: 620, fromPlayer: false, life: 1.1,
          });
          if (sound) sound.enemyShoot();
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.health > 0 || e.deathTimer > 0);
    // Particles fade.
    for (const p of this.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= (1 - 2.4 * dt); p.vy *= (1 - 2.4 * dt);
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    // Pickups: walk over them to collect.
    for (const p of this.pickups) {
      if (!player.dead && dist(p.x, p.y, player.x, player.y) < 26) {
        if (p.kind === 'health') { player.heal(40); if (sound) sound.pickup(); }
        else { player.money += p.amount; if (sound) sound.cash(); }
        p.taken = true;
      }
    }
    this.pickups = this.pickups.filter((p) => !p.taken);
  }
}
