import type { PhysicsSnapshot } from "./types";

const AUDIO_MUTE_STORAGE_KEY = "dragon_audio_muted";
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14];
const CALM_PATTERN = [0, 1, 2, 4, 2, 1, 0, 1];
const FLOW_PATTERN = [0, 2, 4, 5, 4, 2, 1, 2];
const RUSH_PATTERN = [0, 2, 4, 5, 6, 5, 4, 2];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safeAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const Ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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

  private effectSend: GainNode | null = null;

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
        // Ignore localStorage failures silently.
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
      this.masterGain.gain.value = this.muted ? 0 : 0.17;
      this.masterGain.connect(this.ctx.destination);
      this.setupEffects();
    }

    try {
      if (this.ctx.state !== "running") {
        await this.ctx.resume();
      }
      this.hasUnlocked = true;
      this.scheduleNextBeat(80);
    } catch {
      // Ignore resume failures silently.
    }
  }

  update(snapshot: PhysicsSnapshot): void {
    this.latestRisk = clamp(snapshot.risk, 0, 1.3);
    this.latestSpeedNorm = clamp(snapshot.speed / 980, 0, 1);
    this.latestFrenzy = snapshot.frenzy;

    const previousStatus = this.latestStatus;
    this.latestStatus = snapshot.status;

    if (this.ctx && this.ctx.state === "running") {
      if (previousStatus !== "gameover" && snapshot.status === "gameover") {
        this.playGong(0.13, 180);
      }
      if (previousStatus !== "level-clear" && snapshot.status === "level-clear") {
        this.playChime(0.11);
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
    this.effectSend = null;
  }

  private setupEffects(): void {
    if (!this.ctx || !this.masterGain || this.effectSend) {
      return;
    }

    const send = this.ctx.createGain();
    const highPass = this.ctx.createBiquadFilter();
    const lowPass = this.ctx.createBiquadFilter();
    const delay = this.ctx.createDelay(1.2);
    const feedback = this.ctx.createGain();

    send.gain.value = 0.22;
    highPass.type = "highpass";
    highPass.frequency.value = 260;
    lowPass.type = "lowpass";
    lowPass.frequency.value = 2600;
    delay.delayTime.value = 0.23;
    feedback.gain.value = 0.28;

    send.connect(highPass);
    highPass.connect(delay);
    delay.connect(lowPass);
    lowPass.connect(this.masterGain);
    delay.connect(feedback);
    feedback.connect(delay);

    this.effectSend = send;
  }

  private syncMasterGain(): void {
    if (!this.masterGain || !this.ctx) {
      return;
    }
    const target = this.muted ? 0 : 0.17;
    this.rampGain(this.masterGain, target, 0.12);
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
      this.playMusicStep();
    }

    const intensity = clamp(this.latestRisk * 0.62 + this.latestSpeedNorm * 0.38, 0, 1.2);
    const beatMs = Math.round(620 - intensity * 250 - (this.latestFrenzy ? 90 : 0));
    this.scheduleNextBeat(clamp(beatMs, 260, 720));
  }

  private playMusicStep(): void {
    if (!this.ctx || !this.masterGain) {
      return;
    }

    const pattern = this.latestRisk > 0.75 ? RUSH_PATTERN : this.latestRisk > 0.42 ? FLOW_PATTERN : CALM_PATTERN;
    const toneIndex = pattern[this.stepIndex % pattern.length] ?? 0;
    const semitone = PENTATONIC[toneIndex] ?? 0;
    const melodyBase = this.latestRisk > 0.7 ? 329.63 : 293.66; // E4 / D4
    const melodyFreq = freqFromSemitone(melodyBase, semitone);
    const melodyGain = 0.024 + this.latestRisk * 0.026 + (this.latestFrenzy ? 0.01 : 0);
    const melodyMs = this.latestRisk > 0.68 ? 220 : 290;

    this.playDiziNote(melodyFreq, melodyGain, melodyMs);

    // Guzheng-like accompaniment every other beat.
    if (this.stepIndex % 2 === 0) {
      const bassScaleIndex = (toneIndex + 2) % 5;
      const bassSemitone = PENTATONIC[bassScaleIndex] ?? 0;
      const bassFreq = freqFromSemitone(146.83, bassSemitone); // D3-based
      const accompanimentGain = 0.018 + this.latestRisk * 0.015;
      this.playGuzhengPluck(bassFreq, accompanimentGain, 330);
    }

    if (this.latestFrenzy && this.stepIndex % 4 === 3) {
      this.playDiziNote(melodyFreq * 1.5, melodyGain * 0.65, 140);
    }

    this.stepIndex += 1;
  }

  private playDiziNote(freq: number, gainAmount: number, durationMs: number): void {
    if (!this.ctx || !this.masterGain) {
      return;
    }

    const now = this.ctx.currentTime;
    const lead = this.ctx.createOscillator();
    const air = this.ctx.createOscillator();
    const vibrato = this.ctx.createOscillator();
    const vibratoGain = this.ctx.createGain();
    const toneFilter = this.ctx.createBiquadFilter();
    const noteGain = this.ctx.createGain();

    lead.type = "sine";
    lead.frequency.setValueAtTime(freq, now);
    air.type = "triangle";
    air.frequency.setValueAtTime(freq * 2, now);

    vibrato.type = "sine";
    vibrato.frequency.setValueAtTime(5.6, now);
    vibratoGain.gain.setValueAtTime(3.2, now);
    vibrato.connect(vibratoGain);
    vibratoGain.connect(lead.frequency);

    toneFilter.type = "lowpass";
    toneFilter.frequency.setValueAtTime(2800, now);
    toneFilter.Q.setValueAtTime(0.7, now);

    noteGain.gain.setValueAtTime(0, now);
    noteGain.gain.linearRampToValueAtTime(gainAmount, now + 0.03);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

    lead.connect(toneFilter);
    air.connect(toneFilter);
    toneFilter.connect(noteGain);
    noteGain.connect(this.masterGain);
    if (this.effectSend) {
      noteGain.connect(this.effectSend);
    }

    lead.start(now);
    air.start(now);
    vibrato.start(now);
    const stopAt = now + durationMs / 1000 + 0.05;
    lead.stop(stopAt);
    air.stop(stopAt);
    vibrato.stop(stopAt);
  }

  private playGuzhengPluck(freq: number, gainAmount: number, durationMs: number): void {
    if (!this.ctx || !this.masterGain) {
      return;
    }

    const now = this.ctx.currentTime;
    const core = this.ctx.createOscillator();
    const harmonics = this.ctx.createOscillator();
    const toneFilter = this.ctx.createBiquadFilter();
    const noteGain = this.ctx.createGain();

    core.type = "triangle";
    core.frequency.setValueAtTime(freq, now);
    harmonics.type = "sine";
    harmonics.frequency.setValueAtTime(freq * 2.02, now);

    toneFilter.type = "bandpass";
    toneFilter.frequency.setValueAtTime(Math.min(2200, freq * 6.5), now);
    toneFilter.Q.setValueAtTime(0.9, now);

    noteGain.gain.setValueAtTime(0, now);
    noteGain.gain.linearRampToValueAtTime(gainAmount, now + 0.01);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

    core.connect(toneFilter);
    harmonics.connect(toneFilter);
    toneFilter.connect(noteGain);
    noteGain.connect(this.masterGain);
    if (this.effectSend) {
      noteGain.connect(this.effectSend);
    }

    core.start(now);
    harmonics.start(now);
    const stopAt = now + durationMs / 1000 + 0.04;
    core.stop(stopAt);
    harmonics.stop(stopAt);
  }

  private playGong(gainAmount: number, durationMs: number): void {
    this.playGuzhengPluck(110, gainAmount, durationMs);
  }

  private playChime(gainAmount: number): void {
    this.playDiziNote(392, gainAmount, 190);
    this.playDiziNote(587.33, gainAmount * 0.7, 230);
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
