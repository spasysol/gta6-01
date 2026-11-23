// Rendering: the sun-soaked city, the camera, the HUD and the minimap.
// Everything is drawn on one canvas with flat colours and a warm sunset grade.
import { clamp, dist, formatMoney, formatClock } from './util.js';
import { WORLD, ROAD_STEP, ROAD_W, BEACH_Y, DOCK_X, onRoad } from './city.js';

export class Camera {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.x = 0; this.y = 0;
    this.zoom = 1;
  }
  follow(tx, ty, dt) {
    const zx = this.w / this.zoom, zy = this.h / this.zoom;
    const gx = clamp(tx - zx / 2, 0, Math.max(0, WORLD - zx));
    const gy = clamp(ty - zy / 2, 0, Math.max(0, WORLD - zy));
    this.x += (gx - this.x) * Math.min(1, dt * 5);
    this.y += (gy - this.y) * Math.min(1, dt * 5);
  }
  resize(w, h) { this.w = w; this.h = h; }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  drawWorld(game, dt) {
    const ctx = this.ctx;
    const cam = game.camera;
    const city = game.city;
    const vw = cam.w / cam.zoom, vh = cam.h / cam.zoom;
    ctx.save();
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    // Ground.
    ctx.fillStyle = '#c9a06a';
    ctx.fillRect(cam.x - 10, cam.y - 10, vw + 20, vh + 20);
    const x0 = Math.max(0, Math.floor(cam.x / ROAD_STEP) * ROAD_STEP - ROAD_STEP);
    const x1 = Math.min(WORLD, cam.x + vw + ROAD_STEP);
    const y0 = Math.max(0, Math.floor(cam.y / ROAD_STEP) * ROAD_STEP - ROAD_STEP);
    const y1 = Math.min(WORLD, cam.y + vh + ROAD_STEP);
    // Beach + sea (south).
    if (y1 > BEACH_Y) {
      ctx.fillStyle = '#f2d8a0';
      ctx.fillRect(Math.max(cam.x, 0), BEACH_Y, Math.min(vw, DOCK_X), Math.min(vh, WORLD - BEACH_Y));
      ctx.fillStyle = '#3c7ac9';
      ctx.fillRect(Math.max(cam.x, 0), WORLD - 70, Math.min(vw, DOCK_X), 70);
      ctx.fillStyle = '#5a9ad9';
      for (let wx = 0; wx < 8; wx++) {
        ctx.fillRect(((wx * 463 + 120) % DOCK_X), WORLD - 52 + (wx % 3) * 8, 60, 3);
      }
    }
    // Docks ground (east).
    if (x1 > DOCK_X) {
      ctx.fillStyle = '#8a7a6a';
      ctx.fillRect(DOCK_X, Math.max(cam.y, 0), Math.min(vw, WORLD - DOCK_X), Math.min(vh, BEACH_Y));
    }
    // Parks.
    for (const park of city.parks) {
      if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
      ctx.fillStyle = '#5a9a4a';
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = '#6ab05a';
      ctx.fillRect(park.x + 8, park.y + 8, park.w - 16, park.h - 16);
    }
    // Roads.
    ctx.fillStyle = '#3a3a44';
    for (let i = 0; i <= WORLD / ROAD_STEP; i++) {
      const c = i * ROAD_STEP;
      if (c > y0 - ROAD_W && c < y1 + ROAD_W) ctx.fillRect(Math.max(cam.x, 0), c - ROAD_W / 2, vw, ROAD_W);
      if (c > x0 - ROAD_W && c < x1 + ROAD_W) ctx.fillRect(c - ROAD_W / 2, Math.max(cam.y, 0), ROAD_W, vh);
    }
    // Road centre dashes.
    ctx.fillStyle = '#e8d44d';
    for (let i = 0; i <= WORLD / ROAD_STEP; i++) {
      const c = i * ROAD_STEP;
      for (let d = 0; d < WORLD; d += 64) {
        if (c > y0 - 4 && c < y1 + 4 && d > cam.x - 64 && d < cam.x + vw) ctx.fillRect(d, c - 2, 30, 4);
        if (c > x0 - 4 && c < x1 + 4 && d > cam.y - 64 && d < cam.y + vh) ctx.fillRect(c - 2, d, 4, 30);
      }
    }
    // Sidewalk edges.
    ctx.strokeStyle = '#a08a6a';
    ctx.lineWidth = 3;
    for (let i = 0; i <= WORLD / ROAD_STEP; i++) {
      const c = i * ROAD_STEP;
      ctx.strokeRect(c - ROAD_W / 2, y0, ROAD_W, y1 - y0);
      ctx.strokeRect(x0, c - ROAD_W / 2, x1 - x0, ROAD_W);
    }
    // Buildings.
    for (const b of city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 6, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      ctx.fillStyle = '#ffe9a0';
      const cols = Math.max(1, Math.floor(b.w / 26)), rows = Math.max(1, Math.floor(b.h / 26));
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          if ((cx * 7 + cy * 13 + b.height) % 3 === 0) {
            ctx.fillRect(b.x + 10 + cx * 26, b.y + 10 + cy * 26, 10, 8);
          }
        }
      }
      if (b.w > 90) {
        ctx.fillStyle = '#2b0a3d';
        ctx.font = 'bold 13px Trebuchet MS, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.name.toUpperCase(), b.x + b.w / 2, b.y + b.h / 2 + 4);
      }
    }
    // Containers at the docks.
    for (const c of city.containers) {
      if (c.x > x1 || c.x + c.w < x0 || c.y > y1 || c.y + c.h < y0) continue;
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.strokeRect(c.x, c.y, c.w, c.h);
    }
    // Trees.
    for (const t of city.trees) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      ctx.fillStyle = '#3c7a3c';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a9a3c';
      ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
    }
    this.drawMarkers(game);
    this.drawPickups(game);
    this.drawPedestrians(game);
    this.drawCars(game);
    this.drawEnemies(game);
    this.drawBullets(game);
    this.drawPlayer(game);
    this.drawParticles(game);
    ctx.restore();
    this.drawHud(game);
    this.drawVignette(game);
  }

  drawMarkers(game) {
    const ctx = this.ctx;
    const m = game.missions.marker;
    if (!m) return;
    const t = game.time * 3;
    const bob = Math.sin(t) * 6;
    ctx.save();
    ctx.translate(m.x, m.y + bob - 26);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-13, -26); ctx.lineTo(13, -26); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2b0a3d';
    ctx.beginPath(); ctx.arc(0, -26, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 12px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -22);
    ctx.restore();
    // Guide line from the player to the marker.
    const p = game.player;
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.55)';
    ctx.setLineDash([10, 10]);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(m.x, m.y); ctx.stroke();
    ctx.setLineDash([]);
    // Distance label.
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 13px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(dist(p.x, p.y, m.x, m.y)) + 'm', (p.x + m.x) / 2, (p.y + m.y) / 2 - 10);
  }

  drawPickups(game) {
    const ctx = this.ctx;
    for (const pk of game.combat.pickups) {
      ctx.save();
      ctx.translate(pk.x, pk.y);
      if (pk.kind === 'health') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(-11, -11, 22, 22);
        ctx.fillStyle = '#e4572e';
        ctx.fillRect(-3, -8, 6, 16);
        ctx.fillRect(-8, -3, 16, 6);
      } else {
        ctx.fillStyle = '#3c9a5a';
        ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 13px Trebuchet MS, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', 0, 5);
      }
      ctx.restore();
    }
  }

  drawPedestrians(game) {
    const ctx = this.ctx;
    for (const p of game.pedestrians) {
      if (p.down) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle + Math.PI / 2);
        ctx.fillStyle = p.shirt;
        ctx.fillRect(-6, -14, 12, 28);
        ctx.restore();
        continue;
      }
      const swing = Math.sin(p.walkPhase) * 4;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle + Math.PI / 2);
      ctx.fillStyle = '#222';
      ctx.fillRect(-7 + swing * 0.4, 6, 5, 10);
      ctx.fillRect(2 - swing * 0.4, 6, 5, 10);
      ctx.fillStyle = p.shirt;
      ctx.fillRect(-7, -8, 14, 16);
      ctx.fillStyle = p.skin;
      ctx.beginPath(); ctx.arc(0, -12, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  drawCars(game) {
    const ctx = this.ctx;
    const all = [...game.cars, ...game.traffic, ...game.police.cars];
    for (const c of all) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);
      // Shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-c.len / 2 + 3, -c.wid / 2 + 4, c.len, c.wid);
      // Body.
      ctx.fillStyle = c.color;
      roundRect(ctx, -c.len / 2, -c.wid / 2, c.len, c.wid, 7);
      ctx.fill();
      // Cabin + windshield.
      ctx.fillStyle = 'rgba(20,20,40,0.85)';
      roundRect(ctx, -c.len / 2 + 10, -c.wid / 2 + 4, c.len / 2.4, c.wid - 8, 4);
      ctx.fill();
      ctx.fillStyle = '#bfe3ff';
      ctx.fillRect(c.len / 2 - 12, -c.wid / 2 + 3, 5, c.wid - 6);
      // Headlights.
      ctx.fillStyle = '#fff8c9';
      ctx.fillRect(c.len / 2 - 2, -c.wid / 2 + 2, 3, 5);
      ctx.fillRect(c.len / 2 - 2, c.wid / 2 - 7, 3, 5);
      if (c.isPolice) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px Trebuchet MS, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SPD', 0, 3);
        // Light bar, alternating.
        const flash = Math.floor(game.time * 6) % 2 === 0;
        ctx.fillStyle = flash ? '#ff2e2e' : '#2e6bff';
        ctx.fillRect(-6, -c.wid / 2 - 2, 12, 4);
        ctx.fillStyle = flash ? '#2e6bff' : '#ff2e2e';
        ctx.fillRect(-6, c.wid / 2 - 2, 12, 4);
      }
      if (c.stolen && c.driver === game.player) {
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2;
        ctx.strokeRect(-c.len / 2 - 4, -c.wid / 2 - 4, c.len + 8, c.wid + 8);
      }
      ctx.restore();
    }
  }

  drawEnemies(game) {
    const ctx = this.ctx;
    for (const e of game.combat.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle + Math.PI / 2);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-7, -8, 14, 16);
      ctx.fillStyle = '#7a1a1a';
      ctx.fillRect(-7, -8, 14, 6);
      ctx.fillStyle = '#d9a06b';
      ctx.beginPath(); ctx.arc(0, -12, 6, 0, Math.PI * 2); ctx.fill();
      // Gun.
      ctx.fillStyle = '#111';
      ctx.fillRect(-2, -22, 4, 10);
      ctx.restore();
      // Health bar.
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(e.x - 14, e.y - 26, 28, 5);
      ctx.fillStyle = '#e4572e';
      ctx.fillRect(e.x - 14, e.y - 26, 28 * (e.health / 100), 5);
    }
  }

  drawBullets(game) {
    const ctx = this.ctx;
    ctx.fillStyle = '#ffe9a0';
    for (const b of game.combat.bullets) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.fillRect(-7, -1.5, 14, 3);
      ctx.restore();
    }
  }

  drawPlayer(game) {
    const ctx = this.ctx;
    const p = game.player;
    if (p.dead) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle + Math.PI / 2);
      ctx.fillStyle = '#3c7ac9';
      ctx.fillRect(-7, -14, 14, 28);
      ctx.restore();
      return;
    }
    if (p.car) return; // drawn with the car
    const swing = p.speed > 10 ? Math.sin(game.time * 14) * 5 : 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle + Math.PI / 2);
    ctx.fillStyle = '#222';
    ctx.fillRect(-7 + swing * 0.4, 6, 5, 10);
    ctx.fillRect(2 - swing * 0.4, 6, 5, 10);
    // Rook: teal jacket, the mark of the crew.
    ctx.fillStyle = '#2e8a8a';
    ctx.fillRect(-8, -9, 16, 18);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-8, -2, 16, 4);
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath(); ctx.arc(0, -13, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b0a3d';
    ctx.beginPath(); ctx.arc(0, -14, 6.5, Math.PI, 0); ctx.fill();
    // Pistol.
    ctx.fillStyle = '#111';
    ctx.fillRect(6, -24, 4, 12);
    ctx.restore();
    // Aim line.
    ctx.strokeStyle = 'rgba(255, 233, 160, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.aimAngle) * 24, p.y + Math.sin(p.aimAngle) * 24);
    ctx.lineTo(p.x + Math.cos(p.aimAngle) * 52, p.y + Math.sin(p.aimAngle) * 52);
    ctx.stroke();
  }

  drawParticles(game) {
    const ctx = this.ctx;
    for (const pt of game.combat.particles) {
      ctx.globalAlpha = clamp(pt.life * 2.4, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  drawHud(game) {
    const ctx = this.ctx;
    const p = game.player;
    const W = this.canvas.width, H = this.canvas.height;
    // Top-left: wanted stars + health + money.
    ctx.textAlign = 'left';
    ctx.font = 'bold 26px Trebuchet MS, sans-serif';
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < p.wanted ? '★' : '☆';
    ctx.fillStyle = p.wanted > 0 ? '#ffd166' : 'rgba(255,255,255,0.55)';
    ctx.fillText(stars, 16, 36);
    // Health bar.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(16, 48, 190, 16);
    ctx.fillStyle = p.health > 35 ? '#3c9a5a' : '#e4572e';
    ctx.fillRect(18, 50, 186 * (p.health / 100), 12);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Trebuchet MS, sans-serif';
    ctx.fillText('HP ' + Math.ceil(p.health), 22, 61);
    // Money + respect.
    ctx.font = 'bold 20px Trebuchet MS, sans-serif';
    ctx.fillStyle = '#3c9a5a';
    ctx.fillText(formatMoney(p.money), 16, 92);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 14px Trebuchet MS, sans-serif';
    ctx.fillText('RESPECT ' + p.respect, 16, 112);
    // Top-right: clock + mission.
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Trebuchet MS, sans-serif';
    ctx.fillText(formatClock(game.clockMinutes), W - 16, 32);
    ctx.font = 'bold 13px Trebuchet MS, sans-serif';
    ctx.fillStyle = '#ffd166';
    const mission = game.missions.active;
    ctx.fillText(mission ? mission.title : (game.missions.done ? 'SOLMAR IS YOURS' : 'FREE ROAM — talk to Mara (M)'), W - 16, 54);
    if (mission) {
      ctx.fillStyle = '#ffe9c9';
      ctx.font = '13px Trebuchet MS, sans-serif';
      const step = mission.steps[game.missions.step];
      if (step) ctx.fillText(step.text, W - 16, 74);
      if (mission.timed) {
        ctx.fillStyle = game.missions.timer < 15 ? '#e4572e' : '#fff';
        ctx.font = 'bold 16px Trebuchet MS, sans-serif';
        ctx.fillText(Math.ceil(game.missions.timer) + 's', W - 16, 96);
      }
    }
    // Bottom-left: message banner, wrapped to fit the screen.
    if (game.missions.messageTimer > 0) {
      ctx.textAlign = 'center';
      ctx.font = '15px Trebuchet MS, sans-serif';
      const maxW = Math.min(W - 60, 860);
      const words = game.missions.message.split(' ');
      const lines = [];
      let line = '';
      for (const word of words) {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > maxW - 36 && line) { lines.push(line); line = word; }
        else line = test;
      }
      if (line) lines.push(line);
      const boxH = lines.length * 22 + 16;
      const boxW = Math.min(W - 60, maxW);
      ctx.fillStyle = 'rgba(20,8,32,0.82)';
      ctx.fillRect((W - boxW) / 2, H - 78 - boxH, boxW, boxH);
      ctx.strokeStyle = '#ffd166';
      ctx.strokeRect((W - boxW) / 2, H - 78 - boxH, boxW, boxH);
      ctx.fillStyle = '#ffe9c9';
      lines.forEach((l, i) => ctx.fillText(l, W / 2, H - 78 - boxH + 22 + i * 22));
    }
    // Bottom-centre: context hint.
    ctx.textAlign = 'center';
    ctx.font = '13px Trebuchet MS, sans-serif';
    ctx.fillStyle = 'rgba(255,233,201,0.9)';
    let hint = '';
    if (!p.car) {
      const near = p.nearestCar([...game.cars, ...game.traffic, ...game.police.cars], 70);
      if (near) hint = '[E] Steal the ' + near.model;
      else if (game.nearGarage) hint = '[G] Pay & spray — lose the heat ($' + 150 * Math.max(1, p.wanted) + ')';
      else if (game.nearClinic) hint = '[H] Clinic — heal up ($50)';
    } else {
      hint = '[E] Exit car · [Space] Handbrake · [H] Horn — ' + p.car.model + ' · ' + Math.round(Math.abs(p.car.speed) * 0.18) + ' km/h';
    }
    if (hint) ctx.fillText(hint, W / 2, H - 16);
    // Hurt flash.
    if (p.hurtFlash > 0) {
      ctx.fillStyle = 'rgba(228, 87, 46,' + (p.hurtFlash * 0.5) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    this.drawMinimap(game);
  }

  drawMinimap(game) {
    const ctx = this.ctx;
    const S = 168;
    const x = this.canvas.width - S - 14, y = this.canvas.height - S - 14;
    const scale = S / WORLD;
    ctx.fillStyle = 'rgba(12,6,24,0.85)';
    ctx.fillRect(x - 4, y - 4, S + 8, S + 8);
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 4, y - 4, S + 8, S + 8);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, S, S); ctx.clip();
    // Water + beach.
    ctx.fillStyle = '#3c7ac9';
    ctx.fillRect(x, y + (WORLD - 70) * scale, S, 70 * scale);
    ctx.fillStyle = '#f2d8a0';
    ctx.fillRect(x, y + BEACH_Y * scale, S, (WORLD - BEACH_Y) * scale);
    // Roads.
    ctx.fillStyle = '#5a5a66';
    for (let i = 0; i <= WORLD / ROAD_STEP; i++) {
      ctx.fillRect(x + i * ROAD_STEP * scale - 2, y, 4, S);
      ctx.fillRect(x, y + i * ROAD_STEP * scale - 2, S, 4);
    }
    // Mission marker.
    const m = game.missions.marker;
    if (m) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(x + m.x * scale, y + m.y * scale, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(x + m.x * scale, y + m.y * scale, 10 + Math.sin(game.time * 4) * 3, 0, Math.PI * 2); ctx.stroke();
    }
    // Police blips.
    ctx.fillStyle = '#2e6bff';
    for (const c of game.police.cars) ctx.fillRect(x + c.x * scale - 2, y + c.y * scale - 2, 4, 4);
    // Player.
    const p = game.player;
    ctx.fillStyle = '#e4572e';
    ctx.beginPath(); ctx.arc(x + p.x * scale, y + p.y * scale, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.beginPath(); ctx.arc(x + p.x * scale, y + p.y * scale, 7, 0, Math.PI * 2); ctx.stroke();
    // Viewport box.
    const cam = game.camera;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(x + cam.x * scale, y + cam.y * scale, (cam.w / cam.zoom) * scale, (cam.h / cam.zoom) * scale);
    ctx.restore();
  }

  drawVignette(game) {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(
      this.canvas.width / 2, this.canvas.height / 2, this.canvas.height * 0.45,
      this.canvas.width / 2, this.canvas.height / 2, this.canvas.height * 0.95);
    g.addColorStop(0, 'rgba(255,120,60,0)');
    g.addColorStop(1, 'rgba(60,10,40,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
