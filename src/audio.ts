import type { Cue } from "./types";

export class AudioRuntime {
  muted = false;
  private context: AudioContext | null = null;
  private armed = false;

  arm(): void {
    if (this.armed) {
      return;
    }
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    this.context = new AudioContextClass();
    void this.context.resume();
    this.armed = true;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  play(cue: Cue): void {
    if (this.muted || !this.armed || !this.context) {
      return;
    }
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const settings: Record<
      Cue,
      { freq: number; type: OscillatorType; gain: number }
    > = {
      "paddle-hit": { freq: 320, type: "square", gain: 0.055 },
      "wall-bounce": { freq: 220, type: "triangle", gain: 0.045 },
      "obstacle-bounce": { freq: 520, type: "sawtooth", gain: 0.04 },
      score: { freq: 120, type: "sine", gain: 0.08 },
    };
    const setting = settings[cue];
    osc.type = setting.type;
    osc.frequency.setValueAtTime(setting.freq, now);
    gain.gain.setValueAtTime(setting.gain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain).connect(this.context.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
