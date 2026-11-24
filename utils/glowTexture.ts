import * as THREE from 'three';

type Stop = [offset: number, rgba: [number, number, number, number]];

/**
 * Soft radial glow texture for additively blended sprites, computed pixel by pixel.
 *
 * Why not a canvas gradient: canvases store colours pre-multiplied by alpha in 8 bits, so the
 * colour of nearly transparent pixels has to be reconstructed by dividing by a tiny alpha.
 * That is noisy everywhere (even desktop Chrome gives G = 128..153 for neighbouring pixels in
 * the faint ring) and much worse on iOS Safari, which dithers gradients - visible as
 * green/teal specks inside the star's glow on iPhone.
 *
 * Here the same data (straight colour + alpha, exactly what the canvas texture held) is
 * computed analytically, so it renders identically but without the noise.
 */
export const makeRadialGlowTexture = (size: number, stops: Stop[]): THREE.DataTexture => {
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  const sample = (d: number) => {
    if (d <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      const [o1, c1] = stops[i];
      const [o0, c0] = stops[i - 1];
      if (d <= o1) {
        const t = (d - o0) / (o1 - o0 || 1);
        return c0.map((v, k) => v + (c1[k] - v) * t) as [number, number, number, number];
      }
    }
    return stops[stops.length - 1][1];
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.min(1, Math.hypot(x - c, y - c) / (size / 2));
      const [r, g, b, a] = sample(d);
      const i = (y * size + x) * 4;
      data[i] = Math.round(r);
      data[i + 1] = Math.round(g);
      data[i + 2] = Math.round(b);
      data[i + 3] = Math.round(a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
};
