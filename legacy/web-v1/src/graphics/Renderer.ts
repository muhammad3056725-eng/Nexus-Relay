/**
 * NEXUS RELAY — Renderer.
 *
 * Native logical resolution 480x270. The scene is drawn on an offscreen
 * 2D canvas in four smooth layers, then uploaded as a WebGL2 texture
 * and presented through a clean glow/bloom post pass (no distortion,
 * crisp). If WebGL2 is not available the scene canvas is
 * presented directly with smooth scaling.
 *
 * Layer 0: parallax starfield            (vx = 0.05 px/frame)
 * Layer 1: racks, tape reels, radar dish (vx = 0.15 px/frame),
 *          soft volumetric light shafts
 * Layer 2: the diegetic console deck is the DOM deck beside this
 *          canvas; here the Signal Containment Core + VEX-09 render
 * Layer 3: targeting reticle + spark particle overlay
 */
import {
  PaletteManager,
  sectorForDomain,
  type Sector,
} from "./PaletteManager";
import { MascotVex09 } from "./MascotVex09";
import { drawGlyph } from "./Glyphs";
import { compileProgram, fullscreenQuad, FULLSCREEN_VERTEX, GLOW_FRAGMENT } from "./Shaders";

export const LOGICAL_W = 480;
export const LOGICAL_H = 270;

export type GlowIntensity = "off" | "subtle" | "full";
/** Backwards-compatible alias for the display-glow setting values. */
export type CrtIntensity = GlowIntensity;

/** Display-glow presets: bloom lift applied to bright signal accents. */
const GLOW_PRESETS: Record<GlowIntensity, number> = {
  off: 0,
  subtle: 0.35,
  full: 0.7,
};

interface Star { x: number; y: number; s: number; tw: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string }

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export class Renderer {
  readonly mascot = new MascotVex09();
  readonly palette: PaletteManager;
  webglActive = false;
  reducedMotion = false;

  private display: HTMLCanvasElement;
  private fallbackCanvas: HTMLCanvasElement | null = null;
  private scene: HTMLCanvasElement;
  private sceneCtx: CanvasRenderingContext2D | null;
  private bgCurrent: HTMLCanvasElement;
  private bgPrevious: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private glow: GlowIntensity = "subtle";
  private stars: Star[] = [];
  private particles: Particle[] = [];
  private lastNow = 0;
  private layer1Offset = 0;
  private revealedDom: number | null = null;
  private sector: Sector;

  constructor(canvas: HTMLCanvasElement) {
    this.display = canvas;
    this.sector = sectorForDomain(3);
    this.palette = new PaletteManager(this.sector);
    this.scene = makeCanvas(LOGICAL_W, LOGICAL_H);
    this.sceneCtx = this.scene.getContext("2d");
    this.bgCurrent = makeCanvas(LOGICAL_W, LOGICAL_H);
    this.bgPrevious = makeCanvas(LOGICAL_W, LOGICAL_H);
    this.renderBackground(this.bgCurrent, this.sector);
    this.renderBackground(this.bgPrevious, this.sector);
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: Math.random() * LOGICAL_W,
        y: Math.random() * LOGICAL_H,
        s: Math.random() < 0.8 ? 1 : 2,
        tw: Math.random() * Math.PI * 2,
      });
    }
    this.initGL();
  }

  private initGL(): void {
    const gl = this.display.getContext("webgl2", { antialias: true });
    if (!gl) return;
    const prog = compileProgram(gl, FULLSCREEN_VERTEX, GLOW_FRAGMENT);
    if (!prog) return;
    this.gl = gl;
    this.program = prog;
    this.vao = fullscreenQuad(gl);
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.webglActive = true;
  }

  /** Fluid-scale the display canvas to fit the container width. */
  fit(containerWidth: number): void {
    const w = `${Math.max(280, Math.floor(containerWidth))}px`;
    const h = `${Math.round((Math.max(280, Math.floor(containerWidth)) * LOGICAL_H) / LOGICAL_W)}px`;
    this.display.style.width = w;
    this.display.style.height = h;
    if (this.fallbackCanvas) {
      this.fallbackCanvas.style.width = w;
      this.fallbackCanvas.style.height = h;
    }
  }

  /** Display-glow setting (off / subtle / full) from the settings UI. */
  setGlowIntensity(level: GlowIntensity): void {
    this.glow = level;
  }

  /** Backwards-compatible alias kept for existing callers. */
  setCrtIntensity(level: CrtIntensity): void {
    this.setGlowIntensity(level);
  }

  setSector(dom: number, now: number): void {
    const next = sectorForDomain(dom);
    if (next.name === this.sector.name) return;
    // snapshot the outgoing background for the Bayer cross-fade
    const prevCtx = this.bgPrevious.getContext("2d");
    if (prevCtx) prevCtx.drawImage(this.bgCurrent, 0, 0);
    this.sector = next;
    this.palette.crossFadeTo(next, now);
    this.renderBackground(this.bgCurrent, next);
  }

  setRevealed(dom: number | null): void {
    this.revealedDom = dom;
  }

  burst(color: string, n = 26): void {
    if (this.reducedMotion) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.4 + Math.random() * 1.6;
      this.particles.push({
        x: 240,
        y: 118,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 40 + Math.random() * 30,
        color,
      });
    }
  }

  private renderBackground(target: HTMLCanvasElement, sector: Sector): void {
    const ctx = target.getContext("2d");
    if (!ctx) return;
    const grad = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    grad.addColorStop(0, sector.bg);
    grad.addColorStop(0.65, sector.mid);
    grad.addColorStop(1, sector.bg);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    // porthole with deep field (right side)
    ctx.fillStyle = "#05070C";
    ctx.beginPath();
    ctx.arc(424, 52, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = sector.mid;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  frame(now: number): void {
    const ctx = this.sceneCtx;
    if (!ctx) return;
    const dtFrames = this.lastNow
      ? Math.min(3, (now - this.lastNow) / 16.7)
      : 1;
    this.lastNow = now;
    const drift = this.reducedMotion ? 0 : dtFrames;

    // ---- background with a smooth alpha cross-fade between LUTs ------
    const fade = this.palette.fadeProgress(now);
    if (fade < 1 && this.palette.fadingFrom) {
      ctx.drawImage(this.bgPrevious, 0, 0);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.drawImage(this.bgCurrent, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(this.bgCurrent, 0, 0);
    }

    // ---- Layer 0: parallax starfield (vx = 0.05 px/frame) -------------
    ctx.fillStyle = "#F3F4F6";
    for (const star of this.stars) {
      star.x -= 0.05 * drift;
      if (star.x < 0) star.x += LOGICAL_W;
      const inPorthole =
        (star.x - 424) ** 2 + (star.y - 52) ** 2 < 28 ** 2;
      ctx.globalAlpha = inPorthole
        ? 0.55 + 0.45 * Math.sin(now / 400 + star.tw)
        : 0.16;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.s * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ---- Layer 1: mid-ground architecture (vx = 0.15 px/frame) --------
    this.layer1Offset = (this.layer1Offset + 0.15 * drift) % 24;
    this.drawRacks(ctx, now);
    this.drawTapeReels(ctx, now);
    this.drawRadar(ctx, now);
    this.drawLightShafts(ctx);

    // ---- Layer 2: containment core + mascot ---------------------------
    this.drawCore(ctx, now);
    this.mascot.draw(ctx, 12, LOGICAL_H - 104, 2, now);
    // desk line under the mascot
    ctx.fillStyle = "#0B0E14";
    ctx.fillRect(0, LOGICAL_H - 10, LOGICAL_W, 10);
    ctx.fillStyle = this.sector.mid;
    ctx.fillRect(0, LOGICAL_H - 10, LOGICAL_W, 1);

    // ---- Layer 3: reticle + particles ----------------------------------
    this.drawReticle(ctx, now);
    this.updateParticles(ctx);

    // ---- present --------------------------------------------------------
    if (this.gl && this.program && this.texture) {
      const gl = this.gl;
      gl.viewport(0, 0, LOGICAL_W, LOGICAL_H);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.scene
      );
      gl.useProgram(this.program);
      gl.uniform1i(gl.getUniformLocation(this.program, "u_sceneBuffer"), 0);
      gl.uniform1f(gl.getUniformLocation(this.program, "u_time"), now / 1000);
      gl.uniform2f(
        gl.getUniformLocation(this.program, "u_resolution"),
        LOGICAL_W,
        LOGICAL_H
      );
      gl.uniform1f(gl.getUniformLocation(this.program, "u_glow"), GLOW_PRESETS[this.glow]);
      gl.bindVertexArray(this.vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    } else {
      if (!this.fallbackCanvas) {
        this.fallbackCanvas = makeCanvas(LOGICAL_W, LOGICAL_H);
        this.fallbackCanvas.className = this.display.className;
        this.fallbackCanvas.style.cssText = this.display.style.cssText;
        this.display.style.display = "none";
        this.display.after(this.fallbackCanvas);
      }
      const fctx = this.fallbackCanvas.getContext("2d");
      if (fctx) {
        fctx.imageSmoothingEnabled = true;
        fctx.imageSmoothingQuality = "high";
        fctx.drawImage(this.scene, 0, 0);
      }
    }
  }

  private drawRacks(ctx: CanvasRenderingContext2D, now: number): void {
    const blink = Math.floor(now / 480);
    for (const baseX of [330, 356]) {
      ctx.fillStyle = "#0B0E14";
      ctx.fillRect(baseX, 108, 22, 128);
      ctx.strokeStyle = this.sector.mid;
      ctx.lineWidth = 1;
      ctx.strokeRect(baseX + 0.5, 108.5, 21, 127);
      for (let row = 0; row < 12; row++) {
        for (let col = 0; col < 3; col++) {
          const on = (row * 7 + col * 13 + blink + baseX) % 5 === 0;
          ctx.fillStyle = on ? this.sector.accent : "#24324D";
          ctx.fillRect(baseX + 4 + col * 6, 116 + row * 10, 3, 3);
        }
      }
    }
    // far rack, parallax-shifted
    const farX = 128 - this.layer1Offset;
    ctx.fillStyle = "rgba(11,14,20,0.85)";
    ctx.fillRect(farX, 150, 18, 86);
    ctx.fillStyle = this.sector.glow;
    for (let row = 0; row < 7; row++) {
      ctx.globalAlpha = (row + blink) % 3 === 0 ? 0.9 : 0.25;
      ctx.fillRect(farX + 4, 158 + row * 11, 10, 2);
    }
    ctx.globalAlpha = 1;
  }

  private drawTapeReels(ctx: CanvasRenderingContext2D, now: number): void {
    for (const [cx, cy] of [
      [392, 128],
      [392, 168],
    ] as const) {
      ctx.strokeStyle = "#708AA8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, Math.PI * 2);
      ctx.stroke();
      const ang = now / (this.reducedMotion ? 1e9 : 260);
      for (let k = 0; k < 3; k++) {
        const a = ang + (k * Math.PI * 2) / 3;
        ctx.fillStyle = "#A0B5D0";
        ctx.fillRect(cx + Math.cos(a) * 8 - 1.5, cy + Math.sin(a) * 8 - 1.5, 3, 3);
      }
      ctx.fillStyle = "#A0B5D0";
      ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    }
  }

  private drawRadar(ctx: CanvasRenderingContext2D, now: number): void {
    const cx = 448;
    const cy = 116;
    ctx.strokeStyle = "#708AA8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 15, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy + 12);
    ctx.stroke();
    const sweep = this.reducedMotion ? 2.4 : (now / 900) % (Math.PI * 2);
    ctx.strokeStyle = this.sector.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweep) * 14, cy - Math.abs(Math.sin(sweep)) * 10 - 2);
    ctx.stroke();
  }

  private drawLightShafts(ctx: CanvasRenderingContext2D): void {
    // Soft volumetric shaft: a translucent linear gradient wash.
    const grad = ctx.createLinearGradient(196, 30, 220, 210);
    grad.addColorStop(0, "rgba(255,255,255,0.20)");
    grad.addColorStop(1, "rgba(255,255,255,0.02)");
    ctx.save();
    ctx.fillStyle = grad;
    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    ctx.moveTo(196, 30);
    ctx.lineTo(238, 30);
    ctx.lineTo(268, 210);
    ctx.lineTo(168, 210);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawCore(ctx: CanvasRenderingContext2D, now: number): void {
    const x = 168;
    const y = 34;
    const w = 144;
    const h = 168;
    // containment frame
    ctx.fillStyle = "#0B0E14";
    ctx.fillRect(x - 5, y - 5, w + 10, h + 10);
    ctx.strokeStyle = this.sector.mid;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 3.5, y - 3.5, w + 7, h + 7);
    const pulse = this.reducedMotion
      ? 0.6
      : 0.5 + 0.22 * Math.sin(now / 620);
    const grad = ctx.createRadialGradient(240, 118, 8, 240, 118, 96);
    grad.addColorStop(0, this.sector.glow);
    grad.addColorStop(1, "#05070C");
    ctx.globalAlpha = pulse + 0.35;
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;

    if (this.revealedDom != null) {
      drawGlyph(ctx, this.revealedDom, 240 - 48, 118 - 48, 6, this.sector.accent);
    } else {
      // sealed silhouette: hooded archivist-shaped unknown
      ctx.fillStyle = "#05070C";
      ctx.beginPath();
      ctx.arc(240, 92, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(216, 106, 48, 62);
      ctx.beginPath();
      ctx.moveTo(216, 168);
      ctx.lineTo(264, 168);
      ctx.lineTo(252, 118);
      ctx.lineTo(228, 118);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = this.sector.accent;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.65 + 0.3 * Math.sin(now / 300);
      ctx.beginPath();
      ctx.arc(240, 92, 17, Math.PI * 1.15, Math.PI * 1.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // question mark
      ctx.fillStyle = this.sector.accent;
      ctx.font = "600 26px 'Space Grotesk', Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(now / 450);
      ctx.fillText("?", 240, 152);
      ctx.globalAlpha = 1;
    }
    // core label plate
    ctx.fillStyle = "#0B0E14";
    ctx.fillRect(x + 22, y + h - 18, w - 44, 12);
    ctx.fillStyle = this.sector.accent;
    ctx.font = "600 7px 'Space Grotesk', Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      this.revealedDom != null ? "ENTITY LOCKED" : "ENTITY SEALED",
      240,
      y + h - 9
    );
  }

  private drawReticle(ctx: CanvasRenderingContext2D, now: number): void {
    const breathe = this.reducedMotion ? 0 : Math.sin(now / 500) * 1.5;
    const x0 = 158 - breathe;
    const y0 = 24 - breathe;
    const x1 = 322 + breathe;
    const y1 = 212 + breathe;
    ctx.strokeStyle = this.sector.accent;
    ctx.lineWidth = 2;
    const L = 14;
    const corners: Array<[number, number, number, number]> = [
      [x0, y0, 1, 1],
      [x1, y0, -1, 1],
      [x0, y1, 1, -1],
      [x1, y1, -1, -1],
    ];
    for (const [cx, cy, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx + dx * L, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy * L);
      ctx.stroke();
    }
  }

  private updateParticles(ctx: CanvasRenderingContext2D): void {
    if (!this.particles.length) return;
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.02;
      p.life -= 1;
      ctx.globalAlpha = Math.min(1, p.life / 30);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/** Oscilloscope carrier wave (Layer 2 console furniture). */
export function drawScope(
  canvas: HTMLCanvasElement,
  level: number,
  now: number,
  accent: string
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "#05070C";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#24324D";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const amp = 4 + level * (h / 2 - 6);
  const freq = 0.02 + level * 0.05;
  for (let x = 0; x < w; x++) {
    const y =
      h / 2 +
      Math.sin(x * freq + now / 130) * amp * Math.sin(x / w * Math.PI);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}
