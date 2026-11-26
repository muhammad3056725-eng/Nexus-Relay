/**
 * NEXUS RELAY — VEX-09 reactive pixel mascot (Blueprint §3).
 * A 48x48 pixel CRT-headed operator sprite with 14 distinct states.
 * Drawn procedurally on the logical pixel grid so every frame is
 * crisp at integer upscales.
 */

export const VEX_STATES = [
  "IDLE_BLINK",
  "LISTENING",
  "SIGNAL_SPIKE",
  "COLD_STATIC",
  "DECRYPTION_FOCUS",
  "OVERCLOCK_SURGE",
  "VICTORY_SALUTE",
  "CAPACITOR_OVERLOAD",
  "SEARCHING",
  "TAPE_REWIND",
  "CHANNEL_SWITCH",
  "CELEBRATION_DANCE",
  "SLEEP_MODE",
  "ERROR_GLITCH",
] as const;

export type VexState = (typeof VEX_STATES)[number];

const C = {
  ink: "#0B0E14",
  casing: "#24324D",
  casingHi: "#4F678F",
  screen: "#05070C",
  mint: "#2CF6B3",
  amber: "#FFB627",
  magenta: "#FF2A85",
  orange: "#FF6B35",
  mist: "#A0B5D0",
  gray: "#9CA3AF",
  darkGray: "#4B5563",
  jacket: "#36496B",
  violet: "#8B5CF6",
};

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Ctx = CanvasRenderingContext2D;

export class MascotVex09 {
  state: VexState = "IDLE_BLINK";
  private stateSince = 0;

  setState(state: VexState, now: number): void {
    if (state !== this.state) {
      this.state = state;
      this.stateSince = now;
    }
  }

  /** Draw the 48x48 sprite at logical position (x, y) with pixel scale s. */
  draw(ctx: Ctx, x: number, y: number, s: number, now: number): void {
    const t = (now - this.stateSince) / 1000;
    const frame = Math.floor(now / 125);
    ctx.save();
    ctx.translate(x, y);
    if (this.state === "CELEBRATION_DANCE") {
      const bounce = [0, -1, -2, -1][frame % 4];
      ctx.translate(0, bounce * s);
    }
    if (this.state === "ERROR_GLITCH") {
      ctx.translate((frame % 2 === 0 ? 1 : -1) * s, 0);
    }
    ctx.scale(s, s);
    const px = (rx: number, ry: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(rx, ry, w, h);
    };

    // ---- antenna ------------------------------------------------------
    const tipBase = { x: 23.5, y: 2.5 };
    if (this.state === "SEARCHING") {
      tipBase.x += Math.cos(now / 300) * 3;
      tipBase.y += Math.sin(now / 300) * 1.2;
    }
    px(23, 4, 2, 6, C.casingHi);
    px(tipBase.x - 1.5, tipBase.y - 1.5, 3, 3, this.state === "SLEEP_MODE" ? C.darkGray : C.amber);

    // ---- smoke (CAPACITOR_OVERLOAD) -----------------------------------
    if (this.state === "CAPACITOR_OVERLOAD") {
      const rnd = mulberry(7);
      for (let i = 0; i < 5; i++) {
        const rise = ((now / 700 + rnd()) % 1) * 8;
        ctx.globalAlpha = 0.55 - rise / 16;
        px(14 + rnd() * 18, 4 - rise, 4, 3, C.darkGray);
      }
      ctx.globalAlpha = 1;
    }
    // ---- sleep Zzz ------------------------------------------------------
    if (this.state === "SLEEP_MODE") {
      const off = (now / 900) % 1;
      ctx.globalAlpha = 0.8 - off * 0.5;
      const zx = 36 + off * 4;
      const zy = 8 - off * 6;
      px(zx, zy, 4, 1, C.mist);
      px(zx + 2, zy + 1, 1, 1, C.mist);
      px(zx + 1, zy + 2, 1, 1, C.mist);
      px(zx, zy + 3, 4, 1, C.mist);
      ctx.globalAlpha = 1;
    }

    // ---- head casing ----------------------------------------------------
    px(9, 9, 30, 22, C.ink);
    px(10, 8, 28, 22, C.casing);
    px(10, 8, 28, 2, C.casingHi);
    px(6, 16, 3, 9, C.casing);
    px(39, 16, 3, 9, C.casing);
    px(6, 19, 3, 2, C.darkGray);
    px(39, 19, 3, 2, C.darkGray);

    // ---- screen ---------------------------------------------------------
    const flash =
      this.state === "SIGNAL_SPIKE" && frame % 2 === 0
        ? "#3A2A05"
        : C.screen;
    px(12, 11, 24, 17, flash);
    ctx.save();
    ctx.beginPath();
    ctx.rect(12, 11, 24, 17);
    ctx.clip();
    this.drawFace(ctx, px, t, frame, now);
    ctx.restore();

    // ---- neck & body ----------------------------------------------------
    px(21, 30, 6, 3, C.darkGray);
    const armsRaised =
      this.state === "VICTORY_SALUTE" || this.state === "OVERCLOCK_SURGE";
    if (armsRaised) {
      px(5, 22, 4, 12, C.jacket);
      px(39, 22, 4, 12, C.jacket);
      px(5, 20, 4, 3, C.gray);
      px(39, 20, 4, 3, C.gray);
    } else if (this.state === "DECRYPTION_FOCUS") {
      const a = frame % 2 === 0 ? 0 : 1;
      px(7, 38 + a, 5, 7, C.jacket);
      px(36, 38 + (1 - a), 5, 7, C.jacket);
    } else if (this.state === "CHANNEL_SWITCH") {
      px(7, 38, 5, 7, C.jacket);
      px(38, 30, 4, 10, C.jacket);
      // diegetic toggle switch
      px(43, 30, 3, 10, C.casing);
      const leverUp = Math.floor(now / 500) % 2 === 0;
      px(44, leverUp ? 31 : 36, 1.6, 5, C.amber);
    } else if (this.state === "TAPE_REWIND") {
      px(6, 36, 6, 6, C.jacket);
      px(36, 36, 6, 6, C.jacket);
      for (const cx of [9, 39]) {
        ctx.strokeStyle = C.mist;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, 39, 3.4, 0, Math.PI * 2);
        ctx.stroke();
        const ang = now / 60;
        for (let k = 0; k < 3; k++) {
          const a2 = ang + (k * Math.PI * 2) / 3;
          px(cx + Math.cos(a2) * 2.4 - 0.5, 39 + Math.sin(a2) * 2.4 - 0.5, 1.4, 1.4, C.mist);
        }
      }
    } else {
      px(7, 38, 5, 7, C.jacket);
      px(36, 38, 5, 7, C.jacket);
    }
    px(13, 33, 22, 14, C.jacket);
    px(13, 33, 22, 2, C.casingHi);
    px(22, 36, 4, 4, C.ink);
    px(23, 37, 2, 2, this.state === "SLEEP_MODE" ? C.darkGray : C.mint);
    px(16, 42, 3, 2, C.amber);
    px(29, 42, 3, 2, C.darkGray);

    // overclock levers
    if (this.state === "OVERCLOCK_SURGE") {
      px(4, 40, 2, 7, C.casing);
      px(42, 40, 2, 7, C.casing);
      px(3.4, 38, 3, 3, C.magenta);
      px(41.4, 38, 3, 3, C.magenta);
    }
    ctx.restore();
  }

  private drawFace(
    ctx: Ctx,
    px: (x: number, y: number, w: number, h: number, c: string) => void,
    t: number,
    frame: number,
    now: number
  ): void {
    const wave = (amp: number, color: string, freq = 0.55) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 22; i++) {
        const wx = 13 + i;
        const wy = 19.5 + Math.sin(i * freq + now / 240) * amp;
        if (i === 0) ctx.moveTo(wx, wy);
        else ctx.lineTo(wx, wy);
      }
      ctx.stroke();
    };

    switch (this.state) {
      case "IDLE_BLINK": {
        const blink = now % 3700 < 130;
        if (blink) {
          px(16, 19, 5, 1.4, C.mint);
          px(27, 19, 5, 1.4, C.mint);
        } else wave(1.6, C.mint);
        break;
      }
      case "LISTENING": {
        wave(2.4, C.mint);
        for (let i = 0; i < 3; i++) {
          const hgt = 3 + ((frame + i) % 3) * 2;
          px(13.4 + i * 1.6, 19.5 - hgt / 2, 1, hgt, C.amber);
        }
        break;
      }
      case "SIGNAL_SPIKE": {
        ctx.strokeStyle = C.amber;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        const pts = [19.5, 19.5, 12, 26, 14, 24, 19.5, 19.5, 13, 25, 19.5];
        pts.forEach((py, i) => {
          const wx = 13 + i * 2.2;
          if (i === 0) ctx.moveTo(wx, py);
          else ctx.lineTo(wx, py);
        });
        ctx.stroke();
        break;
      }
      case "COLD_STATIC": {
        const rnd = mulberry(frame * 131 + 7);
        for (let i = 0; i < 110; i++) {
          const gx = 12 + rnd() * 24;
          const gy = 11 + rnd() * 17;
          px(gx, gy, 1.2, 1.2, rnd() > 0.5 ? C.gray : C.darkGray);
        }
        break;
      }
      case "DECRYPTION_FOCUS": {
        wave(1.1, C.mint);
        ctx.strokeStyle = C.mist;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(29, 18, 4.6, 0, Math.PI * 2);
        ctx.stroke();
        px(32.4, 21.4, 3.4, 1.4, C.mist);
        break;
      }
      case "OVERCLOCK_SURGE": {
        ctx.fillStyle = C.magenta;
        ctx.beginPath();
        const bolt: Array<[number, number]> = [
          [25.5, 11.5], [20.5, 20], [23.4, 20], [21.8, 27.5],
          [28.6, 18.6], [25.4, 18.6], [28.2, 11.5],
        ];
        bolt.forEach(([bx, by], i) => {
          if (i === 0) ctx.moveTo(bx, by);
          else ctx.lineTo(bx, by);
        });
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "VICTORY_SALUTE": {
        ctx.fillStyle = C.amber;
        const cx = 24;
        const cy = 19.5;
        px(cx - 0.7, cy - 6, 1.4, 12, C.amber);
        px(cx - 5.4, cy - 1.9, 10.8, 1.4, C.amber);
        px(cx - 3.8, cy - 4.6, 1.4, 9.2, C.amber);
        px(cx + 2.4, cy - 4.6, 1.4, 9.2, C.amber);
        px(cx - 4.6, cy + 3.4, 9.2, 1.4, C.amber);
        break;
      }
      case "CAPACITOR_OVERLOAD": {
        for (const ex of [18, 28]) {
          px(ex - 2, 16, 5, 1.3, C.orange);
          px(ex - 2, 20, 5, 1.3, C.orange);
          px(ex - 0.6, 14.6, 1.3, 6.6, C.orange);
        }
        break;
      }
      case "SEARCHING": {
        const sx = 12 + ((now / 90) % 24);
        px(sx, 11, 1.2, 17, C.mint);
        wave(1.2, C.darkGray);
        break;
      }
      case "TAPE_REWIND": {
        for (const tx of [17, 25]) {
          ctx.fillStyle = C.mist;
          ctx.beginPath();
          ctx.moveTo(tx + 3.4, 19.5);
          ctx.lineTo(tx, 16.4);
          ctx.lineTo(tx, 22.6);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
      case "CHANNEL_SWITCH": {
        for (let i = 0; i < 5; i++) {
          px(14.6 + i * 4.4, 17.6, 3, 3, i === frame % 5 ? C.amber : C.darkGray);
        }
        break;
      }
      case "CELEBRATION_DANCE": {
        wave(2.2, C.mint);
        const side = frame % 4 < 2 ? 15 : 31;
        px(side, 14, 1.2, 5, C.violet);
        px(side - 1, 18.4, 3, 2.4, C.violet);
        break;
      }
      case "SLEEP_MODE": {
        ctx.globalAlpha = 0.5 + 0.2 * Math.sin(now / 800);
        wave(0.8, C.darkGray);
        ctx.globalAlpha = 1;
        break;
      }
      case "ERROR_GLITCH": {
        px(14, 14.6, 20, 2, C.magenta);
        px(14 + (frame % 2) * 2, 18.4, 16, 2, C.magenta);
        px(14, 22.2, 19, 2, C.magenta);
        break;
      }
      default: {
        wave(1.6, C.mint);
      }
    }
    void t;
  }
}
