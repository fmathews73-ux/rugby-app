/**
 * Real 3D flag ball. Sphere geometry with the national flag mapped as an
 * equirectangular texture, gentle idle rotation, ambient + directional light.
 *
 * Cost: one WebGL context per instance — DO NOT put this in a scrollable
 * list. Use `TeamFlagBall2D` there. This component is designed for hero
 * placements (team detail page, splash animations).
 */

import { Canvas, useFrame } from '@react-three/fiber/native';
import { Suspense, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import * as THREE from 'three';

interface FlagBallProps {
  texture: THREE.Texture;
}

function FlagBall({ texture }: FlagBallProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.35; // slow idle spin
    }
  });
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 96, 96]} />
      <meshStandardMaterial
        map={texture}
        metalness={0.15}
        roughness={0.35}
      />
    </mesh>
  );
}

export function TeamFlagBall3D({
  flagCode,
  size = 220,
}: {
  flagCode: string;
  size?: number;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    // Use TextureLoader manually — react-native fetch → data URI → Texture
    // avoids the file:// asset assumptions in the standard loader.
    let cancelled = false;
    const url = `https://flagcdn.com/w640/${flagCode}.png`;
    (async () => {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const reader = new FileReader();
        const dataUri = await new Promise<string>((resolve, reject) => {
          reader.onerror = () => reject(reader.error);
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        if (cancelled) return;
        const loader = new THREE.TextureLoader();
        loader.load(dataUri, (tex) => {
          if (cancelled) return;
          tex.colorSpace = THREE.SRGBColorSpace;
          setTexture(tex);
        });
      } catch {
        if (!cancelled) setErrored(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [flagCode]);

  if (errored) {
    // Silent fallback to a bare grey sphere would still be a WebGL context, so
    // just render an empty box the caller can style.
    return <View style={[styles.container, { width: size, height: size }]} />;
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {texture ? (
        <Canvas
          camera={{ position: [0, 0, 2.6], fov: 45 }}
          gl={{ antialias: true }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}>
          <ambientLight intensity={0.65} />
          <directionalLight position={[3, 3, 4]} intensity={1.3} />
          <directionalLight position={[-3, -1, 2]} intensity={0.35} color={0xa0c4ff} />
          <Suspense fallback={null}>
            <FlagBall texture={texture} />
          </Suspense>
        </Canvas>
      ) : (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
