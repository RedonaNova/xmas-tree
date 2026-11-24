import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS, TREE_CONFIG } from '../constants';
import { makeRadialGlowTexture } from '../utils/glowTexture';
import { GLOW_ENABLED } from '../utils/renderQuality';

// Computed pixel by pixel (not a canvas gradient) - see utils/glowTexture.ts for why
const GlowTexture = () =>
  makeRadialGlowTexture(256, [
    [0, [255, 255, 200, 1]],
    [0.4, [255, 220, 100, 0.3]],
    [0.7, [255, 200, 0, 0.05]],
    [1, [0, 0, 0, 0]],
  ]);

interface StarProps {
  isExploded?: boolean;
}

const Star: React.FC<StarProps> = ({ isExploded = false }) => {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.PointLight>(null);
  const explodeProgress = useRef(0);
  const glowTexture = useMemo(() => GlowTexture(), []);

  // Classic 5-Pointed Star Shape
  const starGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const spikes = 5;
    const outerRadius = 1.5;
    const innerRadius = 0.6;

    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      // Point up: start at PI/2
      const a = (i / (spikes * 2)) * Math.PI * 2 + Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    const extrudeSettings = {
      depth: 0.4,
      bevelEnabled: true,
      bevelThickness: 0.2,
      bevelSize: 0.1,
      bevelSegments: 3
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.center();
    return geo;
  }, []);

  useFrame((state) => {
    const targetProgress = isExploded ? 1 : 0;
    const lerpFactor = isExploded ? 0.05 : 0.12; // Faster return
    explodeProgress.current = THREE.MathUtils.lerp(explodeProgress.current, targetProgress, lerpFactor);

    if (groupRef.current) {
      const time = state.clock.elapsedTime;

      // Gentle floating motion + Explode offset
      const baseY = (TREE_CONFIG.HEIGHT / 2) + 0.8;
      groupRef.current.position.y = baseY + Math.sin(time * 1.5) * 0.1 + explodeProgress.current * 20;

      // Slow rotation + Explode spin
      groupRef.current.rotation.y = time * (0.5 + explodeProgress.current * 5);
      groupRef.current.rotation.z = Math.sin(time * 0.5) * 0.1;

      // Pulsing scale
      const pulse = 1 + Math.sin(time * 3) * 0.05;
      groupRef.current.scale.set(pulse, pulse, pulse);

      // Pulse the light intensity
      if (glowRef.current) {
        glowRef.current.intensity = (3 + Math.sin(time * 3) * 1) * (1 - explodeProgress.current * 0.8);
      }
    }
  });

  const startY = (TREE_CONFIG.HEIGHT / 2) + 0.8;

  return (
    <group ref={groupRef} position={[0, startY, 0]}>

      {/* GLOW HALO */}
      {GLOW_ENABLED && <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
        <mesh scale={[16, 16, 1]}>
          <planeGeometry />
          <meshBasicMaterial map={glowTexture} transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      </Billboard>}

      {/* The 3D Star Mesh */}
      <mesh geometry={starGeometry}>
        <meshStandardMaterial
          color={COLORS.STAR}
          emissive={COLORS.STAR_GLOW}
          emissiveIntensity={1.0}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>

      {/* Extra Sparkles for magical feel */}
      <Sparkles count={20} scale={4} size={3} speed={0.4} opacity={0.8} color="#fff" material-toneMapped={false} />

      {/* Light Source inside the star - No shadows for performance */}
      <pointLight
        ref={glowRef}
        color={COLORS.STAR_GLOW}
        distance={30}
        decay={2}
        castShadow={false}
      />
    </group>
  );
};

export default Star;
