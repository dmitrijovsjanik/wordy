import { useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface MagicTextRevealProps {
  text: string;
  revealed: boolean;
  onRevealed?: () => void;
  className?: string;
  fontSize?: string;
  fontFamily?: string;
}

// --- WebGL2 Spoiler (Telegram Web K shaders + Transform Feedback) ---

const VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 inPosition;
layout(location = 1) in vec2 inVelocity;
layout(location = 2) in float inTime;
layout(location = 3) in float inDuration;

out vec2 outPosition;
out vec2 outVelocity;
out float outTime;
out float outDuration;
out float alpha;

uniform float reset;
uniform float time;
uniform float deltaTime;
uniform vec2 size;
uniform float r;
uniform float seed;
uniform float noiseScale;
uniform float noiseSpeed;
uniform float noiseMovement;
uniform float dampingMult;
uniform float forceMult;
uniform float velocityMult;
uniform float longevity;
uniform float maxVelocity;
uniform float bleed;

float rand(vec2 n) {
  return fract(sin(dot(n, vec2(12.9898, 4.1414 - seed * .42))) * 43758.5453);
}
vec4 loop4(vec4 p) {
  p.xy = fract(p.xy / noiseScale) * noiseScale;
  p.zw = fract(p.zw / noiseScale) * noiseScale;
  return p;
}
vec3 loop3(vec3 p) {
  p.xy = fract(p.xy / noiseScale) * noiseScale;
  return p;
}
float mod289f(float x) { return x - floor(x * (1. / (289. + seed))) * (289. + seed); }
vec4 mod289v(vec4 x) { return x - floor(x * (1. / (289. + seed))) * (289. + seed); }
vec4 perm(vec4 x) { return mod289v(((x * 34.) + 1.) * x); }
float noise(vec3 p) {
  vec3 a = floor(p);
  vec3 d = p - a;
  d = d * d * (3. - 2. * d);
  vec4 b = a.xxyy + vec4(0., 1., 0., 1.);
  vec4 k1 = perm(loop4(b.xyxy));
  vec4 k2 = perm(loop4(k1.xyxy + b.zzww));
  vec4 c = k2 + a.zzzz;
  vec4 k3 = perm(c);
  vec4 k4 = perm(c + 1.0);
  vec4 o3 = fract(k4 / 41.0) * d.z + fract(k3 / 41.0) * (1.0 - d.z);
  vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);
  return o4.y * d.y + o4.x * (1.0 - d.y);
}
vec3 grad(vec3 p) {
  const vec2 e = vec2(.1, .0);
  return vec3(
    noise(loop3(p + e.xyy)) - noise(loop3(p - e.xyy)),
    noise(loop3(p + e.yxy)) - noise(loop3(p - e.yxy)),
    noise(loop3(p + e.yyx)) - noise(loop3(p - e.yyx))
  ) / (2.0 * e.x);
}
vec3 curlNoise(vec3 p) {
  p.xy /= size;
  p.x *= (size.x / size.y);
  p.xy = fract(p.xy);
  p.xy *= noiseScale;
  const vec2 e = vec2(.01, .0);
  return grad(loop3(p)).yzx - vec3(
    grad(loop3(p + e.yxy)).z,
    grad(loop3(p + e.yyx)).x,
    grad(loop3(p + e.xyy)).y
  );
}

void main() {
  vec2 position = inPosition;
  vec2 velocity = inVelocity;
  float particleDuration = inDuration;
  float particleTime = inTime + deltaTime * particleDuration / longevity;

  if (reset > 0.) {
    particleTime = rand(vec2(-94.3, 83.9) * vec2(gl_VertexID, gl_VertexID));
    particleDuration = .5 + 2. * rand(vec2(gl_VertexID) + seed * 32.4);
    position = size * vec2(
      rand(vec2(42., -3.) * vec2(cos(float(gl_VertexID) - seed), gl_VertexID)),
      rand(vec2(-3., 42.) * vec2(time * time, sin(float(gl_VertexID) + seed)))
    );
    velocity = vec2(0.);
  } else if (particleTime >= 1.) {
    particleTime = 0.0;
    particleDuration = .5 + 2. * rand(vec2(gl_VertexID) + position);
    velocity = vec2(0.);
  }

  float msz = min(size.x, size.y);
  vec2 force = normalize(curlNoise(
    vec3(position + time * (noiseMovement / 100. * msz), time * noiseSpeed + rand(position) * 2.5)
  ).xy);

  velocity += force * forceMult * deltaTime * msz * .1;
  velocity *= dampingMult;
  float vlen = length(velocity);
  float maxVelocityPx = maxVelocity / 100. * msz;
  if (vlen > maxVelocityPx) {
    velocity = velocity / vlen * maxVelocityPx;
  }

  position += velocity * velocityMult * deltaTime;
  position = fract(position / size) * size;

  outPosition = position;
  outVelocity = velocity;
  outTime = particleTime;
  outDuration = particleDuration;

  // Edge fade: particles shrink and fade near canvas edges (within bleed zone)
  float bpx = bleed;
  float edgeX = min(position.x, size.x - position.x);
  float edgeY = min(position.y, size.y - position.y);
  float edgeDist = min(edgeX, edgeY);
  float edgeFade = smoothstep(0.0, bpx, edgeDist);

  gl_PointSize = r * edgeFade;
  gl_Position = vec4((position / size * 2.0 - vec2(1.0)), 0.0, 1.0);

  alpha = sin(particleTime * 3.14) * (.6 + .4 * rand(vec2(gl_VertexID))) * edgeFade;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in float alpha;
out vec4 fragColor;
uniform vec3 color;

void main() {
  vec2 c = 2.0 * gl_PointCoord - 1.0;
  if (dot(c, c) > 1.0) discard;
  fragColor = vec4(color, alpha);
}`;

// Telegram's text spoiler config
const CFG = {
  noiseScale: 6,
  noiseSpeed: 5,
  forceMult: 0.2,
  velocityMult: 0.4,
  dampingMult: 2.2,
  maxVelocity: 10,
  longevity: 5.0,
  noiseMovement: 4,
  timeScale: 1.2,
};

function getParticleCount(w: number, h: number): number {
  const base = (w * h) / (500 * 500) * 1000 * 5;
  return Math.min(Math.max(Math.round(base * 4), 500), 10000);
}

const BLEED = 24;

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`Shader: ${log}`);
  }
  return s;
}

export function MagicTextReveal({ text, revealed, onRevealed, className, fontSize, fontFamily }: MagicTextRevealProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;
  const onRevealedRef = useRef(onRevealed);
  onRevealedRef.current = onRevealed;

  const dpr = useMemo(
    () => (typeof window !== 'undefined' ? window.devicePixelRatio : 1),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, alpha: true });
    if (!gl) return;

    // Compile & link
    let vs: WebGLShader, fs: WebGLShader, program: WebGLProgram;
    try {
      vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
      fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    } catch (e) {
      console.warn('Spoiler shader compile failed:', e);
      return;
    }

    program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.transformFeedbackVaryings(program, ['outPosition', 'outVelocity', 'outTime', 'outDuration'], gl.INTERLEAVED_ATTRIBS);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('Spoiler program link failed:', gl.getProgramInfoLog(program));
      return;
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    // Uniforms
    const u = (name: string) => gl.getUniformLocation(program, name)!;
    const loc = {
      time: u('time'), deltaTime: u('deltaTime'), size: u('size'), reset: u('reset'),
      r: u('r'), seed: u('seed'), noiseScale: u('noiseScale'), noiseSpeed: u('noiseSpeed'),
      noiseMovement: u('noiseMovement'), dampingMult: u('dampingMult'), forceMult: u('forceMult'),
      velocityMult: u('velocityMult'), longevity: u('longevity'), maxVelocity: u('maxVelocity'),
      color: u('color'), bleed: u('bleed'),
    };

    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const seed = Math.random() * 10;
    const radius = dpr * 2.7;
    const buffers = [gl.createBuffer()!, gl.createBuffer()!];
    let bufferIndex = 0;
    let particleCount = 0;
    let time = 0;
    let lastDrawTime = Date.now();
    let needsReset = true;
    let fadeOpacity = 1;
    let animId = 0;

    const setupBuffers = (count: number) => {
      particleCount = count;
      for (let i = 0; i < 2; i++) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers[i]);
        gl.bufferData(gl.ARRAY_BUFFER, count * 6 * 4, gl.DYNAMIC_DRAW);
      }
    };

    const bindAttribs = () => {
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 8);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 24, 16);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 24, 20);
      gl.enableVertexAttribArray(3);
    };

    // Size canvas to match text element (not the outer button)
    const resize = () => {
      const textEl = textRef.current;
      if (!textEl) return;
      const rect = textEl.getBoundingClientRect();
      const w = rect.width + BLEED * 2;
      const h = rect.height + BLEED * 2;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      setupBuffers(getParticleCount(w, h));
      needsReset = true;
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (textRef.current) ro.observe(textRef.current);

    // Draw one frame
    const draw = () => {
      const now = Date.now();
      const dt = Math.min((now - lastDrawTime) / 1000, 1) * CFG.timeScale;
      lastDrawTime = now;
      time += dt;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);

      gl.uniform1f(loc.reset, needsReset ? 1 : 0);
      if (needsReset) { time = 0; needsReset = false; }

      gl.uniform1f(loc.time, time);
      gl.uniform1f(loc.deltaTime, dt);
      gl.uniform2f(loc.size, canvas.width, canvas.height);
      gl.uniform1f(loc.seed, seed);
      gl.uniform1f(loc.r, radius);
      gl.uniform1f(loc.noiseScale, CFG.noiseScale);
      gl.uniform1f(loc.noiseSpeed, CFG.noiseSpeed);
      gl.uniform1f(loc.noiseMovement, CFG.noiseMovement);
      gl.uniform1f(loc.dampingMult, CFG.dampingMult);
      gl.uniform1f(loc.forceMult, CFG.forceMult);
      gl.uniform1f(loc.velocityMult, CFG.velocityMult);
      gl.uniform1f(loc.longevity, CFG.longevity);
      gl.uniform1f(loc.maxVelocity, CFG.maxVelocity);
      gl.uniform3f(loc.color, 0.6, 0.6, 0.6);
      gl.uniform1f(loc.bleed, BLEED * dpr);

      gl.bindBuffer(gl.ARRAY_BUFFER, buffers[bufferIndex]);
      bindAttribs();
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, buffers[1 - bufferIndex]);

      gl.beginTransformFeedback(gl.POINTS);
      gl.drawArrays(gl.POINTS, 0, particleCount);
      gl.endTransformFeedback();

      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
      bufferIndex = 1 - bufferIndex;
    };

    // Animation loop — always running, checks revealedRef each frame
    const frame = () => {
      if (revealedRef.current) {
        // Instant hide — no gradual fade
        if (fadeOpacity > 0) {
          fadeOpacity = 0;
          canvas.style.opacity = '0';
          onRevealedRef.current?.();
          onRevealedRef.current = undefined;
        }
        animId = requestAnimationFrame(frame);
        return;
      } else {
        if (fadeOpacity < 1) {
          // Was hidden, now showing again — reset
          fadeOpacity = 1;
          canvas.style.opacity = '1';
          needsReset = true;
          lastDrawTime = Date.now();
        }
      }

      draw();
      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      gl.deleteBuffer(buffers[0]);
      gl.deleteBuffer(buffers[1]);
      gl.deleteProgram(program);
    };
  }, [dpr]);

  return (
    <div className={cn('relative inline-block', className)}>
      {/* Invisible text — purely for canvas sizing */}
      <span
        ref={textRef}
        aria-hidden
        className="invisible select-none text-center font-bold"
        style={{ fontSize, fontFamily }}
      >
        {text}
      </span>

      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute left-1/2 top-1/2 z-[2] -translate-x-1/2 -translate-y-1/2"
      />
    </div>
  );
}
