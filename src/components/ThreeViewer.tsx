'use client';

import React, { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  Environment,
  ContactShadows,
  Bounds,
  useBounds,
  Html,
  Center,
} from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

// ─── Loading spinner shown inside the 3D canvas ──────────────────────────────
function CanvasLoader() {
  return (
    <Html center>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        color: '#06b6d4',
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          border: '3px solid rgba(6, 182, 212, 0.2)',
          borderTopColor: '#06b6d4',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em' }}>
          Loading mesh…
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </Html>
  );
}

// ─── Auto-rotate controller: rotates slowly, pauses on interaction ───────────
function AutoRotate({ speed = 0.3 }: { speed?: number }) {
  const { gl } = useThree();
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInteracting = useRef(false);
  const rotationRef = useRef(0);

  useEffect(() => {
    const onStart = () => {
      isInteracting.current = true;
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
    const onEnd = () => {
      idleTimer.current = setTimeout(() => {
        isInteracting.current = false;
      }, 3000);
    };

    const canvas = gl.domElement;
    canvas.addEventListener('pointerdown', onStart);
    canvas.addEventListener('pointerup', onEnd);
    canvas.addEventListener('wheel', onStart);
    canvas.addEventListener('wheel', onEnd);

    return () => {
      canvas.removeEventListener('pointerdown', onStart);
      canvas.removeEventListener('pointerup', onEnd);
      canvas.removeEventListener('wheel', onStart);
      canvas.removeEventListener('wheel', onEnd);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [gl]);

  useFrame((state, delta) => {
    if (!isInteracting.current) {
      rotationRef.current += delta * speed;
      state.scene.rotation.y = rotationRef.current;
    } else {
      // Sync rotation to current scene rotation so it doesn't jump back
      rotationRef.current = state.scene.rotation.y;
    }
  });

  return null;
}

// ─── Bounds auto-fit trigger ─────────────────────────────────────────────────
function BoundsFit({ children }: { children: React.ReactNode }) {
  const bounds = useBounds();

  useEffect(() => {
    // Small delay to ensure all geometries are parsed before fitting
    const timer = setTimeout(() => {
      bounds.refresh().fit();
    }, 100);
    return () => clearTimeout(timer);
  }, [children, bounds]);

  return <>{children}</>;
}

// ─── Inner component: loads a local File into a mesh ──────────────────────────
interface LocalMeshProps {
  file: File;
  color: string;
  visible?: boolean;
}

const LocalSTLMesh: React.FC<LocalMeshProps> = ({
  file,
  color,
  visible = true,
}) => {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    if (!file) { setGeometry(null); return; }

    const loader = new STLLoader();
    const reader = new FileReader();

    reader.onload = (event) => {
      if (event.target?.result) {
        const arrayBuffer = event.target.result as ArrayBuffer;
        const geom = loader.parse(arrayBuffer);
        geom.computeVertexNormals();
        geom.computeBoundingBox();
        setGeometry(geom);
      }
    };

    reader.readAsArrayBuffer(file);
  }, [file]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} visible={visible} castShadow receiveShadow>
      <meshStandardMaterial
        color={color}
        roughness={0.7}
        metalness={0.05}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

// ─── Inner component: loads a URL-based STL into a mesh ───────────────────────
interface UrlMeshProps {
  url: string;
  color: string;
  emissive?: string;
  roughness?: number;
  metalness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  opacity?: number;
  transparent?: boolean;
  transmission?: number;
  visible: boolean;
}

const UrlSTLMesh: React.FC<UrlMeshProps> = ({
  url,
  color,
  emissive = '#000000',
  roughness = 0.35,
  metalness = 0.1,
  clearcoat = 0.3,
  clearcoatRoughness = 0.2,
  opacity = 1,
  transparent = false,
  transmission = 0,
  visible,
}) => {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    if (!url) { setGeometry(null); return; }

    const loader = new STLLoader();
    loader.load(
      url,
      (geom) => {
        geom.computeVertexNormals();
        geom.computeBoundingBox();
        setGeometry(geom);
      },
      undefined,
      (error) => {
        console.error(`Failed to load STL from ${url}:`, error);
      }
    );
  }, [url]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} visible={visible} castShadow receiveShadow>
      <meshPhysicalMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={transparent ? 0.02 : 0.05}
        roughness={roughness}
        metalness={metalness}
        clearcoat={clearcoat}
        clearcoatRoughness={clearcoatRoughness}
        side={THREE.DoubleSide}
        transparent={transparent}
        opacity={opacity}
        transmission={transmission}
        depthWrite={!transparent}
        envMapIntensity={transparent ? 0.3 : 0.6}
      />
    </mesh>
  );
};

// ─── Main ThreeViewer component ───────────────────────────────────────────────
interface ThreeViewerProps {
  previewFiles?: {
    mesh1?: File;
    mesh2?: File;
  };
  previewVisibility?: {
    mesh1: boolean;
    mesh2: boolean;
  };
  meshUrls?: {
    inputMaxilla?: string | null;
    inputMandible?: string | null;
    outputMaxilla?: string | null;
    outputMandible?: string | null;
  };
  visibility?: {
    inputMaxilla: boolean;
    inputMandible: boolean;
    outputMaxilla: boolean;
    outputMandible: boolean;
  };
  onLoadingStateChange?: (loading: boolean, progress: number, activeMesh: string) => void;
}

export default function ThreeViewer({
  previewFiles,
  previewVisibility = {
    mesh1: true,
    mesh2: true,
  },
  meshUrls,
  visibility = {
    inputMaxilla: true,
    inputMandible: true,
    outputMaxilla: true,
    outputMandible: true,
  },
}: ThreeViewerProps) {
  const isPreview = !!(previewFiles?.mesh1 || previewFiles?.mesh2);
  const isViewer = !!(meshUrls?.inputMaxilla || meshUrls?.inputMandible || meshUrls?.outputMaxilla || meshUrls?.outputMandible);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '300px' }}>
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{ position: [0, 40, 180], fov: 40 }}
        style={{ background: '#080c14' }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      >
        {/* 4-point studio lighting rig */}
        {/* Clinical Lightbox Lighting setup — Pure white, high-intensity all-around illumination */}
        <ambientLight intensity={0.8} color="#ffffff" />

        {/* 4-way diagonal directional light array for shadowless uniform lighting */}
        <directionalLight position={[150, 150, 150]} intensity={1.1} color="#ffffff" />
        <directionalLight position={[-150, -150, -150]} intensity={1.1} color="#ffffff" />
        <directionalLight position={[-150, 150, 150]} intensity={1.1} color="#ffffff" />
        <directionalLight position={[150, -150, -150]} intensity={1.1} color="#ffffff" />

        {/* Soft grounding shadow */}
        <ContactShadows
          position={[0, -35, 0]}
          opacity={0.2}
          scale={200}
          blur={2.0}
          far={100}
          color="#000000"
        />

        {/* Auto-framing bounds wrapper */}
        <Bounds fit observe margin={1.6}>
          <BoundsFit>
            <Suspense fallback={<CanvasLoader />}>
              {/* Page 1: Local file preview meshes */}
              {isPreview && (
                <>
                  {previewFiles?.mesh1 && (
                    <LocalSTLMesh
                      file={previewFiles.mesh1}
                      color="#3b82f6"
                      visible={previewVisibility.mesh1}
                    />
                  )}
                  {previewFiles?.mesh2 && (
                    <LocalSTLMesh
                      file={previewFiles.mesh2}
                      color="#94a3b8"
                      visible={previewVisibility.mesh2}
                    />
                  )}
                </>
              )}

              {/* Page 2: URL-based meshes */}
              {isViewer && (
                <>
                  {/* Input meshes — glass-like transparent overlay */}
                  {meshUrls?.inputMaxilla && (
                    <UrlSTLMesh
                      url={meshUrls.inputMaxilla}
                      color="#5b9cf5"
                      emissive="#1e3a6e"
                      roughness={0.15}
                      metalness={0.05}
                      clearcoat={0.8}
                      clearcoatRoughness={0.1}
                      opacity={0.55}
                      transparent={true}
                      transmission={0.3}
                      visible={visibility.inputMaxilla}
                    />
                  )}
                  {meshUrls?.inputMandible && (
                    <UrlSTLMesh
                      url={meshUrls.inputMandible}
                      color="#8b7df5"
                      emissive="#2d1f6e"
                      roughness={0.15}
                      metalness={0.05}
                      clearcoat={0.8}
                      clearcoatRoughness={0.1}
                      opacity={0.55}
                      transparent={true}
                      transmission={0.3}
                      visible={visibility.inputMandible}
                    />
                  )}

                  {/* Output meshes — dental plaster / bone-white */}
                  {meshUrls?.outputMaxilla && (
                    <UrlSTLMesh
                      url={meshUrls.outputMaxilla}
                      color="#f0ece4"
                      emissive="#3a3530"
                      roughness={0.4}
                      metalness={0.08}
                      clearcoat={0.2}
                      clearcoatRoughness={0.3}
                      visible={visibility.outputMaxilla}
                    />
                  )}
                  {meshUrls?.outputMandible && (
                    <UrlSTLMesh
                      url={meshUrls.outputMandible}
                      color="#0d9488"
                      emissive="#064e3b"
                      roughness={0.35}
                      metalness={0.12}
                      clearcoat={0.3}
                      clearcoatRoughness={0.25}
                      visible={visibility.outputMandible}
                    />
                  )}
                </>
              )}
            </Suspense>
          </BoundsFit>
        </Bounds>

        {/* Slow auto-rotate when idle */}
        <AutoRotate speed={0.15} />

        <OrbitControls
          enableDamping
          dampingFactor={0.06}
          minPolarAngle={Math.PI * 0.1}
          maxPolarAngle={Math.PI * 0.85}
          makeDefault
        />

        {/* Subtle fog for depth */}
        <fog attach="fog" args={['#080c14', 250, 600]} />
      </Canvas>
    </div>
  );
}