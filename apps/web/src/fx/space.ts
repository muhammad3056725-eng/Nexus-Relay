/**
 * NEXUS RELAY — "signal space": the full-screen animated background.
 *
 * WebGL2 path (preferred):
 *   1. one full-screen fragment pass — deep-space gradient, two soft
 *      drifting nebulae, a holographic radar (rings + sweep) and the
 *      expanding "transmission" shock-wave when a clue arrives;
 *   2. a glowing particle network — soft additive point sprites plus
 *      distance-faded links between nearby nodes. Additive blending of
 *      gaussian sprites gives the bloom look without a post pass.
 * Canvas2D fallback when WebGL2 is unavailable (same simulation).
 *
 * Performance: devicePixelRatio capped at 2; ~30 fps when idle and
 * 60 fps only while a pulse animates; the loop stops while the tab is
 * hidden; quality steps down automatically on slow frames; with
 * reduced motion nothing drifts and frames are drawn only on change.
 */

export type PulseColor = "cyan" | "magenta" | "green" | "amber";

const COLORS: Record<PulseColor, [number, number, number]> = {
  cyan: [0.2, 0.85, 1.0],
  magenta: [1.0, 0.3, 0.8],
  green: [0.3, 1.0, 0.6],
  amber: [1.0, 0.75, 0.25],
};

const LEVELS = [
  { scale: 1, nodes: 110 },
  { scale: 0.75, nodes: 80 },
  { scale: 0.55, nodes: 50 },
];

interface Node {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  ph: number;
  hue: number; // 0 = cyan, 1 = magenta
}

const BG_FRAG = `#version 300 es
precision mediump float;
out vec4 o;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_focus;
uniform float u_pulse;
uniform vec3 u_pc;
uniform float u_motion;
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = (gl_FragCoord.xy - u_focus * u_res) / u_res.y;
  float r = length(p);
  vec3 col = mix(vec3(0.012, 0.016, 0.055), vec3(0.035, 0.05, 0.14), uv.y);
  float t = u_time * u_motion;
  vec2 n1 = uv - vec2(0.18 + 0.04 * sin(t * 0.07), 0.78 + 0.03 * cos(t * 0.05));
  vec2 n2 = uv - vec2(0.86 + 0.03 * cos(t * 0.06), 0.24 + 0.04 * sin(t * 0.045));
  n1.x *= u_res.x / u_res.y; n2.x *= u_res.x / u_res.y;
  col += vec3(0.0, 0.42, 0.55) * 0.22 * exp(-dot(n1, n1) * 3.0);
  col += vec3(0.55, 0.08, 0.5) * 0.2 * exp(-dot(n2, n2) * 3.2);
  // holographic radar rings around the focus
  float q = r * 6.0;
  float d = abs(q - floor(q + 0.5)) / 6.0;
  float ring = (1.0 - smoothstep(0.0, 0.0035, d)) * smoothstep(1.05, 0.15, r) * 0.13;
  col += vec3(0.25, 0.8, 1.0) * ring;
  // sweep
  float a = atan(p.y, p.x);
  float s = mod(t * 0.55, 6.28318);
  float diff = mod(s - a + 6.28318, 6.28318);
  col += vec3(0.2, 0.75, 1.0) * exp(-diff * 2.6) * smoothstep(0.0, 0.18, diff) * smoothstep(0.95, 0.05, r) * 0.09;
  // transmission shock-wave
  float pr = u_pulse;
  if (pr < 1.0) {
    float wave = exp(-pow((r - pr * 1.25) * 16.0, 2.0)) * (1.0 - pr);
    col += u_pc * wave * 0.55;
    col += u_pc * (1.0 - pr) * 0.22 * exp(-r * 3.5);
  }
  col += u_pc * 0.05 * exp(-r * 2.2);
  // vignette
  vec2 v = uv - 0.5;
  col *= 1.0 - dot(v, v) * 0.9;
  o = vec4(col, 1.0);
}`;

const FULL_VERT = `#version 300 es
layout(location=0) in vec2 a;
void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

const PT_VERT = `#version 300 es
layout(location=0) in vec2 a_pos;
layout(location=1) in float a_size;
layout(location=2) in vec4 a_col;
out vec4 v_col;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); gl_PointSize = a_size; v_col = a_col; }`;

const PT_FRAG = `#version 300 es
precision mediump float;
in vec4 v_col;
out vec4 o;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d2 = dot(c, c);
  float a = exp(-d2 * 22.0) + 0.6 * exp(-d2 * 160.0);
  o = vec4(v_col.rgb * a * v_col.a, 1.0);
}`;

const LN_VERT = `#version 300 es
layout(location=0) in vec2 a_pos;
layout(location=1) in vec4 a_col;
out vec4 v_col;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); v_col = a_col; }`;

const LN_FRAG = `#version 300 es
precision mediump float;
in vec4 v_col;
out vec4 o;
void main(){ o = vec4(v_col.rgb * v_col.a, 1.0); }`;

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram | null {
  const mk = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const v = mk(gl.VERTEX_SHADER, vs);
  const f = mk(gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const p = gl.createProgram()!;
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
  return p;
}

export class SignalSpace {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private bg: { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null>; vao: WebGLVertexArrayObject } | null = null;
  private pts: { p: WebGLProgram; vao: WebGLVertexArrayObject; buf: WebGLBuffer } | null = null;
  private lns: { p: WebGLProgram; vao: WebGLVertexArrayObject; buf: WebGLBuffer } | null = null;
  private nodes: Node[] = [];
  private level = 0;
  private qualitySetting: "auto" | "high" | "low" = "auto";
  private reduced = false;
  private raf = 0;
  private lastDraw = 0;
  private start = performance.now();
  private pulseAt = -1e9;
  private pulseColor: [number, number, number] = COLORS.cyan;
  private baseColor: [number, number, number] = COLORS.cyan;
  private focus: [number, number] = [0.5, 0.62];
  private pointer: [number, number] = [0, 0];
  private frameTimes: number[] = [];
  private w = 1;
  private h = 1;
  private dpr = 1;
  private lineData = new Float32Array(0);
  private ptData = new Float32Array(0);
  readonly mode: "webgl" | "2d" | "none";

  constructor(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean; quality: "auto" | "high" | "low" }) {
    this.canvas = canvas;
    this.reduced = opts.reducedMotion;
    this.qualitySetting = opts.quality;
    this.level = opts.quality === "low" ? 2 : 0;
    const isJsdom = typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);
    let mode: "webgl" | "2d" | "none" = "none";
    if (!isJsdom) {
      try {
        const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "low-power" });
        if (gl && this.initGL(gl)) {
          this.gl = gl;
          mode = "webgl";
        }
      } catch {
        /* fall through */
      }
      if (mode === "none") {
        const c2 = canvas.getContext("2d");
        if (c2) {
          this.ctx2d = c2;
          mode = "2d";
          this.level = Math.max(this.level, 1);
        }
      }
    }
    this.mode = mode;
    this.seed();
    if (mode === "none") return;
    this.resize();
    window.addEventListener("resize", () => {
      this.resize();
      this.request();
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.request();
    });
    window.addEventListener(
      "pointermove",
      (e) => {
        this.pointer = [e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5];
      },
      { passive: true }
    );
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    });
    this.request();
  }

  private initGL(gl: WebGL2RenderingContext): boolean {
    const bgP = compile(gl, FULL_VERT, BG_FRAG);
    const ptP = compile(gl, PT_VERT, PT_FRAG);
    const lnP = compile(gl, LN_VERT, LN_FRAG);
    if (!bgP || !ptP || !lnP) return false;
    const tri = gl.createVertexArray()!;
    gl.bindVertexArray(tri);
    const tb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const u: Record<string, WebGLUniformLocation | null> = {};
    for (const n of ["u_res", "u_time", "u_focus", "u_pulse", "u_pc", "u_motion"]) u[n] = gl.getUniformLocation(bgP, n);
    this.bg = { p: bgP, u, vao: tri };

    const ptVao = gl.createVertexArray()!;
    gl.bindVertexArray(ptVao);
    const ptBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, ptBuf);
    // x, y, size, r, g, b, a  (7 floats)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 28, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 28, 12);
    this.pts = { p: ptP, vao: ptVao, buf: ptBuf };

    const lnVao = gl.createVertexArray()!;
    gl.bindVertexArray(lnVao);
    const lnBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, lnBuf);
    // x, y, r, g, b, a  (6 floats)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 8);
    this.lns = { p: lnP, vao: lnVao, buf: lnBuf };
    gl.bindVertexArray(null);
    return true;
  }

  private seed(): void {
    const n = LEVELS[this.level].nodes;
    this.nodes = [];
    for (let i = 0; i < n; i++) {
      this.nodes.push({
        x: Math.random() * 2.4 - 1.2,
        y: Math.random() * 2.4 - 1.2,
        z: 0.25 + Math.random() * 0.75,
        vx: (Math.random() - 0.5) * 0.02,
        vy: (Math.random() - 0.5) * 0.02,
        ph: Math.random() * Math.PI * 2,
        hue: Math.random() < 0.22 ? 1 : 0,
      });
    }
  }

  private resize(): void {
    const scale = LEVELS[this.level].scale;
    this.dpr = Math.min(2, window.devicePixelRatio || 1) * scale;
    this.w = Math.max(1, Math.floor(window.innerWidth * this.dpr));
    this.h = Math.max(1, Math.floor(window.innerHeight * this.dpr));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
  }

  setReducedMotion(on: boolean): void {
    this.reduced = on;
    this.request();
  }

  setQuality(q: "auto" | "high" | "low"): void {
    this.qualitySetting = q;
    const lvl = q === "low" ? 2 : q === "high" ? 0 : this.level;
    if (lvl !== this.level) {
      this.level = lvl;
      this.seed();
      this.resize();
    }
    this.frameTimes = [];
    this.request();
  }

  /** Radar centre in viewport fractions (0..1, y from top). */
  setFocus(x: number, y: number): void {
    this.focus = [x, 1 - y];
    this.request();
  }

  /** Base tint of the scene (follows the round's mood). */
  setTint(c: PulseColor): void {
    this.baseColor = COLORS[c];
    this.request();
  }

  /** A transmission pulse (new clue, right/wrong answer). */
  pulse(c: PulseColor = "cyan"): void {
    this.pulseColor = COLORS[c];
    this.pulseAt = performance.now();
    this.request();
  }

  private pulseProgress(now: number): number {
    return Math.min(1, (now - this.pulseAt) / 1400);
  }

  private request(): void {
    if (this.mode === "none" || this.raf || document.hidden) return;
    this.raf = requestAnimationFrame(this.loop);
  }

  private loop = (now: number): void => {
    this.raf = 0;
    if (document.hidden) return;
    const pulsing = this.pulseProgress(now) < 1;
    const interval = pulsing ? 0 : 32;
    if (now - this.lastDraw >= interval - 1) {
      const dt = this.lastDraw ? Math.min(0.05, (now - this.lastDraw) / 1000) : 0.016;
      if (this.lastDraw && !this.reduced) this.trackPerf(now - this.lastDraw, pulsing);
      this.lastDraw = now;
      this.step(this.reduced ? 0 : dt);
      this.draw(now);
    }
    // Keep animating while motion is allowed or a pulse is running;
    // under reduced motion a static frame is drawn only on change.
    if (!this.reduced || pulsing) this.raf = requestAnimationFrame(this.loop);
  };

  private trackPerf(frameMs: number, pulsing: boolean): void {
    if (this.qualitySetting !== "auto") return;
    const budget = pulsing ? 17 : 33;
    this.frameTimes.push(frameMs / budget);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    if (avg > 1.6 && this.level < LEVELS.length - 1) {
      this.level += 1;
      this.seed();
      this.resize();
    }
  }

  private step(dt: number): void {
    for (const n of this.nodes) {
      n.x += n.vx * dt * 3;
      n.y += n.vy * dt * 3;
      n.ph += dt * 1.3;
      if (n.x < -1.3) n.x += 2.6;
      if (n.x > 1.3) n.x -= 2.6;
      if (n.y < -1.3) n.y += 2.6;
      if (n.y > 1.3) n.y -= 2.6;
    }
  }

  /** Project nodes to NDC with a little pointer parallax. */
  private project(i: number): [number, number] {
    const n = this.nodes[i];
    const par = this.reduced ? 0 : 0.06 * n.z;
    return [n.x - this.pointer[0] * par, n.y + this.pointer[1] * par];
  }

  private draw(now: number): void {
    const t = (now - this.start) / 1000;
    const pr = this.pulseProgress(now);
    const boost = pr < 1 ? (1 - pr) : 0;
    if (this.gl) this.drawGL(t, pr, boost);
    else if (this.ctx2d) this.draw2D(pr, boost);
  }

  private buildGeometry(boost: number): { pts: number; lines: number } {
    const n = this.nodes.length;
    const aspect = this.w / this.h;
    const proj: Array<[number, number]> = [];
    for (let i = 0; i < n; i++) proj.push(this.project(i));
    const need = n * 7;
    if (this.ptData.length < need) this.ptData = new Float32Array(need);
    const pc = this.pulseColor;
    const bc = this.baseColor;
    for (let i = 0; i < n; i++) {
      const nd = this.nodes[i];
      const tw = 0.65 + 0.35 * Math.sin(nd.ph);
      const base = nd.hue ? COLORS.magenta : bc;
      const o = i * 7;
      this.ptData[o] = proj[i][0];
      this.ptData[o + 1] = proj[i][1];
      this.ptData[o + 2] = (5 + 9 * nd.z) * this.dpr * (1 + boost * 0.6);
      this.ptData[o + 3] = base[0] + (pc[0] - base[0]) * boost;
      this.ptData[o + 4] = base[1] + (pc[1] - base[1]) * boost;
      this.ptData[o + 5] = base[2] + (pc[2] - base[2]) * boost;
      this.ptData[o + 6] = (0.35 + 0.55 * nd.z) * tw * (1 + boost);
    }
    const th = 0.36;
    const lines: number[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = (proj[i][0] - proj[j][0]) * aspect;
        const dy = proj[i][1] - proj[j][1];
        const d2 = dx * dx + dy * dy;
        if (d2 < th * th) {
          const a = (1 - Math.sqrt(d2) / th) * 0.28 * Math.min(this.nodes[i].z, this.nodes[j].z) * (1 + boost * 1.5);
          const c = this.nodes[i].hue && this.nodes[j].hue ? COLORS.magenta : bc;
          lines.push(proj[i][0], proj[i][1], c[0], c[1], c[2], a, proj[j][0], proj[j][1], c[0], c[1], c[2], a);
        }
      }
    }
    if (this.lineData.length < lines.length) this.lineData = new Float32Array(lines.length * 1.5);
    this.lineData.set(lines);
    return { pts: n, lines: lines.length / 6 };
  }

  private drawGL(t: number, pr: number, boost: number): void {
    const gl = this.gl!;
    gl.viewport(0, 0, this.w, this.h);
    gl.disable(gl.BLEND);
    const bg = this.bg!;
    gl.useProgram(bg.p);
    gl.uniform2f(bg.u.u_res, this.w, this.h);
    gl.uniform1f(bg.u.u_time, t);
    gl.uniform2f(bg.u.u_focus, this.focus[0], this.focus[1]);
    gl.uniform1f(bg.u.u_pulse, pr);
    const c = pr < 1 ? this.pulseColor : this.baseColor;
    gl.uniform3f(bg.u.u_pc, c[0], c[1], c[2]);
    gl.uniform1f(bg.u.u_motion, this.reduced ? 0 : 1);
    gl.bindVertexArray(bg.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const geo = this.buildGeometry(boost);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    if (geo.lines) {
      gl.useProgram(this.lns!.p);
      gl.bindVertexArray(this.lns!.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lns!.buf);
      gl.bufferData(gl.ARRAY_BUFFER, this.lineData.subarray(0, geo.lines * 6), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.LINES, 0, geo.lines);
    }
    gl.useProgram(this.pts!.p);
    gl.bindVertexArray(this.pts!.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pts!.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.ptData.subarray(0, geo.pts * 7), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.POINTS, 0, geo.pts);
    gl.bindVertexArray(null);
  }

  private draw2D(pr: number, boost: number): void {
    const ctx = this.ctx2d!;
    const { w, h } = this;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#090d24");
    g.addColorStop(1, "#03040e");
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const fx = this.focus[0] * w;
    const fy = (1 - this.focus[1]) * h;
    ctx.strokeStyle = "rgba(80,200,255,0.10)";
    ctx.lineWidth = this.dpr;
    for (let k = 1; k <= 5; k++) {
      ctx.beginPath();
      ctx.arc(fx, fy, (k * h) / 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (pr < 1) {
      const c = this.pulseColor.map((v) => Math.round(v * 255));
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(1 - pr) * 0.6})`;
      ctx.lineWidth = 3 * this.dpr;
      ctx.beginPath();
      ctx.arc(fx, fy, pr * h * 1.25, 0, Math.PI * 2);
      ctx.stroke();
    }
    const geo = this.buildGeometry(boost);
    ctx.globalCompositeOperation = "lighter";
    const toX = (x: number) => ((x + 1) / 2) * w;
    const toY = (y: number) => ((1 - y) / 2) * h;
    for (let i = 0; i < geo.lines; i += 2) {
      const o = i * 6;
      const d = this.lineData;
      ctx.strokeStyle = `rgba(${d[o + 2] * 255},${d[o + 3] * 255},${d[o + 4] * 255},${d[o + 5]})`;
      ctx.lineWidth = this.dpr;
      ctx.beginPath();
      ctx.moveTo(toX(d[o]), toY(d[o + 1]));
      ctx.lineTo(toX(d[o + 6]), toY(d[o + 7]));
      ctx.stroke();
    }
    for (let i = 0; i < geo.pts; i++) {
      const o = i * 7;
      const p = this.ptData;
      ctx.fillStyle = `rgba(${p[o + 3] * 255},${p[o + 4] * 255},${p[o + 5] * 255},${Math.min(1, p[o + 6])})`;
      ctx.beginPath();
      ctx.arc(toX(p[o]), toY(p[o + 1]), p[o + 2] * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }
}
