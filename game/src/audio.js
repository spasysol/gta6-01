// Procedural WebAudio sound for SOLMAR: engine hum, sirens, gunshots, pickups.
// Everything is synthesized — no audio files, no network.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
  }

  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() { this.muted = !this.muted; if (this.muted) this.stopEngine(); return this.muted; }

  beep(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t); osc.stop(t + dur);
  }

  noise(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    let node = src;
    if (lowpass) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = lowpass;
      src.connect(f); node = f;
    }
    node.connect(g).connect(this.ctx.destination);
    src.start(t);
  }

  shoot() { this.noise(0.09, 0.22, 2400); this.beep(180, 0.07, 'sawtooth', 0.06, 60); }
  enemyShoot() { this.noise(0.08, 0.1, 1800); }
  crash() { this.noise(0.25, 0.25, 900); }
  pickup() { this.beep(660, 0.09, 'sine', 0.1); setTimeout(() => this.beep(990, 0.12, 'sine', 0.1), 80); }
  cash() { this.beep(880, 0.08, 'triangle', 0.12); setTimeout(() => this.beep(1320, 0.14, 'triangle', 0.12), 90); }
  missionDone() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.beep(f, 0.16, 'triangle', 0.12), i * 110)); }
  busted() { this.beep(220, 0.5, 'sawtooth', 0.12, 110); }
  horn() { this.beep(370, 0.18, 'square', 0.05); }
  door() { this.noise(0.08, 0.1, 1200); }

  startEngine() {
    if (!this.ctx || this.muted || this.engineOsc) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineGain = this.ctx.createGain();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineGain.gain.value = 0.03;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 420;
    this.engineOsc.connect(f).connect(this.engineGain).connect(this.ctx.destination);
    this.engineOsc.start();
  }

  setEngine(speed01) {
    if (this.engineOsc) this.engineOsc.frequency.value = 55 + speed01 * 130;
    if (this.engineGain) this.engineGain.gain.value = this.muted ? 0 : 0.02 + speed01 * 0.03;
  }

  stopEngine() {
    if (this.engineOsc) { try { this.engineOsc.stop(); } catch (e) {} this.engineOsc = null; }
  }

  updateSiren(dt, wanted) {
    if (!this.ctx || this.muted || wanted < 1) {
      if (this.sirenOsc) { try { this.sirenOsc.stop(); } catch (e) {} this.sirenOsc = null; }
      return;
    }
    if (!this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenGain = this.ctx.createGain();
      this.sirenOsc.type = 'sine';
      this.sirenGain.gain.value = 0.035;
      this.sirenOsc.connect(this.sirenGain).connect(this.ctx.destination);
      this.sirenOsc.start();
    }
    this.sirenTimer += dt;
    const phase = Math.floor(this.sirenTimer * 1.6) % 2;
    this.sirenOsc.frequency.value = phase === 0 ? 720 : 980;
  }
}
