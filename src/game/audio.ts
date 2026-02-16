import type { PhysicsSnapshot } from "./types";

const AUDIO_MUTE_STORAGE_KEY = "dragon_audio_muted";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safeAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) {
    return null;
  }

  try {
    return new Ctor();
  } catch {
    return null;
  }
}

function freqFromSemitone(baseFreq: number, semitone: number): number {
  return baseFreq * Math.pow(2, semitone / 12);
}

export function readStoredMuted(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(AUDIO_MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export class DragonAudioEngine {
  private ctx: AudioContext | null = null;

  private masterGain: GainNode | null = null;

  private droneGain: GainNode | null = null;

  private beatTimer: number | null = null;

  private muted: boolean;

  private isDisposed = false;

  private hasUnlocked = false;

  private stepIndex = 0;

  private latestRisk = 0;

  private latestSpeedNorm = 0;

  private latestFrenzy = false;

  private latestStatus: PhysicsSnapshot["status"] = "ready";

  constructor(initialMuted: boolean) {
    this.muted = initialMuted;
  }

  getMuted(): boolean {
    return this.muted;
  }

  setMuted(nextMuted: boolean): void {
    this.muted = nextMuted;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(AUDIO_MUTE_STORAGE_KEY, nextMuted ? "1" : "0");
      } catch {
        // Ignore localStorage failure silently.
      }
    }

    this.syncMasterGain();
  }

  async unlock(): Promise<void> {
    if (this.isDisposed) {
      return;
    }

    if (!this.ctx) {
      this.ctx = safeAudioContext();
      if (!this.ctx) {
        return;
      }
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.16;
      this.masterGain.connect(this.ctx.destination);
      this.ensureDrone();
    }

    try {
      if (this.ctx.state !== "running") {
        await this.ctx.resume();
      }
      this.hasUnlocked = true;
      this.scheduleNextBeat(120);
    } catch {
      // Ignore resume failures silently.
    }
  }

  update(snapshot: PhysicsSnapshot): void {
    this.latestRisk = clamp(snapshot.risk, 0, 1.25);
    this.latestSpeedNorm = clamp(snapshot.speed / 980, 0, 1);
    this.latestFrenzy = snapshot.frenzy;

    const previousStatus = this.latestStatus;
    this.latestStatus = snapshot.status;

    if (this.ctx && this.ctx.state === "running") {
      const targetDrone = this.muted || snapshot.status !== "running" ? 0 : 0.08 + this.latestRisk * 0.05;
      this.rampGain(this.droneGain, targetDrone, 0.12);
      if (previousStatus !== "gameover" && snapshot.status === "gameover") {
        this.playGong(0.14, 140);
      }
      if (previousStatus !== "level-clear" && snapshot.status === "level-clear") {
        this.playChime(0.12);
      }
    }
  }

  dispose(): void {
    this.isDisposed = true;
    if (this.beatTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(this.beatTimer);
      this.beatTimer = null;
    }

    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
    this.droneGain = null;
  }

  private syncMasterGain(): void {
    if (!this.masterGain || !this.ctx) {
      return;
    }
    const target = this.muted ? 0 : 0.16;
    this.rampGain(this.masterGain, target, 0.1);
  }

  private ensureDrone(): void {
    if (!this.ctx || !this.masterGain || this.droneGain) {
      return;
    }

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.value = 164.81; // E3
    filter.type = "lowpass";
    filter.frequency.value = 940;
    filter.Q.value = 0.6;
    gain.gain.value = 0;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start();

    this.droneGain = gain;
  }

  private scheduleNextBeat(delayMs = 0): void {
    if (typeof window === "undefined") {
      return;
    }
    if (this.beatTimer !== null) {
      window.clearTimeout(this.beatTimer);
      this.beatTimer = null;
    }

    this.beatTimer = window.setTimeout(() => {
      this.beatTimer = null;
      this.runBeat();
    }, Math.max(0, delayMs));
  }

  private runBeat(): void {
    if (this.isDisposed || !this.ctx || !this.masterGain || !this.hasUnlocked) {
      return;
    }

    if (!this.muted && this.latestStatus === "running") {
      this.playMelodyStep();
    }

    const intensity = clamp(this.latestRisk * 0.65 + this.latestSpeedNorm * 0.35, 0, 1.2);
    const beatMs = Math.round(560 - intensity * 230 - (this.latestFrenzy ? 70 : 0));
    this.scheduleNextBeat(clamp(beatMs, 240, 620));
  }

  private playMelodyStep(): void {
    if (!this.ctx || !this.masterGain) {
      return;
    }

    const pentatonic = [0, 3, 5, 7, 10];
    const pattern = [0, 2, 1, 3, 2, 4, 1, 3];
    const toneIndex = pattern[this.stepIndex % pattern.length];
    const semitone = pentatonic[toneIndex];
    const base = this.latestRisk > 0.6 ? 220 : 196;
    const freq = freqFromSemitone(base, semitone);
    const gain = 0.035 + this.latestRisk * 0.045 + (this.latestFrenzy ? 0.015 : 0);
    const durationMs = this.latestRisk > 0.65 ? 180 : 230;

    this.playPluck(freq, gain, durationMs);

    if (this.latestFrenzy && this.stepIndex % 2 === 0) {
      this.playPluck(freq * 2, gain * 0.55, 120);
    }

    this.stepIndex += 1;
  }

  private playPluck(freq: number, gainAmount: number, durationMs: number): void {
    if (!this.ctx || !this.masterGain) {
      return;
    }

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, now);
    filter.Q.setValueAtTime(1.1, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gainAmount, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.02);
  }

  private playGong(gainAmount: number, durationMs: number): void {
    this.playPluck(110, gainAmount, durationMs);
  }

  private playChime(gainAmount: number): void {
    this.playPluck(392, gainAmount, 200);
    this.playPluck(523.25, gainAmount * 0.72, 240);
  }

  private rampGain(node: GainNode | null, target: number, timeSec: number): void {
    if (!node || !this.ctx) {
      return;
    }
    const now = this.ctx.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(node.gain.value, now);
    node.gain.linearRampToValueAtTime(target, now + timeSec);
  }
}
