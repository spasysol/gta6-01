// Save / load: Rook's progress lives in localStorage so a session can
// continue later. Plain JSON, one key, no network.
const KEY = 'solmar-sunset-streets-save-v1';

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
}

export function saveGame(game) {
  try {
    const p = game.player;
    const data = {
      x: p.x, y: p.y, health: p.health, money: p.money,
      respect: p.respect, wanted: p.wanted,
      missionIndex: game.missions.index,
      missionStep: game.missions.step,
      clock: game.clockMinutes,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}
