// Missions: Mara Voss's job list. Each mission is a chain of objectives with a
// marker on the map, a briefing, and a payout. Finish all six to pull the
// Solmar Job and buy Rook's way out.
import { dist } from './util.js';
import { formatMoney } from './util.js';
import { makeCar } from './vehicles.js';

// Marker spots around the city (world coords, on roads / open areas).
export const SPOTS = {
  garage: { x: 640, y: 640, label: "Mara's Garage" },
  docks: { x: 3300, y: 1600, label: 'Container Docks' },
  pawnshop: { x: 1600, y: 960, label: 'Golden Pawn' },
  hideout: { x: 2880, y: 2880, label: 'Safehouse' },
  warehouse: { x: 960, y: 2560, label: 'Vulture Warehouse' },
  casino: { x: 2240, y: 640, label: 'Casino Del Sol' },
  boat: { x: 3200, y: 3200, label: 'Escape Boat' },
  clinic: { x: 1280, y: 1920, label: 'Clinic' },
  beach: { x: 1600, y: 3360, label: 'Solmar Beach' },
};

export const MISSIONS = [
  {
    id: 'wheels', title: '1 — WHEELS', payout: 300,
    briefing: 'Mara: "First job, Rook. A Comet GT is parked uptown — cherry red, can\'t miss it. Bring it to my garage. Don\'t scratch the paint."',
    steps: [
      { type: 'steal', text: 'Steal the Comet GT', target: { x: 2240, y: 1600 }, radius: 90 },
      { type: 'goto', text: 'Deliver the Comet to Mara\'s Garage', target: SPOTS.garage, radius: 110 },
    ],
  },
  {
    id: 'package', title: '2 — PACKAGE RUN', payout: 450,
    briefing: 'Mara: "A package is waiting at the docks. Pick it up on foot and run it to the Golden Pawn. Cops patrol the docks — keep it clean."',
    steps: [
      { type: 'goto', text: 'Pick up the package at the Docks', target: SPOTS.docks, radius: 110 },
      { type: 'goto', text: 'Deliver the package to the Golden Pawn', target: SPOTS.pawnshop, radius: 110 },
    ],
  },
  {
    id: 'heat', title: '3 — HEAT', payout: 600,
    briefing: 'Mara: "You got made on that last run, Rook. SPD is on you — two stars and climbing. Lose them and get to the safehouse. No witnesses, no problem."',
    steps: [
      { type: 'escape', text: 'Lose the heat — get your wanted level to zero', target: SPOTS.hideout, radius: 140 },
    ],
  },
  {
    id: 'payback', title: '4 — PAYBACK', payout: 800,
    briefing: 'Mara: "The Vultures torched my last driver\'s ride. Their crew is holed up at the warehouse. Go settle it — all of them — and take the cash they owe me."',
    steps: [
      { type: 'clear', text: 'Clear out the Vultures at the Warehouse', target: SPOTS.warehouse, radius: 320 },
      { type: 'goto', text: 'Grab the stash and get clear', target: SPOTS.warehouse, radius: 110 },
    ],
  },
  {
    id: 'getaway', title: '5 — GETAWAY DRIVER', payout: 1000,
    briefing: 'Mara: "Crew\'s moving product across town and the roadblocks are up. Drive from the Casino to the Safehouse — fast, and don\'t stop for anyone in a uniform."',
    steps: [
      { type: 'drive', text: 'Reach the Safehouse in your car', target: SPOTS.hideout, radius: 130 },
    ],
    timed: 75,
  },
  {
    id: 'solmar-job', title: '6 — THE SOLMAR JOB', payout: 5000,
    briefing: 'Mara: "Last one. Casino Del Sol\'s vault, tonight. Grab the take, then run — every cop in Solmar will be on you. The boat at the south docks is your way out."',
    steps: [
      { type: 'goto', text: 'Hit the Casino Del Sol vault', target: SPOTS.casino, radius: 110 },
      { type: 'escape', text: 'Escape the 4-star heat — reach the boat', target: SPOTS.boat, radius: 140 },
    ],
  },
];

export class MissionManager {
  constructor() {
    this.index = -1;      // -1 = no active mission
    this.step = 0;
    this.done = false;    // all missions complete
    this.timer = 0;       // timed mission countdown
    this.active = null;
    this.message = '';
    this.messageTimer = 0;
    this.marker = null;   // current objective target
    this.stealCar = null; // the Comet GT for mission 1
    this.enemiesSpawned = false;
    this.lastFailed = false;
  }

  start(index, game) {
    this.index = index;
    this.step = 0;
    this.active = MISSIONS[index];
    this.timer = this.active.timed || 0;
    this.enemiesSpawned = false;
    this.lastFailed = false;
    this.setMessage(this.active.title + ' — ' + this.active.briefing, 7);
    this.updateMarker();
    if (game) this.onMissionStart(game);
  }

  startNext(game) {
    if (this.index + 1 >= MISSIONS.length) { this.done = true; this.active = null; return false; }
    this.start(this.index + 1, game);
    return true;
  }

  setMessage(text, secs) { this.message = text; this.messageTimer = secs || 5; }

  updateMarker() {
    if (!this.active) { this.marker = null; return; }
    const s = this.active.steps[this.step];
    this.marker = s ? { x: s.target.x, y: s.target.y, label: s.target.label || s.text } : null;
  }

  currentStep() {
    return this.active ? this.active.steps[this.step] : null;
  }

  // Called every frame; returns 'complete' | 'failed' | null.
  update(dt, game) {
    if (this.messageTimer > 0) this.messageTimer -= dt;
    if (!this.active) return null;
    const p = game.player;
    const step = this.currentStep();
    if (!step) return null;
    if (this.active.timed) {
      this.timer -= dt;
      if (this.timer <= 0) return 'failed';
    }
    if (step.type === 'steal') {
      if (this.stealCar && p.car === this.stealCar) return this.advance(game);
    } else if (step.type === 'goto' || step.type === 'drive' || step.type === 'escape') {
      const near = dist(p.x, p.y, step.target.x, step.target.y) < step.radius;
      if (step.type === 'escape') {
        if (p.wanted === 0 && near) return this.advance(game);
      } else if (step.type === 'drive') {
        if (near && p.car) return this.advance(game);
      } else if (near) {
        return this.advance(game);
      }
    } else if (step.type === 'clear') {
      if (!this.enemiesSpawned) {
        this.enemiesSpawned = true;
        game.spawnMissionEnemies(step.target);
      }
      if (game.combat.enemies.length === 0) return this.advance(game);
    }
    return null;
  }

  advance(game) {
    const p = game.player;
    this.step += 1;
    if (this.step >= this.active.steps.length) {
      // Mission complete: payout, next mission.
      p.money += this.active.payout;
      p.respect += 20;
      this.setMessage(this.active.title + ' COMPLETE — ' + formatMoney(this.active.payout) + ' earned', 5);
      if (game.sound) game.sound.missionDone();
      const finished = this.active;
      this.active = null;
      this.marker = null;
      if (finished.id === 'solmar-job') {
        this.done = true;
        this.setMessage('THE SOLMAR JOB IS DONE. Rook is free — Solmar is yours now.', 8);
      }
      return 'complete';
    }
    this.updateMarker();
    this.setMessage('Objective: ' + this.currentStep().text, 5);
    this.onStepStart(game);
    return null;
  }

  // Mission-specific setup hooks, called by the game when a mission starts.
  onMissionStart(game) {
    const id = this.active && this.active.id;
    if (id === 'wheels') {
      // Park the cherry-red Comet GT uptown for Rook to steal.
      const comet = makeCar(2240, 1600, Math.PI / 2, 0, {});
      game.cars.push(comet);
      this.stealCar = comet;
    }
    if (id === 'heat') game.player.addWanted(2);
    if (id === 'getaway' && !game.player.car) {
      // Put Rook in a car at the casino.
      const car = game.nearestParkedCar(game.player.x, game.player.y, 9999);
      if (car) { game.player.enterCar(car); }
    }
  }

  onStepStart(game) {
    const step = this.currentStep();
    if (!step) return;
    if (step.type === 'escape' && this.active.id === 'solmar-job') game.player.addWanted(4);
  }
}
