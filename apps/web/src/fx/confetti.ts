/**
 * Celebration bursts: glowing confetti + sparks on a transparent
 * overlay canvas above the UI. The loop only runs while particles are
 * alive, so it costs nothing between bursts.
 */
interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: 0 | 1; // 0 = confetti ribbon, 1 = glow spark
}

const PALETTE = ["#22d3ee", "#f472b6", "#a78bfa", "#34d399", "#fbbf24", "#e0f2fe"];

export class Confetti {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private parts: P[] = [];
  private raf = 0;
  private dpr = 1;
  private last = 0;
  reduced = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) return;
    try {
      this.ctx = canvas.getContext("2d");
    } catch {
      this.ctx = null;
    }
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  private resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(window.innerWidth * this.dpr);
    this.canvas.height = Math.floor(window.innerHeight * this.dpr);
  }

  /** Burst from a viewport point (CSS px). */
  burst(x: number, y: number, amount = 1): void {
    if (!this.ctx || this.reduced) return;
    const n = Math.round(70 * amount);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 9;
      const spark = Math.random() < 0.35;
      this.parts.push({
        x: x * this.dpr,
        y: y * this.dpr,
        vx: Math.cos(a) * sp * this.dpr,
        vy: (Math.sin(a) * sp - 5) * this.dpr,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        life: 0,
        max: 55 + Math.random() * 45,
        size: (spark ? 2 + Math.random() * 2.5 : 5 + Math.random() * 5) * this.dpr,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        kind: spark ? 1 : 0,
      });
    }
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  private tick = (now: number): void => {
    const ctx = this.ctx!;
    const k = Math.min(3, (now - this.last) / 16.7);
    this.last = now;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.parts = this.parts.filter((p) => p.life < p.max);
    for (const p of this.parts) {
      p.life += k;
      p.vy += 0.32 * this.dpr * k;
      p.vx *= Math.pow(0.985, k);
      p.vy *= Math.pow(0.985, k);
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.rot += p.vr * k;
      const fade = 1 - p.life / p.max;
      ctx.globalAlpha = Math.max(0, fade);
      if (p.kind === 1) {
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12 * this.dpr;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = "source-over";
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.abs(Math.cos(p.rot * 2)) * 0.8 + 0.2);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    if (this.parts.length) this.raf = requestAnimationFrame(this.tick);
    else {
      this.raf = 0;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  };
}
