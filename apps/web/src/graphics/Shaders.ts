/**
 * NEXUS RELAY — GLSL shaders (Blueprint §3).
 * The CRT fragment shader below is the blueprint's own implementation,
 * verbatim. The holographic foil shader implements the blueprint's
 * Relic Card spec: a diagonal specular foil shimmer whose angle
 * theta = atan2(y, x) responds to the pointer position.
 */

export const FULLSCREEN_VERTEX = `#version 300 es
precision mediump float;
layout(location = 0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

/** Blueprint §3 — CRT Fragment Shader Implementation (verbatim). */
export const CRT_FRAGMENT = `#version 300 es
precision mediump float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_sceneBuffer;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_crtCurvature;   // Default: 0.08
uniform float u_scanlineIntensity; // Default: 0.15
uniform float u_chromaticAberration; // Default: 0.002
vec2 curveUV(vec2 uv) {
    uv = uv * 2.0 - 1.0;
    vec2 offset = abs(uv.yx) * u_crtCurvature;
    uv = uv + uv * offset * offset;
    uv = uv * 0.5 + 0.5;
    return uv;
}
void main() {
    vec2 uv = curveUV(v_uv);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    // Chromatic Aberration
    float r = texture(u_sceneBuffer, uv + vec2(u_chromaticAberration, 0.0)).r;
    float g = texture(u_sceneBuffer, uv).g;
    float b = texture(u_sceneBuffer, uv - vec2(u_chromaticAberration, 0.0)).b;
    // Scanlines & Phosphor Grid
    float scanline = sin(uv.y * u_resolution.y * 3.14159) * u_scanlineIntensity;
    vec3 color = vec3(r, g, b) - scanline;
    fragColor = vec4(color, 1.0);
}
`;

/**
 * Holographic Fragment Shader for 64x64 Relic Cards (Blueprint §3):
 * diagonal specular foil shimmer across the card face; the shimmer
 * angle follows theta = atan2(y, x) of the pointer relative to the
 * card centre (or device gyroscope, fed through the same uniform).
 */
export const HOLO_FRAGMENT = `#version 300 es
precision mediump float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_card;
uniform float u_time;
uniform vec2 u_pointer;   // -1..1, pointer offset from card centre
uniform float u_glitch;   // 1.0 for the Glitch-Prism frame, else 0.0
void main() {
    vec2 uv = v_uv;
    if (u_glitch > 0.5) {
        float slice = floor(uv.y * 16.0);
        float shift = sin(slice * 37.0 + floor(u_time * 3.0) * 11.0) * 0.012;
        uv.x = fract(uv.x + shift);
    }
    vec4 base = texture(u_card, uv);
    float theta = atan(u_pointer.y, u_pointer.x);
    float diag = (uv.x - uv.y) * 3.0;
    float band = pow(0.5 + 0.5 * sin(diag * 4.0 + theta * 2.0 - u_time * 1.5), 6.0);
    vec3 foil = mix(vec3(0.4, 1.0, 0.85), vec3(1.0, 0.65, 0.9),
                    0.5 + 0.5 * sin(theta + uv.x * 3.14159));
    vec3 color = base.rgb + foil * band * 0.45 * base.a;
    fragColor = vec4(color, base.a);
}
`;

export function compileProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string
): WebGLProgram | null {
  const compile = (type: number, src: string): WebGLShader | null => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn("shader compile failed:", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  };
  const vs = compile(gl.VERTEX_SHADER, vsSource);
  const fs = compile(gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn("program link failed:", gl.getProgramInfoLog(prog));
    return null;
  }
  return prog;
}

/** Create a fullscreen-quad VAO for the post-processing passes. */
export function fullscreenQuad(gl: WebGL2RenderingContext): WebGLVertexArrayObject | null {
  const vao = gl.createVertexArray();
  if (!vao) return null;
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return vao;
}
