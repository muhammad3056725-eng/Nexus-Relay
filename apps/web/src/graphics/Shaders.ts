/**
 * NEXUS RELAY — GLSL shaders.
 * Clean modern post pass: a soft signal-glow / bloom composite with
 * no distortion effects — the scene is rendered
 * crisply and only its brightest signal accents bloom. The holographic
 * foil shader implements the Relic Card spec: a diagonal specular
 * shimmer whose angle theta = atan2(y, x) responds to the pointer.
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

/**
 * Clean display pass with a subtle modern glow.
 * Uniforms: u_glow (0 = clean passthrough, higher = stronger bloom
 * lift on bright signal accents), fed by the display-glow setting
 * (off / subtle / full).
 */
export const GLOW_FRAGMENT = `#version 300 es
precision mediump float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_sceneBuffer;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_glow;
void main() {
    vec3 base = texture(u_sceneBuffer, v_uv).rgb;
    if (u_glow <= 0.001) {
        fragColor = vec4(base, 1.0);
        return;
    }
    vec2 px = 1.0 / u_resolution;
    vec3 blur = vec3(0.0);
    blur += texture(u_sceneBuffer, v_uv + px * vec2( 2.0,  0.0)).rgb;
    blur += texture(u_sceneBuffer, v_uv + px * vec2(-2.0,  0.0)).rgb;
    blur += texture(u_sceneBuffer, v_uv + px * vec2( 0.0,  2.0)).rgb;
    blur += texture(u_sceneBuffer, v_uv + px * vec2( 0.0, -2.0)).rgb;
    blur += texture(u_sceneBuffer, v_uv + px * vec2( 3.0,  3.0)).rgb;
    blur += texture(u_sceneBuffer, v_uv + px * vec2(-3.0,  3.0)).rgb;
    blur += texture(u_sceneBuffer, v_uv + px * vec2( 3.0, -3.0)).rgb;
    blur += texture(u_sceneBuffer, v_uv + px * vec2(-3.0, -3.0)).rgb;
    blur /= 8.0;
    float bright = smoothstep(0.45, 1.0, max(blur.r, max(blur.g, blur.b)));
    vec3 color = base + blur * bright * u_glow;
    fragColor = vec4(color, 1.0);
}
`;

/**
 * Holographic Fragment Shader for Relic Cards:
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
