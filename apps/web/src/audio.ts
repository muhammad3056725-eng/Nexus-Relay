/**
 * NEXUS RELAY — procedural sound (no audio files). Short one-shots
 * adapted from the original AudioSynth; the ambient music loop is OFF
 * by default and only plays when the player turns it on.
 */
export class Sfx {
  sound = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicOn = false;
  private step = 0;

  private ensure(): AudioContext | null {
    try {
      if (!this.ctx) {
        const AC =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.32;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private tone(freq: number, at: number, dur: number, type: OscillatorType, vol: number, slideTo?: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(this.master);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  private play(fn: (t: number) => void): void {
    if (!this.sound) return;
    const ctx = this.ensure();
    if (!ctx) return;
    fn(ctx.currentTime + 0.005);
  }

  /** Soft UI tap. */
  click(): void {
    this.play((t) => this.tone(1800, t, 0.05, "sine", 0.12, 1200));
  }

  /** A new clue arrives: rising sonar blip. */
  clue(n: number): void {
    this.play((t) => {
      const f = 440 + n * 90;
      this.tone(f, t, 0.18, "sine", 0.22, f * 1.5);
      this.tone(f * 2, t + 0.05, 0.12, "triangle", 0.06);
    });
  }

  /** Correct answer: bright major arpeggio. */
  correct(): void {
    this.play((t) => {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, t + i * 0.07, 0.28, "triangle", 0.2));
      this.tone(2093, t + 0.3, 0.35, "sine", 0.06);
    });
  }

  /** Wrong pick: gentle low "nope" (never harsh). */
  wrong(): void {
    this.play((t) => {
      this.tone(330, t, 0.16, "sine", 0.18, 260);
      this.tone(247, t + 0.12, 0.22, "sine", 0.14, 200);
    });
  }

  /** Bonus link / jammer zap. */
  zap(): void {
    this.play((t) => this.tone(880, t, 0.12, "square", 0.08, 1760));
  }

  /** Run complete fanfare. */
  fanfare(): void {
    this.play((t) => {
      [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, t + i * 0.1, 0.4, "triangle", 0.18));
    });
  }

  /** Turbo countdown tick. */
  tick(): void {
    this.play((t) => this.tone(1200, t, 0.04, "square", 0.04));
  }

  /** Ambient music loop (off by default). */
  setMusic(on: boolean): void {
    this.musicOn = on;
    if (!on) {
      if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
      this.musicTimer = null;
      return;
    }
    const ctx = this.ensure();
    if (!ctx || this.musicTimer !== null) return;
    const bass = [110, 0, 0, 0, 98, 0, 0, 0, 87.31, 0, 0, 0, 98, 0, 0, 0];
    const arp = [440, 523.25, 659.25, 523.25, 392, 493.88, 587.33, 493.88, 349.23, 440, 523.25, 440, 392, 493.88, 587.33, 659.25];
    const stepDur = 60 / 92 / 2;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicOn || document.hidden) return;
      const t = this.ctx.currentTime + 0.05;
      const i = this.step % 16;
      if (bass[i]) this.tone(bass[i], t, stepDur * 3.5, "sine", 0.16);
      this.tone(arp[i], t, stepDur * 1.6, "triangle", 0.035);
      this.step++;
    }, stepDur * 1000);
  }
}
