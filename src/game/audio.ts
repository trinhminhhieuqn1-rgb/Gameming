/**
 * Advanced Procedural Web Audio Sound & Synthwave BGM Generator for Neo-Valkyrie.
 * 100% synthetic, zero external file dependencies.
 */

class SoundSystem {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isMusicEnabled: boolean = true;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  // Hover Engine Synth
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  // Procedural BGM Music Sequencer
  private musicInterval: number | null = null;
  private currentStep: number = 0;
  private bpm: number = 124;
  private isBossMusic: boolean = false;

  // Chord notes for synthwave cyberpunk arp (frequencies in Hz)
  private readonly arpScale = [
    220.0, 261.63, 329.63, 440.0, // A3, C4, E4, A4
    174.61, 220.0, 261.63, 349.23, // F3, A3, C4, F4
    196.0, 246.94, 293.66, 392.0,  // G3, B3, D4, G4
    164.81, 207.65, 246.94, 329.63 // E3, G#3, B3, E4
  ];

  constructor() {
    if (typeof window !== 'undefined') {
      this.isMuted = localStorage.getItem('neo_valkyrie_muted') === 'true';
      this.isMusicEnabled = localStorage.getItem('neo_valkyrie_music') !== 'false';
    }
  }

  private initContext() {
    if (this.ctx) return;
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxClass) return;

    this.ctx = new AudioCtxClass();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.75, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(this.isMusicEnabled ? 0.28 : 0, this.ctx.currentTime);
    this.musicGain.connect(this.masterGain);

    this.setupEngineSynth();
    this.startMusicSequencer();
  }

  public ensureRunning() {
    this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.75, this.ctx.currentTime);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('neo_valkyrie_muted', String(this.isMuted));
    }
    return this.isMuted;
  }

  public toggleMusic(): boolean {
    this.isMusicEnabled = !this.isMusicEnabled;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.isMusicEnabled ? 0.28 : 0, this.ctx.currentTime);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('neo_valkyrie_music', String(this.isMusicEnabled));
    }
    return this.isMusicEnabled;
  }

  public setBossMusic(isBoss: boolean) {
    this.isBossMusic = isBoss;
    this.bpm = isBoss ? 138 : 124;
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.startMusicSequencer();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsMusicEnabled(): boolean {
    return this.isMusicEnabled;
  }

  // Procedural 16-Step Cyberpunk Synthwave Music Sequencer
  private startMusicSequencer() {
    if (typeof window === 'undefined') return;
    if (this.musicInterval) clearInterval(this.musicInterval);

    const stepDurationMs = (60 / this.bpm / 4) * 1000;
    this.musicInterval = window.setInterval(() => {
      this.stepMusic();
    }, stepDurationMs);
  }

  private stepMusic() {
    if (!this.ctx || !this.musicGain || this.isMuted || !this.isMusicEnabled) return;
    if (this.ctx.state !== 'running') return;

    const step = this.currentStep % 16;
    const bar = Math.floor(this.currentStep / 16) % 4;
    const t = this.ctx.currentTime;

    // 1. Kick Drum (Beats 0, 4, 8, 12 + extra syncopation in boss mode)
    if (step === 0 || step === 4 || step === 8 || step === 12 || (this.isBossMusic && (step === 10 || step === 14))) {
      this.playSynthKick(t);
    }

    // 2. Hi-Hat (Every odd sixteenth note + open hat on offbeats)
    if (step % 2 === 1) {
      this.playSynthHiHat(t, step === 2 || step === 6 || step === 10 || step === 14);
    }

    // 3. Cyberpunk Bassline (Plucked Sawtooth with sweeping lowpass filter)
    const baseFreqs = [55.0, 43.65, 49.0, 41.2]; // A1, F1, G1, E1
    const baseFreq = baseFreqs[bar];
    const octaveMult = step % 4 === 0 ? 2 : 1;
    this.playSynthBassNote(t, baseFreq * octaveMult, step % 2 === 0);

    // 4. Neon Arpeggiator Lead
    const arpIndex = (bar * 4 + (step % 4)) % this.arpScale.length;
    const noteFreq = this.arpScale[arpIndex] * (this.isBossMusic ? 1.5 : 1.0);
    if (step % 2 === 0) {
      this.playSynthArpNote(t, noteFreq);
    }

    this.currentStep = (this.currentStep + 1) % 64;
  }

  private playSynthKick(t: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.1);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(t);
    osc.stop(t + 0.14);
  }

  private playSynthHiHat(t: number, isOpen: boolean) {
    if (!this.ctx || !this.musicGain) return;
    const duration = isOpen ? 0.08 : 0.03;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7000, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isOpen ? 0.18 : 0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    noise.start(t);
    noise.stop(t + duration);
  }

  private playSynthBassNote(t: number, freq: number, accent: boolean) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(accent ? 480 : 260, t);
    filter.frequency.exponentialRampToValueAtTime(80, t + 0.11);
    filter.Q.setValueAtTime(6, t);

    gain.gain.setValueAtTime(accent ? 0.35 : 0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(t);
    osc.stop(t + 0.13);
  }

  private playSynthArpNote(t: number, freq: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(t);
    osc.stop(t + 0.16);
  }

  // Hover Engine Synth
  private setupEngineSynth() {
    if (!this.ctx || !this.sfxGain) return;
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime);

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(140, this.ctx.currentTime);
      this.engineFilter.Q.setValueAtTime(3, this.ctx.currentTime);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.sfxGain);

      this.engineOsc.start();
    } catch {
      // Audio context might need gesture
    }
  }

  public updateEngine(speedRatio: number, isBoosting: boolean) {
    if (!this.ctx || !this.engineOsc || !this.engineFilter || !this.engineGain) return;
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const baseFreq = 42 + speedRatio * 45 + (isBoosting ? 35 : 0);
    const filterFreq = 120 + speedRatio * 380 + (isBoosting ? 600 : 0);
    const targetGain = 0.08 + speedRatio * 0.12 + (isBoosting ? 0.15 : 0);

    this.engineOsc.frequency.setTargetAtTime(baseFreq, t, 0.05);
    this.engineFilter.frequency.setTargetAtTime(filterFreq, t, 0.05);
    this.engineGain.gain.setTargetAtTime(targetGain, t, 0.05);
  }

  public stopEngine() {
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  // SFX Actions
  public playRailgun(isUpgraded = false) {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = isUpgraded ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(isUpgraded ? 1200 : 900, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.15);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isUpgraded ? 1800 : 1400, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.15);
    filter.Q.setValueAtTime(4, t);

    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.16);

    this.playNoiseBurst(0.06, 0.2, 2400);
  }

  public playPlasma(isUpgraded = false) {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isUpgraded ? 750 : 620, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.18);

    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.19);
  }

  public playEnemyLaser() {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(750, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.22);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.23);
  }

  public playBossAlarm() {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, t + i * 0.28);
      osc.frequency.linearRampToValueAtTime(880, t + i * 0.28 + 0.22);

      gain.gain.setValueAtTime(0.25, t + i * 0.28);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.28 + 0.24);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t + i * 0.28);
      osc.stop(t + i * 0.28 + 0.26);
    }
  }

  public playExplosion(size: 'small' | 'medium' | 'large' = 'medium') {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx || !this.sfxGain) return;

    const duration = size === 'large' ? 0.95 : size === 'medium' ? 0.5 : 0.25;
    const peakGain = size === 'large' ? 0.65 : size === 'medium' ? 0.4 : 0.25;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(size === 'large' ? 140 : 180, t);
    osc.frequency.exponentialRampToValueAtTime(26, t + duration * 0.75);

    oscGain.gain.setValueAtTime(peakGain * 0.9, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.75);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + duration * 0.8);

    this.playNoiseBurst(duration, peakGain, size === 'large' ? 380 : 650);
  }

  public playCriticalHit() {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1760, t + 0.08);

    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.1);
  }

  public playHit() {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.08);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.09);
  }

  public playShieldHit() {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1100, t);
    osc.frequency.exponentialRampToValueAtTime(450, t + 0.12);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.13);
  }

  public playBoost() {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(380, t + 0.35);

    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.36);
  }

  public playShockwave() {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.65);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.7);

    this.playNoiseBurst(0.4, 0.3, 500);
  }

  public playPickup() {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.05);

      gain.gain.setValueAtTime(0.2, t + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.18);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(t + idx * 0.05);
      osc.stop(t + idx * 0.05 + 0.2);
    });
  }

  public playWarning() {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(660, t + 0.08);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.17);
  }

  private playNoiseBurst(duration: number, volume: number, cutoff: number) {
    if (!this.ctx || !this.sfxGain) return;

    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    whiteNoise.start(this.ctx.currentTime);
    whiteNoise.stop(this.ctx.currentTime + duration);
  }
}

export const sound = new SoundSystem();
