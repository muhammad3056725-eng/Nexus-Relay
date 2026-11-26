/**
 * NEXUS RELAY — VEX-09 reactive operator mascot.
 * A smooth vector robot with a glass visor face and 14 distinct
 * reactive states. Drawn procedurally with rounded shapes, arcs and
 * gradients in a 48-unit design space, scaled by the caller.
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
  ink: "#0B1226",
  casing: "#2B4A73",
  casingHi: "#7DD3FC",
  screen: "#082F49",
  mint: "#2DD4BF",
  cyan: "#22D3EE",
  amber: "#FFB627",
  magenta: "#F472B6",
  orange: "#FB923C",
  mist: "#A0B5D0",
  gray: "#9CA3AF",
  darkGray: "#64748B",
  jacket: "#1E3A5F",
  violet: "#A78BFA",
};

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

  /** Draw the mascot at logical position (x, y) with unit scale s. */
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
      ctx.translate((frame % 2 === 0 ? 0.7 : -0.7) * s, 0);
    }
    ctx.scale(s, s);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const rr = (rx: number, ry: number, w: number, h: number, r: number, color: string) => {
      ctx.beginPath();
      ctx.roundRect(rx, ry, w, h, r);
      ctx.fillStyle = color;
      ctx.fill();
    };
    const dot = (dx: number, dy: number, r: number, color: string) => {
      ctx.beginPath();
      ctx.arc(dx, dy, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    };

    // ---- antenna ------------------------------------------------------
    let tipX = 24;
    let tipY = 3.4;
    if (this.state === "SEARCHING") {
      tipX += Math.cos(now / 300) * 3;
      tipY += Math.sin(now / 300) * 1.2;
    }
    ctx.strokeStyle = C.casingHi;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(24, 10);
    ctx.lineTo(tipX, tipY + 1.5);
    ctx.stroke();
    dot(tipX, tipY, 2.1, this.state === "SLEEP_MODE" ? C.darkGray : C.amber);
    dot(tipX, tipY, 3.6, "rgba(255,182,39,0.25)");

    // ---- sleep Zzz ------------------------------------------------------
    if (this.state === "SLEEP_MODE") {
      const off = (now / 900) % 1;
      ctx.globalAlpha = 0.85 - off * 0.5;
      ctx.fillStyle = C.mist;
      ctx.font = "bold 6px 'Space Grotesk', Inter, sans-serif";
      ctx.fillText("z", 35 + off * 4, 10 - off * 5);
      ctx.font = "bold 4.5px 'Space Grotesk', Inter, sans-serif";
      ctx.fillText("z", 39 + off * 4, 13 - off * 5);
      ctx.globalAlpha = 1;
    }
    if (this.state === "CAPACITOR_OVERLOAD") {
      ctx.globalAlpha = 0.5;
      dot(17, 4 - ((now / 700) % 1) * 3, 2.4, C.darkGray);
      dot(29, 3 - ((now / 900) % 1) * 3, 1.8, C.darkGray);
      ctx.globalAlpha = 1;
    }

    // ---- ears -----------------------------------------------------------
    rr(5.4, 16, 3.6, 10, 1.8, C.casing);
    rr(39, 16, 3.6, 10, 1.8, C.casing);
    dot(7.2, 21, 1.1, C.cyan);
    dot(40.8, 21, 1.1, C.cyan);

    // ---- head: smooth glass shell --------------------------------------
    const shell = ctx.createLinearGradient(9, 8, 39, 31);
    shell.addColorStop(0, "#7DD3FC");
    shell.addColorStop(0.55, C.casing);
    shell.addColorStop(1, "#1E3A5F");
    ctx.beginPath();
    ctx.roundRect(9, 8.5, 30, 23, 7);
    ctx.fillStyle = shell;
    ctx.fill();
    // visor
    const visor = ctx.createLinearGradient(0, 11, 0, 29);
    visor.addColorStop(0, "#164E63");
    visor.addColorStop(1, C.screen);
    ctx.beginPath();
    ctx.roundRect(12, 11, 24, 17.5, 5.5);
    ctx.fillStyle = this.state === "SIGNAL_SPIKE" && frame % 2 === 0 ? "#3A2A05" : visor;
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(12, 11, 24, 17.5, 5.5);
    ctx.clip();
    this.drawFace(ctx, dot, t, frame, now);
    ctx.restore();
    // visor sheen
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "#E0F2FE";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(15, 14.5);
    ctx.quadraticCurveTo(24, 12, 33, 14.5);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // ---- neck & body ----------------------------------------------------
    rr(21, 31, 6, 3, 1, C.darkGray);
    const armsRaised =
      this.state === "VICTORY_SALUTE" || this.state === "OVERCLOCK_SURGE";
    ctx.strokeStyle = C.jacket;
    ctx.lineWidth = 4.4;
    if (armsRaised) {
      for (const side of [7.5, 40.5]) {
        ctx.beginPath(); ctx.moveTo(side, 38); ctx.lineTo(side, 25); ctx.stroke();
        dot(side, 23.4, 2, C.gray);
      }
    } else if (this.state === "CELEBRATION_DANCE") {
      for (const side of [7.5, 40.5]) {
        ctx.beginPath(); ctx.moveTo(side, 38); ctx.lineTo(side + (side < 24 ? -1.5 : 1.5), 31); ctx.stroke();
      }
    } else {
      for (const side of [7.5, 40.5]) {
        ctx.beginPath(); ctx.moveTo(side, 36); ctx.lineTo(side, 43.5); ctx.stroke();
        dot(side, 44.6, 1.9, C.gray);
      }
    }
    const bodyGrad = ctx.createLinearGradient(0, 33, 0, 48);
    bodyGrad.addColorStop(0, "#2B4A73");
    bodyGrad.addColorStop(1, C.jacket);
    ctx.beginPath();
    ctx.roundRect(13, 33.5, 22, 14, 4.5);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    dot(24, 40, 3.1, C.ink);
    dot(24, 40, 1.7, this.state === "SLEEP_MODE" ? C.darkGray : C.cyan);
    dot(17.5, 44.6, 1.15, C.amber);
    dot(30.5, 44.6, 1.15, C.darkGray);

    if (this.state === "OVERCLOCK_SURGE") {
      dot(3.6, 39.5, 1.9, C.magenta);
      dot(44.4, 39.5, 1.9, C.magenta);
    }
    ctx.restore();
  }

  private drawFace(
    ctx: Ctx,
    dot: (x: number, y: number, r: number, c: string) => void,
    t: number,
    frame: number,
    now: number
  ): void {
    const wave = (amp: number, color: string, freq = 0.55) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      for (let i = 0; i <= 22; i++) {
        const wx = 13 + i;
        const wy = 19.8 + Math.sin(i * freq + now / 240) * amp;
        if (i === 0) ctx.moveTo(wx, wy);
        else ctx.lineTo(wx, wy);
      }
      ctx.stroke();
    };
    const eyes = (color: string) => {
      dot(18.6, 19.2, 1.9, color);
      dot(29.4, 19.2, 1.9, color);
    };
    const smile = (color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(24, 21.4, 4.4, Math.PI * 0.25, Math.PI * 0.75);
      ctx.stroke();
    };

    switch (this.state) {
      case "IDLE_BLINK": {
        if (now % 3700 < 130) {
          ctx.strokeStyle = C.mint; ctx.lineWidth = 1.3;
          for (const ex of [18.6, 29.4]) { ctx.beginPath(); ctx.moveTo(ex - 2, 19.2); ctx.lineTo(ex + 2, 19.2); ctx.stroke(); }
        } else { eyes(C.mint); smile(C.mint); }
        break;
      }
      case "LISTENING": {
        wave(2.2, C.mint);
        for (let i = 0; i < 3; i++) {
          const hgt = 2.6 + ((frame + i) % 3) * 1.7;
          ctx.fillStyle = C.amber;
          ctx.beginPath(); ctx.roundRect(13.6 + i * 1.7, 19.8 - hgt / 2, 1, hgt, 0.5); ctx.fill();
        }
        break;
      }
      case "SIGNAL_SPIKE": {
        ctx.strokeStyle = C.amber;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        const pts = [19.8, 19.8, 12.5, 26, 14.5, 24, 19.8, 19.8, 13.5, 25, 19.8];
        pts.forEach((py, i) => {
          const wx = 13 + i * 2.2;
          if (i === 0) ctx.moveTo(wx, py);
          else ctx.lineTo(wx, py);
        });
        ctx.stroke();
        break;
      }
      case "COLD_STATIC": {
        ctx.globalAlpha = 0.75;
        wave(0.5, C.gray, 1.7);
        wave(0.4, C.darkGray, 2.3);
        ctx.globalAlpha = 1;
        break;
      }
      case "DECRYPTION_FOCUS": {
        wave(1, C.mint);
        ctx.strokeStyle = C.mist;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(29.5, 17.8, 4.4, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(32.6, 21); ctx.lineTo(35.4, 23.8); ctx.stroke();
        break;
      }
      case "OVERCLOCK_SURGE": {
        ctx.fillStyle = C.magenta;
        ctx.beginPath();
        const bolt: Array<[number, number]> = [
          [25.5, 11.8], [20.5, 20], [23.4, 20], [21.8, 27.2],
          [28.6, 18.6], [25.4, 18.6], [28.2, 11.8],
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
        eyes(C.amber); smile(C.amber);
        dot(24, 13.8, 1.4, C.amber);
        break;
      }
      case "CAPACITOR_OVERLOAD": {
        ctx.strokeStyle = C.orange; ctx.lineWidth = 1.4;
        for (const ex of [18.6, 29.4]) {
          ctx.beginPath();
          ctx.moveTo(ex - 2, 16.8); ctx.lineTo(ex + 2, 21.6);
          ctx.moveTo(ex + 2, 16.8); ctx.lineTo(ex - 2, 21.6);
          ctx.stroke();
        }
        break;
      }
      case "SEARCHING": {
        const sx = 13 + ((now / 90) % 22);
        ctx.strokeStyle = C.mint; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(sx, 12); ctx.lineTo(sx, 27.5); ctx.stroke();
        wave(1.1, C.darkGray);
        break;
      }
      case "TAPE_REWIND": {
        ctx.fillStyle = C.mist;
        for (const tx of [16.5, 24.5]) {
          ctx.beginPath();
          ctx.moveTo(tx + 3.6, 19.8); ctx.lineTo(tx, 16.6); ctx.lineTo(tx, 23);
          ctx.closePath(); ctx.fill();
        }
        break;
      }
      case "CHANNEL_SWITCH": {
        for (let i = 0; i < 5; i++) dot(15.4 + i * 4.3, 19.8, 1.45, i === frame % 5 ? C.amber : C.darkGray);
        break;
      }
      case "CELEBRATION_DANCE": {
        eyes(C.mint); smile(C.violet);
        dot(frame % 4 < 2 ? 15 : 33, 14.5, 1.5, C.violet);
        break;
      }
      case "SLEEP_MODE": {
        ctx.globalAlpha = 0.55 + 0.2 * Math.sin(now / 800);
        wave(0.7, C.darkGray);
        ctx.globalAlpha = 1;
        break;
      }
      case "ERROR_GLITCH": {
        ctx.fillStyle = C.magenta;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(14.5, 14.8, 19, 1.7);
        ctx.fillRect(14.5 + (frame % 2) * 1.6, 18.9, 15, 1.7);
        ctx.fillRect(14.5, 23, 18, 1.7);
        ctx.globalAlpha = 1;
        break;
      }
      default: {
        eyes(C.mint); smile(C.mint);
      }
    }
    void t;
  }
}
