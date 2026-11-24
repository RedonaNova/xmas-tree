import * as THREE from 'three';

// iPhone / iPad (iPadOS reports itself as a Mac, but has touch)
export const IS_APPLE_MOBILE =
  /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

const params = new URLSearchParams(window.location.search);
const flag = (name: string): boolean | null => {
  const v = params.get(name);
  if (v === null) return null;
  return !['0', 'off', 'false', 'no'].includes(v.toLowerCase());
};

/**
 * Post-processing settings.
 *
 * Apple mobile GPUs show green/teal speckles in bright, additively blended areas (the star's
 * glow) when the effect pass renders into multisampled half-float buffers. On iPhone/iPad we
 * therefore render effects without MSAA and with 8-bit buffers.
 *
 * Debug overrides via URL: ?fx=0 (no post-processing), ?msaa=0|1, ?hdr=0|1
 */
export const EFFECTS = {
  enabled: flag('fx') ?? true,
  multisampling: (flag('msaa') ?? !IS_APPLE_MOBILE) ? 4 : 0,
  frameBufferType: (flag('hdr') ?? !IS_APPLE_MOBILE) ? THREE.HalfFloatType : THREE.UnsignedByteType,
};
