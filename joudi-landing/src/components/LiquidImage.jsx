import { useEffect, useRef } from "react";
import { finePointer, reducedMotion, webgl } from "../lib/device";

// صورة بتأثير تشويه سائل (WebGL) عند مرور الماوس
const VS = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p * 0.5 + 0.5; vUv.y = 1.0 - vUv.y; gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `precision highp float;
uniform sampler2D uTex; uniform vec2 uMouse; uniform float uHover; uniform float uTime; uniform vec2 uRes; uniform vec2 uImg;
varying vec2 vUv;
vec3 perm(vec3 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy)); vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod(i, 289.0);
  vec3 p = perm(perm(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
vec2 cover(vec2 uv){
  float rs = uRes.x / uRes.y, ri = uImg.x / uImg.y;
  vec2 s = rs < ri ? vec2(rs / ri, 1.0) : vec2(1.0, ri / rs);
  return (uv - 0.5) * s + 0.5;
}
void main(){
  vec2 uv = vUv;
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  float d = distance(uv * asp, uMouse * asp);
  float m = smoothstep(0.65, 0.0, d) * uHover;
  float n1 = snoise(uv * 3.2 + uTime * 0.22);
  float n2 = snoise(uv * 3.2 + 11.0 - uTime * 0.18);
  vec2 off = vec2(n1, n2) * 0.045 * m + (uv - uMouse) * -0.05 * m;
  uv = (uv - 0.5) * (1.0 - 0.07 * uHover) + 0.5;
  float r = texture2D(uTex, cover(uv + off * 1.25)).r;
  float g = texture2D(uTex, cover(uv + off)).g;
  float b = texture2D(uTex, cover(uv + off * 0.75)).b;
  vec3 col = vec3(r, g, b);
  col += vec3(0.9, 0.75, 0.5) * m * 0.06; // لمعة دافئة
  gl_FragColor = vec4(col, 1.0);
}`;

export default function LiquidImage({ src, alt, className = "" }) {
  const wrap = useRef(null);
  const img = useRef(null);
  const canvas = useRef(null);
  const enabled = webgl && finePointer && !reducedMotion;

  useEffect(() => {
    if (!enabled) return;
    let gl, prog, raf, tex, started = false, alive = true;
    const st = { hover: 0, target: 0, mx: 0.5, my: 0.5, tmx: 0.5, tmy: 0.5, t: 0, running: false };
    const U = {};

    const init = () => {
      if (started) return !!gl;
      started = true;
      const c = canvas.current;
      gl = c.getContext("webgl", { premultipliedAlpha: false, antialias: false });
      if (!gl) return false;
      const sh = (type, s) => {
        const o = gl.createShader(type);
        gl.shaderSource(o, s);
        gl.compileShader(o);
        return o;
      };
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ["uTex", "uMouse", "uHover", "uTime", "uRes", "uImg"].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));
      tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img.current);
      return true;
    };

    const resize = () => {
      const c = canvas.current;
      const r = wrap.current.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio, 1.5);
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      gl.viewport(0, 0, c.width, c.height);
    };

    const frame = () => {
      if (!alive) return;
      st.hover += (st.target - st.hover) * 0.06;
      st.mx += (st.tmx - st.mx) * 0.1;
      st.my += (st.tmy - st.my) * 0.1;
      st.t += 0.016;
      gl.uniform1i(U.uTex, 0);
      gl.uniform2f(U.uMouse, st.mx, st.my);
      gl.uniform1f(U.uHover, st.hover);
      gl.uniform1f(U.uTime, st.t);
      gl.uniform2f(U.uRes, canvas.current.width, canvas.current.height);
      gl.uniform2f(U.uImg, img.current.naturalWidth, img.current.naturalHeight);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (st.target === 0 && st.hover < 0.003) {
        st.running = false;
        canvas.current.style.opacity = 0;
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    const enter = (e) => {
      if (!img.current.complete || !init()) return;
      resize();
      move(e);
      st.mx = st.tmx;
      st.my = st.tmy;
      st.target = 1;
      canvas.current.style.opacity = 1;
      if (!st.running) {
        st.running = true;
        frame();
      }
    };
    const move = (e) => {
      const r = wrap.current.getBoundingClientRect();
      st.tmx = (e.clientX - r.left) / r.width;
      st.tmy = (e.clientY - r.top) / r.height;
    };
    const leave = () => (st.target = 0);
    const el = wrap.current;
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <div ref={wrap} className={`group relative overflow-hidden ${className}`} data-cursor="view">
      <img
        ref={img}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        crossOrigin="anonymous"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1600ms] ease-lux group-hover:scale-[1.07]"
      />
      {enabled && <canvas ref={canvas} className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-300" aria-hidden="true" />}
    </div>
  );
}
