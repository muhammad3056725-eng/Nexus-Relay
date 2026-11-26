/**
 * NEXUS RELAY — collectible holographic Relic Cards.
 * 64x64 cards composited from three layers:
 *   1. Domain Base Silhouette (12 thematic glyphs)
 *   2. Metallic Rarity Frame (Bronze, Cobalt, Emerald, Amethyst,
 *      Solar Gold, Glitch-Prism — mapped from the run's rank tier)
 *   3. Holographic Fragment Shader: diagonal specular foil shimmer,
 *      theta = atan2(y, x) driven by the pointer (or gyroscope).
 */
import { drawGlyph } from "../graphics/Glyphs";
import { sectorForDomain } from "../graphics/PaletteManager";
import {
  compileProgram,
  fullscreenQuad,
  FULLSCREEN_VERTEX,
  HOLO_FRAGMENT,
} from "../graphics/Shaders";

/** Ascending rank tier -> relic rarity frame (Blueprint §3). */
export const RELIC_FRAMES: Record<string, { name: string; color: string }> = {
  "Static Listener": { name: "Bronze", color: "#B8760B" },
  "Frequency Scout": { name: "Cobalt", color: "#4F678F" },
  "Relay Technician": { name: "Emerald", color: "#12B87F" },
  "Signal Cryptographer": { name: "Amethyst", color: "#8B5CF6" },
  "Deep-Band Oracle": { name: "Solar Gold", color: "#FFB627" },
  "Quantum Archivist": { name: "Glitch-Prism", color: "#FF2A85" },
};

export class RelicCard {
  private canvas: HTMLCanvasElement;
  private base: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private pointer = { x: 0.4, y: 0.4 };
  private glitch = false;
  frameName = "Bronze";

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.base = document.createElement("canvas");
    this.base.width = 64;
    this.base.height = 64;
    const gl = canvas.getContext("webgl2", { antialias: false });
    if (gl) {
      const prog = compileProgram(gl, FULLSCREEN_VERTEX, HOLO_FRAGMENT);
      if (prog) {
        this.gl = gl;
        this.program = prog;
        this.vao = fullscreenQuad(gl);
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
    }
    canvas.addEventListener("pointermove", (ev) => {
      const rect = canvas.getBoundingClientRect();
      this.pointer = {
        x: ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        y: -(((ev.clientY - rect.top) / rect.height) * 2 - 1),
      };
    });
  }

  get shaderActive(): boolean {
    return this.gl !== null;
  }

  /** Composite the three layers for an unlocked target. */
  draw(dom: number, rankTitle: string): void {
    const frame = RELIC_FRAMES[rankTitle] ?? RELIC_FRAMES["Static Listener"];
    this.frameName = frame.name;
    this.glitch = frame.name === "Glitch-Prism";
    const ctx = this.base.getContext("2d");
    if (!ctx) return;
    const sector = sectorForDomain(dom);
    // layer 1: domain base + silhouette
    ctx.fillStyle = "#0B0E14";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = sector.mid;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(4, 4, 56, 56);
    ctx.globalAlpha = 1;
    drawGlyph(ctx, dom, 8, 6, 3, sector.accent);
    // layer 2: metallic rarity frame
    if (this.glitch) {
      const stripe = ["#FF2A85", "#FFB627", "#2CF6B3", "#8B5CF6"];
      for (let i = 0; i < 64; i += 4) {
        ctx.fillStyle = stripe[(i / 4) % 4];
        ctx.fillRect(i, 0, 4, 3);
        ctx.fillRect(i, 61, 4, 3);
        ctx.fillRect(0, i, 3, 4);
        ctx.fillRect(61, i, 3, 4);
      }
    } else {
      ctx.strokeStyle = frame.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, 61, 61);
      ctx.fillStyle = frame.color;
      for (const [cx, cy] of [[5, 5], [56, 5], [5, 56], [56, 56]] as const) {
        ctx.fillRect(cx, cy, 3, 3);
      }
    }
    if (!this.gl) {
      const c2d = this.canvas.getContext("2d");
      if (c2d) {
        c2d.imageSmoothingEnabled = true;
        c2d.clearRect(0, 0, 64, 64);
        c2d.drawImage(this.base, 0, 0);
      }
    }
  }

  /** Layer 3: holographic foil pass (call from the render loop). */
  render(now: number): void {
    if (!this.gl || !this.program || !this.texture) return;
    const gl = this.gl;
    gl.viewport(0, 0, 64, 64);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.base);
    gl.useProgram(this.program);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_card"), 0);
    gl.uniform1f(gl.getUniformLocation(this.program, "u_time"), now / 1000);
    gl.uniform2f(
      gl.getUniformLocation(this.program, "u_pointer"),
      this.pointer.x,
      this.pointer.y
    );
    gl.uniform1f(
      gl.getUniformLocation(this.program, "u_glitch"),
      this.glitch ? 1 : 0
    );
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }
}
