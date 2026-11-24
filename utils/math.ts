import { Vector3, Euler } from 'three';
import { TREE_CONFIG, SPIRAL_CONFIG } from '../constants';

/**
 * Calculates a point on the conical spiral.
 * @param t Normalized progress (0 to 1) from bottom to top
 */
export const getSpiralPoint = (t: number) => {
  const y = t * TREE_CONFIG.HEIGHT - (TREE_CONFIG.HEIGHT / 2);
  
  // Radius decreases as we go up (Conical)
  const progressInverted = 1 - t;
  const currentRadius = (TREE_CONFIG.RADIUS_BOTTOM * progressInverted) + SPIRAL_CONFIG.RADIUS_OFFSET;
  
  const angle = t * SPIRAL_CONFIG.LOOPS * Math.PI * 2;
  
  const x = Math.cos(angle) * currentRadius;
  const z = Math.sin(angle) * currentRadius;
  
  return new Vector3(x, y, z);
};

type TreeSpot = { position: [number, number, number]; rotation: [number, number, number]; t: number };
type Sample = { t: number; x: number; y: number; z: number; len: number };

// Photos spaced at least this far apart (world units) along the spiral
const MIN_PHOTO_SPACING = 1.7;
// "Front" = within ±60° of the camera's initial direction (+z)
const FRONT_COS = 0.5;

let spiralSegments: { front: Sample[][]; back: Sample[][] } | null = null;

/** Samples the spiral once and splits it into front arcs (one per loop) and the back path. */
const getSpiralSegments = () => {
  if (spiralSegments) return spiralSegments;
  const front: Sample[][] = [];
  const back: Sample[][] = [];
  let current: Sample[] | null = null;
  let currentBack: Sample[] | null = null;
  let prev: { x: number; y: number; z: number } | null = null;
  const STEPS = 4000;
  for (let i = 0; i <= STEPS; i++) {
    const t = 0.08 + (0.84 * i) / STEPS;
    const p = getSpiralPoint(t);
    const r = Math.hypot(p.x, p.z);
    const step = prev ? Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z) : 0;
    prev = { x: p.x, y: p.y, z: p.z };
    if (p.z / r >= FRONT_COS) {
      currentBack = null;
      if (!current) {
        current = [];
        front.push(current);
      }
      const last = current[current.length - 1];
      current.push({ t, x: p.x, y: p.y, z: p.z, len: last ? last.len + step : 0 });
    } else {
      current = null;
      if (!currentBack) {
        currentBack = [];
        back.push(currentBack);
      }
      const last = currentBack[currentBack.length - 1];
      currentBack.push({ t, x: p.x, y: p.y, z: p.z, len: last ? last.len + step : 0 });
    }
  }
  spiralSegments = { front: front.filter(a => a.length > 1), back: back.filter(a => a.length > 1) };
  return spiralSegments;
};

const pathLength = (path: Sample[]) => path[path.length - 1].len;

/** Places m points evenly along a sampled path (half a gap at each end). */
const placeAlong = (path: Sample[], m: number): Sample[] => {
  const total = pathLength(path);
  const out: Sample[] = [];
  let j = 0;
  for (let k = 0; k < m; k++) {
    const target = ((k + 0.5) / m) * total;
    while (j < path.length - 1 && path[j].len < target) j++;
    out.push(path[j]);
  }
  return out;
};

const toSpot = (s: Sample): TreeSpot => ({
  position: [s.x, s.y, s.z],
  rotation: [0, Math.atan2(s.x, s.z), 0],
  t: s.t,
});

/**
 * Positions for `count` photos, designed to look good from the default camera:
 * up to ~16 photos all go on the front of the tree (spread across the loops, more on the
 * wider lower loops); any extra photos are spread evenly around the back.
 * Returned in display order: front spots top to bottom, then back spots top to bottom.
 */
export const generateTreeLayout = (count: number): TreeSpot[] => {
  if (count <= 0) return [];
  const { front, back } = getSpiralSegments();
  const lengths = front.map(pathLength);
  const caps = lengths.map(len => Math.max(1, Math.floor(len / MIN_PHOTO_SPACING)));
  const frontCapacity = caps.reduce((a, b) => a + b, 0);
  const frontCount = Math.min(count, frontCapacity);

  // How many photos per front arc
  const perArc = front.map(() => 0);
  if (frontCount < front.length) {
    // Fewer photos than loops: use loops spread from bottom to top
    for (let k = 0; k < frontCount; k++) {
      const idx = Math.min(front.length - 1, Math.round(((k + 0.5) * front.length) / frontCount - 0.5));
      perArc[idx]++;
    }
  } else {
    // Proportional to arc length (largest remainder), respecting each arc's capacity
    const totalLen = lengths.reduce((a, b) => a + b, 0);
    const exact = lengths.map(len => (frontCount * len) / totalLen);
    exact.forEach((e, i) => (perArc[i] = Math.min(caps[i], Math.max(1, Math.floor(e)))));
    let left = frontCount - perArc.reduce((a, b) => a + b, 0);
    const order = exact.map((e, i) => ({ i, rem: e - Math.floor(e) })).sort((a, b) => b.rem - a.rem);
    while (left > 0) {
      let placed = false;
      for (const { i } of order) {
        if (left > 0 && perArc[i] < caps[i]) {
          perArc[i]++;
          left--;
          placed = true;
        }
      }
      if (!placed) break;
    }
    while (left < 0) {
      // Too many after the "at least 1" rule: trim the fullest arcs
      const i = perArc.indexOf(Math.max(...perArc));
      perArc[i]--;
      left++;
    }
  }

  // Order: front spots first (top to bottom), then back spots - so the first photos face the camera
  const byHeight = (a: TreeSpot, b: TreeSpot) => b.position[1] - a.position[1];
  const spots: TreeSpot[] = [];
  front.forEach((arc, i) => placeAlong(arc, perArc[i]).forEach(s => spots.push(toSpot(s))));
  spots.sort(byHeight);
  const backSpots: TreeSpot[] = [];
  if (count > frontCount) {
    // Extra photos around the back, per segment so they keep clear of the front ones
    const extra = count - frontCount;
    const backLens = back.map(pathLength);
    const backTotal = backLens.reduce((a, b) => a + b, 0);
    const exact = backLens.map(len => (extra * len) / backTotal);
    const perBack = exact.map(Math.floor);
    let left = extra - perBack.reduce((a, b) => a + b, 0);
    exact
      .map((e, i) => ({ i, rem: e - Math.floor(e) }))
      .sort((a, b) => b.rem - a.rem)
      .forEach(({ i }) => {
        if (left > 0) {
          perBack[i]++;
          left--;
        }
      });
    back.forEach((seg, i) => placeAlong(seg, perBack[i]).forEach(s => backSpots.push(toSpot(s))));
  }
  spots.push(...backSpots.sort(byHeight));
  return spots;
};

const textureCache: Record<string, string> = {};

export const generatePlaceholderTexture = (type: 'snowflake' | 'bell' | 'tree', bgColor: string, iconColor: string): string => {
    const cacheKey = `${type}-${bgColor}-${iconColor}`;
    if (textureCache[cacheKey]) return textureCache[cacheKey];

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';



    // Festive Background Colors (Dark Red / Dark Green / Dark Blue)

    let colorStart = '#083f1eff'; // Green-900
    let colorEnd = '#01170aff';   // Green-950

    if (type === 'bell') {
        // Dark Green for Bell
        colorStart = '#320707ff'; // Red-950
        colorEnd = '#250404';   // Near Black Red
    } 
    if (type === 'snowflake') {
        // Dark Blue for Snowflake
        colorStart = '#1e293b'; // Slate-800
        colorEnd = '#0f172a';   // Slate-900
    } 
    // 1. Festive Background with Radial Gradient
    const gradient = ctx.createRadialGradient(256, 256, 50, 256, 256, 400);
    gradient.addColorStop(0, colorStart);
    gradient.addColorStop(1, colorEnd);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    // 2. Simple Gold/White Border
    ctx.strokeStyle = '#ffffff'; 
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, 472, 472);
    
    // 3. Prepare for Icon Drawing
    ctx.translate(256, 256);
    
    // Glow effect for the white shape
    ctx.shadowColor = 'rgba(255,255,255,0.6)';
    ctx.shadowBlur = 30;
    
    if (type === 'snowflake') {
        // --- SNOWFLAKE ICON (WHITE) ---
        // Redesigned to be more crystalline and less web-like
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        for (let i = 0; i < 6; i++) {
            ctx.save();
            ctx.rotate((Math.PI / 3) * i);
            
            // Main Spine
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -135);
            ctx.stroke();

            // Inner Branches (Smaller)
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.moveTo(0, -50);
            ctx.lineTo(-35, -85);
            ctx.moveTo(0, -50);
            ctx.lineTo(35, -85);
            ctx.stroke();

            // Outer Branches (Larger)
            ctx.beginPath();
            ctx.moveTo(0, -95);
            ctx.lineTo(-30, -125);
            ctx.moveTo(0, -95);
            ctx.lineTo(30, -125);
            ctx.stroke();
            
            ctx.restore();
        }
        
        // Center Detail
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();

    } else if (type === 'bell') {
        // --- BELL ICON (WHITE) ---
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(0, -100);
        ctx.bezierCurveTo(90, -100, 90, 80, 130, 130);
        ctx.lineTo(-130, 130);
        ctx.bezierCurveTo(-90, 80, -90, -100, 0, -100);
        ctx.fill();

        // Clapper
        ctx.fillStyle = '#E2E8F0'; // Light gray for slight contrast
        ctx.beginPath();
        ctx.arc(0, 130, 30, 0, Math.PI, false); 
        ctx.fill();

        // Ribbon
        ctx.fillStyle = '#FFFFFF'; 
        // Center knot (unchanged)
        ctx.beginPath();
        ctx.arc(0, -110, 15, 0, Math.PI * 2);
        ctx.fill();

    } else if (type === 'tree') {
        // --- CHRISTMAS TREE ICON (WHITE) ---
        ctx.fillStyle = '#FFFFFF'; 

        // Trunk
        ctx.fillRect(-30, 120, 60, 60);

        // Leaves
        const drawTier = (yOffset: number, width: number, height: number) => {
            ctx.beginPath();
            ctx.moveTo(0, yOffset - height);
            ctx.lineTo(width, yOffset);
            ctx.lineTo(-width, yOffset);
            ctx.closePath();
            ctx.fill();
        };

        drawTier(130, 110, 100);
        drawTier(60, 90, 90);
        drawTier(-10, 70, 80);

        // Star
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        const spikes = 5;
        const outerRadius = 25;
        const innerRadius = 10;
        let rot = Math.PI / 2 * 3;
        let x = 0;
        let y = -90; 
        const step = Math.PI / spikes;

        ctx.moveTo(0, y - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = 0 + Math.cos(rot) * outerRadius;
            y = -100 + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = 0 + Math.cos(rot) * innerRadius;
            y = -100 + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(0, -100 - outerRadius);
        ctx.closePath();
        ctx.fill();
    }

    const dataUrl = canvas.toDataURL('image/png');
    textureCache[cacheKey] = dataUrl;
    return dataUrl;
};