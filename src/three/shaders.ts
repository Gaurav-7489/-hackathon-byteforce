/** Original procedural shaders for the SeatLock venue. */

const hsl = /* glsl */ `
vec3 hsl2rgb(vec3 c) {
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
}`

export const ledWall = {
  vertex: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragment: /* glsl */ `
    uniform float uTime;
    uniform float uHue;
    uniform float uIntensity;
    varying vec2 vUv;
    ${hsl}
    void main() {
      float bars = 56.0;
      float id = floor(vUv.x * bars);
      float fx = fract(vUv.x * bars);
      float h = 0.28 + 0.32 * (0.5 + 0.5 * sin(uTime * 1.6 + id * 0.55)) * (0.6 + 0.4 * sin(uTime * 0.7 + id * 0.21));
      h += 0.18 * exp(-pow((vUv.x - 0.5) * 3.2, 2.0));
      float bar = step(vUv.y, h) * step(0.14, fx) * step(fx, 0.86);
      float pix = step(0.18, fract(vUv.y * 34.0));
      vec3 base = hsl2rgb(vec3(uHue + vUv.x * 0.12 - vUv.y * 0.05, 0.85, 0.58));
      vec3 hot = mix(base, vec3(1.0), smoothstep(h - 0.08, h, vUv.y) * bar * 0.6);
      float glow = 0.10 + 0.08 * (1.0 - vUv.y);
      vec3 col = base * glow + hot * bar * pix * 1.25;
      float edge = smoothstep(0.0, 0.03, vUv.x) * smoothstep(1.0, 0.97, vUv.x) * smoothstep(0.0, 0.04, vUv.y) * smoothstep(1.0, 0.94, vUv.y);
      gl_FragColor = vec4(col * uIntensity * edge, 1.0);
    }`,
}

export const beam = {
  vertex: /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormalV;
    varying vec3 vViewDir;
    void main() {
      vUv = uv;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vNormalV = normalize(normalMatrix * normal);
      vViewDir = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragment: /* glsl */ `
    uniform vec3 uColor;
    uniform float uOpacity;
    varying vec2 vUv;
    varying vec3 vNormalV;
    varying vec3 vViewDir;
    void main() {
      float facing = abs(dot(normalize(vNormalV), normalize(vViewDir)));
      float core = pow(facing, 2.2);
      float along = pow(vUv.y, 1.6);
      float a = core * along * uOpacity;
      gl_FragColor = vec4(uColor * a, a);
    }`,
}

export const haze = {
  vertex: /* glsl */ `
    attribute float aSeed;
    uniform float uTime;
    uniform float uSize;
    uniform float uPixelRatio;
    varying float vAlpha;
    void main() {
      vec3 p = position;
      p.y = mod(p.y + uTime * (0.08 + aSeed * 0.18), 11.0);
      p.x += sin(uTime * 0.21 + aSeed * 6.2831) * 0.45;
      p.z += cos(uTime * 0.17 + aSeed * 4.0) * 0.35;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = uSize * uPixelRatio * (0.6 + aSeed) * (12.0 / max(-mv.z, 0.1));
      vAlpha = smoothstep(0.0, 1.5, p.y) * smoothstep(11.0, 8.0, p.y) * (0.35 + 0.65 * aSeed);
      gl_Position = projectionMatrix * mv;
    }`,
  fragment: /* glsl */ `
    uniform vec3 uColor;
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d) * vAlpha * 0.55;
      gl_FragColor = vec4(uColor * a, a);
    }`,
}
