// SOLMAR — Sunset Streets. Main loop, state machine and wiring.
// An original open-world crime game: steal cars, outrun the SPD, run Mara's
// jobs, and pull the Solmar Job.
import { generateCity, WORLD } from './city.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { Player } from './player.js';
import { spawnParkedCars, spawnTraffic, updateTraffic, updatePoliceCar } from './vehicles.js';
import { spawnPedestrians, updatePedestrians, carHitsPed } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { MissionManager, SPOTS } from './missions.js';
import { Renderer, Camera } from './render.js';
import { applyShot } from './shots.js';
import { hasSave, saveGame, loadGame, clearSave } from './save.js';
import { mulberry32, dist, clamp, angleTo } from './util.js';

const canvas = document.getElementById('game');
const menuEl = document.getElementById('menu');
const pauseEl = document.getElementById('pause');
const overEl = document.getElementById('over');
const toastEl = document.getElementById('toast');

export const game = {
  time: 0,
  clockMinutes: 17 * 60 + 30,
  state: 'menu', // menu | playing | paused | over
  awaitingNext: false,
  shotMode: null,
  rng: mulberry32(20261123),
};
// Debug / play-test handle (harmless in production: read-only state access).
window.__solmar = game;

const params = new URLSearchParams(window.location.search);
const shotParam = params.get('shot');
if (shotParam) game.shotMode = shotParam;

const input = new Input(canvas);
const sound = new SoundEngine();
const renderer = new Renderer(canvas);
const camera = new Camera(window.innerWidth, window.innerHeight);
game.camera = camera;
game.sound = sound;

const city = generateCity(20261123);
game.city = city;

const player = new Player(640, 700);
player.cityRef = city;
player.onCrash = () => sound.crash();
game.player = player;

game.cars = spawnParkedCars(city, mulberry32(777), 26);
game.traffic = spawnTraffic(city, mulberry32(4242), 14);
game.pedestrians = spawnPedestrians(city, mulberry32(99), 42);
game.police = new Police();
game.combat = new Combat();
game.missions = new MissionManager();
game.nearGarage = false;
game.nearClinic = false;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.resize(w, h);
  camera.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

function toast(text, ms) {
  toastEl.textContent = text;
  toastEl.style.display = 'block';
  setTimeout(() => { toastEl.style.display = 'none'; }, ms || 2600);
}
game.toast = toast;

game.spawnMissionEnemies = function (target) {
  const spots = [
    { x: target.x - 60, y: target.y - 40 },
    { x: target.x + 50, y: target.y - 70 },
    { x: target.x + 80, y: target.y + 60 },
    { x: target.x - 40, y: target.y + 90 },
    { x: target.x + 10, y: target.y - 110 },
  ];
  game.combat.spawnEnemies(spots);
};

game.nearestParkedCar = function (x, y, maxDist) {
  let best = null, bd = maxDist;
  for (const c of game.cars) {
    if (c.driver || c.wrecked) continue;
    const d = dist(x, y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
};

function startNewGame() {
  clearSave();
  player.reset(640, 700);
  player.money = 120;
  player.respect = 0;
  game.missions = new MissionManager();
  game.combat = new Combat();
  game.police = new Police();
  game.clockMinutes = 17 * 60 + 30;
  game.awaitingNext = false;
  game.state = 'playing';
  menuEl.classList.add('hidden');
  overEl.classList.add('hidden');
  sound.ensure();
  game.missions.setMessage('Mara Voss: "Rook. You\'re back. Press M when you want work."', 6);
}

function continueGame() {
  const data = loadGame();
  if (!data) { startNewGame(); return; }
  player.reset(data.x, data.y);
  player.health = data.health;
  player.money = data.money;
  player.respect = data.respect;
  player.wanted = data.wanted;
  game.clockMinutes = data.clock;
  game.missions = new MissionManager();
  game.missions.index = data.missionIndex;
  game.missions.step = data.missionStep;
  if (data.missionIndex >= 0 && data.missionIndex < 6) {
    game.missions.start(data.missionIndex, game);
    game.missions.step = data.missionStep;
    game.missions.updateMarker();
  }
  game.state = 'playing';
  menuEl.classList.add('hidden');
  overEl.classList.add('hidden');
  sound.ensure();
  toast('Welcome back, Rook.');
}

function quitToMenu() {
  saveGame(game);
  game.state = 'menu';
  pauseEl.classList.add('hidden');
  overEl.classList.add('hidden');
  menuEl.classList.remove('hidden');
  document.getElementById('btn-continue').style.display = hasSave() ? 'block' : 'none';
}

function gameOver(kind) {
  game.state = 'over';
  sound.stopEngine();
  if (kind === 'busted') {
    document.getElementById('over-title').textContent = 'BUSTED';
    document.getElementById('over-text').textContent = 'The SPD hauled you in. Mara posts bail — but the heat, the cash and the car are gone.';
    sound.busted();
  } else {
    document.getElementById('over-title').textContent = 'WASTED';
    document.getElementById('over-text').textContent = 'Solmar streets don\'t forgive. Mara\'s crew drags you to the clinic — you wake up with a bill and a grudge.';
  }
  overEl.classList.remove('hidden');
}

function retryAfterOver() {
  player.health = 100;
  player.dead = false;
  player.busted = false;
  player.money = Math.max(50, Math.floor(player.money * 0.5));
  player.wanted = 0;
  player.x = SPOTS.clinic.x; player.y = SPOTS.clinic.y;
  if (player.car) { player.car.driver = null; player.car = null; player.onFoot = true; }
  game.police.cars = [];
  game.police.cops = [];
  game.state = 'playing';
  overEl.classList.add('hidden');
}

document.getElementById('btn-new').addEventListener('click', startNewGame);
document.getElementById('btn-continue').addEventListener('click', continueGame);
document.getElementById('btn-resume').addEventListener('click', () => {
  game.state = 'playing';
  pauseEl.classList.add('hidden');
});
document.getElementById('btn-quit').addEventListener('click', quitToMenu);
document.getElementById('btn-retry').addEventListener('click', retryAfterOver);
document.getElementById('btn-over-menu').addEventListener('click', quitToMenu);
if (!hasSave()) document.getElementById('btn-continue').style.display = 'none';

// Shot mode: skip the menu, stage a deterministic scene for screenshots.
if (game.shotMode) {
  menuEl.classList.add('hidden');
  game.state = 'playing';
  applyShot(game, game.shotMode);
}

let last = performance.now();
let fpsAccum = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  dt = clamp(dt, 0, 0.05);
  game.time += dt;
  game.clockMinutes += dt * 0.5; // one game hour every two real minutes
  if (game.clockMinutes >= 24 * 60) game.clockMinutes -= 24 * 60;

  if (input.wasPressed('KeyN')) {
    sound.ensure();
    const muted = sound.toggleMute();
    toast(muted ? 'Sound muted' : 'Sound on');
  }

  if (game.state === 'playing') {
    update(dt);
  } else if (game.state === 'menu') {
    // Gentle attract camera: slow pan over the city behind the menu.
    camera.x = (Math.sin(game.time * 0.02) * 0.5 + 0.5) * (WORLD - camera.w);
    camera.y = 400 + Math.sin(game.time * 0.013) * 300;
  }
  renderer.drawWorld(game, dt);
  input.endFrame();
}

function update(dt) {
  // Pause.
  if (input.wasPressed('KeyP') && !game.shotMode) {
    game.state = 'paused';
    pauseEl.classList.remove('hidden');
    sound.stopEngine();
    return;
  }
  // Start / retry missions with M.
  if (input.wasPressed('KeyM')) {
    if (!game.missions.active && !game.missions.done) {
      if (game.missions.lastFailed) game.missions.start(game.missions.index, game);
      else game.missions.startNext(game);
      game.awaitingNext = false;
    }
  }
  // Enter / exit car.
  if (input.wasPressed('KeyE')) {
    if (player.car) {
      player.exitCar();
      sound.door();
    } else {
      const car = player.nearestCar([...game.cars, ...game.traffic, ...game.police.cars], 72);
      if (car) {
        if (car.isPolice) player.addWanted(2);
        else if (!car.stolen) player.addWanted(1);
        player.enterCar(car);
        sound.door();
        if (car.isPolice) toast('You stole a cop car. Bold. Stupid, but bold.');
      }
    }
  }
  // Pay & spray at the garage.
  if (input.wasPressed('KeyG') && game.nearGarage) {
    if (game.police.clearHeat(player)) { toast('Heat cleared. The garage never saw you.'); sound.cash(); }
    else toast('Not enough cash to clear the heat.');
  }
  // Clinic heal.
  if (input.wasPressed('KeyH') && game.nearClinic) {
    if (player.health < 100 && player.money >= 50) {
      player.money -= 50;
      player.heal(100);
      toast('Patched up. $50.');
      sound.pickup();
    }
  }
  if (input.wasPressed('KeyH') && player.car) sound.horn();

  player.update(dt, input, city, camera);

  // Shooting (mouse click, on foot only).
  if (input.mouseDown && !player.car && !player.dead) {
    if (game.combat.playerShoot(player)) {
      sound.shoot();
      if (player.wanted < 1) player.addWanted(1);
    }
  }
  // Screenshot scenes: Rook fires at the nearest Vulture so the frame shows
  // the shootout in progress.
  if (game.shotMode === 'shootout' && !player.car && !player.dead) {
    let best = null, bd = 1e9;
    for (const e of game.combat.enemies) {
      const d = dist(player.x, player.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) {
      player.aimAngle = angleTo(player.x, player.y, best.x, best.y);
      game.combat.playerShoot(player);
    }
  }

  // Traffic + pedestrians.
  const rng = game.rng;
  for (const c of game.traffic) updateTraffic(c, dt, city, rng);
  updatePedestrians(game.pedestrians, dt, city, player, game.combat.lastShotPos);
  const hit = carHitsPed(player, game.pedestrians, [...game.cars, ...game.traffic, ...game.police.cars]);
  if (hit) { sound.crash(); toast('Pedestrian down! The SPD will hear about this.'); }

  // Police.
  game.police.update(dt, player, city, rng);
  for (const c of game.police.cars) updatePoliceCar(c, dt, player, city);

  // Combat.
  game.combat.update(dt, player, city, sound);

  // Missions.
  const result = game.missions.update(dt, game);
  if (result === 'complete') {
    game.awaitingNext = true;
    if (game.missions.done) {
      game.missions.setMessage('THE SOLMAR JOB IS DONE — Rook is free. Free roam, or start over for a better score.', 8);
    } else {
      game.missions.setMessage('Job done. Press M for the next job from Mara.', 6);
    }
  } else if (result === 'failed') {
    game.missions.setMessage('Job failed — the window closed. Press M to try it again.', 6);
    game.missions.active = null;
    game.missions.marker = null;
    game.missions.lastFailed = true;
    game.awaitingNext = true;
  }

  // Proximity flags for garage / clinic prompts.
  game.nearGarage = dist(player.x, player.y, SPOTS.garage.x, SPOTS.garage.y) < 150;
  game.nearClinic = dist(player.x, player.y, SPOTS.clinic.x, SPOTS.clinic.y) < 150;

  // Engine + siren audio follow the state.
  if (player.car) { sound.ensure(); sound.startEngine(); sound.setEngine(Math.abs(player.car.speed) / player.car.topSpeed); }
  else sound.stopEngine();
  sound.updateSiren(dt, player.wanted);

  // Camera follows the player.
  camera.follow(player.x, player.y, dt);

  // Wasted / busted.
  if (player.dead) gameOver('wasted');
  else if (player.busted) gameOver('busted');

  // Autosave every ~20 s.
  fpsAccum += dt;
  if (fpsAccum > 20) { fpsAccum = 0; if (!game.shotMode) saveGame(game); }
}

requestAnimationFrame(frame);
