import * as THREE from 'three';

const params = new URLSearchParams(window.location.search);
const flag = (name: string): boolean | null => {
  const v = params.get(name);
  if (v === null) return null;
  return !['0', 'off', 'false', 'no'].includes(v.toLowerCase());
};

/**
 * Rendering switches for diagnosing device-specific issues from a phone.
 * Debug overrides via URL: ?fx=0 (no post-processing), ?msaa=0|1, ?hdr=0|1, ?glow=0 (no star halo)
 *
 * (The iPhone green specks in the star glow were not caused by post-processing (?fx=0 still
 * showed them); most likely the canvas-gradient glow textures - see utils/glowTexture.ts.)
 */
export const GLOW_ENABLED = flag('glow') ?? true;

export const EFFECTS = {
  enabled: flag('fx') ?? true,
  multisampling: (flag('msaa') ?? true) ? 4 : 0,
  frameBufferType: (flag('hdr') ?? true) ? THREE.HalfFloatType : THREE.UnsignedByteType,
};
