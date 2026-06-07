'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo, Suspense } from 'react';
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

// ─── Bounds auto-fit trigger ─────────────────────────────────────────────────
function BoundsFit({ children, resetTrigger }: { children: React.ReactNode; resetTrigger: string }) {
  const bounds = useBounds();
  const lastTriggerRef = useRef(resetTrigger);
  const fittedRef = useRef(false);

  // If the trigger changes, reset the fitted flag
  if (lastTriggerRef.current !== resetTrigger) {
    lastTriggerRef.current = resetTrigger;
    fittedRef.current = false;
  }

  useEffect(() => {
    if (!fittedRef.current) {
      const timer = setTimeout(() => {
        bounds.refresh().fit();
        fittedRef.current = true;
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [bounds, resetTrigger]);

  return <>{children}</>;
}



// ─── 2D Screen-space Coordinate Axis Updater ─────────────────────────────────
function AxisUpdater({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const { camera } = useThree();

  useFrame(() => {
    if (!containerRef.current || !camera) return;

    // Project world basis vectors to camera space
    const xDir = new THREE.Vector3(1, 0, 0).transformDirection(camera.matrixWorldInverse);
    const yDir = new THREE.Vector3(0, 1, 0).transformDirection(camera.matrixWorldInverse);
    const zDir = new THREE.Vector3(0, 0, 1).transformDirection(camera.matrixWorldInverse);

    const scale = 22; // length of lines in pixels
    const cx = 40;
    const cy = 40;

    const lineX = containerRef.current.querySelector('#axis-line-x');
    const lineY = containerRef.current.querySelector('#axis-line-y');
    const lineZ = containerRef.current.querySelector('#axis-line-z');

    const textX = containerRef.current.querySelector('#axis-text-x');
    const textY = containerRef.current.querySelector('#axis-text-y');
    const textZ = containerRef.current.querySelector('#axis-text-z');

    if (lineX) {
      lineX.setAttribute('x2', (cx + xDir.x * scale).toString());
      lineX.setAttribute('y2', (cy - xDir.y * scale).toString());
    }
    if (lineY) {
      lineY.setAttribute('x2', (cx + yDir.x * scale).toString());
      lineY.setAttribute('y2', (cy - yDir.y * scale).toString());
    }
    if (lineZ) {
      lineZ.setAttribute('x2', (cx + zDir.x * scale).toString());
      lineZ.setAttribute('y2', (cy - zDir.y * scale).toString());
    }

    if (textX) {
      textX.setAttribute('x', (cx + xDir.x * (scale + 8)).toString());
      textX.setAttribute('y', (cy - xDir.y * (scale + 8) + 3).toString());
    }
    if (textY) {
      textY.setAttribute('x', (cx + yDir.x * (scale + 8)).toString());
      textY.setAttribute('y', (cy - yDir.y * (scale + 8) + 3).toString());
    }
    if (textZ) {
      textZ.setAttribute('x', (cx + zDir.x * (scale + 8)).toString());
      textZ.setAttribute('y', (cy - zDir.y * (scale + 8) + 3).toString());
    }
  });

  return null;
}

interface LocalMeshProps {
  file: File;
  color: string;
  visible?: boolean;
  onLoaded?: () => void;
}

const LocalSTLMesh: React.FC<LocalMeshProps> = ({
  file,
  color,
  visible = true,
  onLoaded,
}) => {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    if (!file) { setGeometry(null); return; }

    const loader = new STLLoader(THREE.DefaultLoadingManager);
    const reader = new FileReader();

    reader.onload = (event) => {
      if (event.target?.result) {
        const arrayBuffer = event.target.result as ArrayBuffer;
        const geom = loader.parse(arrayBuffer);
        geom.computeVertexNormals();
        geom.computeBoundingBox();
        setGeometry(geom);
        if (onLoaded) {
          onLoaded();
        }
      }
    };

    reader.readAsArrayBuffer(file);
  }, [file, onLoaded]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} visible={visible} castShadow receiveShadow>
      <meshStandardMaterial
        color={color}
        roughness={0.4}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

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
  onLoaded?: () => void;
}

const UrlSTLMesh: React.FC<UrlMeshProps> = ({
  url,
  color,
  emissive = '#000000',
  roughness = 0.4,
  metalness = 0.1,
  clearcoat = 0.3,
  clearcoatRoughness = 0.2,
  opacity = 1,
  transparent = false,
  transmission = 0,
  visible,
  onLoaded,
}) => {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    if (!url) { setGeometry(null); return; }

    const loader = new STLLoader(THREE.DefaultLoadingManager);
    loader.load(
      url,
      (geom) => {
        geom.computeVertexNormals();
        geom.computeBoundingBox();
        setGeometry(geom);
        if (onLoaded) {
          onLoaded();
        }
      },
      undefined,
      (error) => {
        console.error(`Failed to load STL from ${url}:`, error);
      }
    );
  }, [url, onLoaded]);

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
  const axisContainerRef = useRef<HTMLDivElement>(null);
  const isPreview = !!(previewFiles?.mesh1 || previewFiles?.mesh2);
  const isViewer = !!(meshUrls?.inputMaxilla || meshUrls?.inputMandible || meshUrls?.outputMaxilla || meshUrls?.outputMandible);

  // States to track loaded meshes count
  const [loadedCount, setLoadedCount] = useState(0);

  // Reset count whenever files/URLs change (starts loading new case)
  useEffect(() => {
    setLoadedCount(0);
  }, [previewFiles?.mesh1, previewFiles?.mesh2, meshUrls?.inputMaxilla, meshUrls?.inputMandible, meshUrls?.outputMaxilla, meshUrls?.outputMandible]);

  const targetCount = useMemo(() => {
    let count = 0;
    if (isPreview) {
      if (previewFiles?.mesh1) count++;
      if (previewFiles?.mesh2) count++;
    } else if (isViewer) {
      if (meshUrls?.inputMaxilla) count++;
      if (meshUrls?.inputMandible) count++;
      if (meshUrls?.outputMaxilla) count++;
      if (meshUrls?.outputMandible) count++;
    }
    return count;
  }, [isPreview, isViewer, previewFiles?.mesh1, previewFiles?.mesh2, meshUrls]);

  const onMeshLoaded = useCallback(() => {
    setLoadedCount((prev) => prev + 1);
  }, []);

  const isProcessing = targetCount > 0 && loadedCount < targetCount;

  // Memoized reset trigger to re-fit bounds only when loaded meshes change
  const resetTrigger = useMemo(() => {
    if (isPreview) {
      return `${previewFiles?.mesh1?.name || ''}-${previewFiles?.mesh2?.name || ''}`;
    }
    if (isViewer) {
      return `${meshUrls?.inputMaxilla || ''}-${meshUrls?.inputMandible || ''}-${meshUrls?.outputMaxilla || ''}-${meshUrls?.outputMandible || ''}`;
    }
    return '';
  }, [isPreview, isViewer, previewFiles?.mesh1?.name, previewFiles?.mesh2?.name, meshUrls]);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      minHeight: '300px',
      background: 'linear-gradient(to bottom, #111e38 0%, #030712 100%)',
    }}>
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{ position: [0, 40, 180], fov: 40 }}
        style={{ background: 'transparent' }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      >
        {/* Studio Lighting Setup (4-Point Directional Light Rig + Ambient) - Stable and high-performance */}
        <ambientLight intensity={0.75} color="#ffffff" />

        {/* Key Light (front-right-top) */}
        <directionalLight position={[120, 120, 100]} intensity={1.0} color="#ffffff" />

        {/* Fill Light (front-left-middle) */}
        <directionalLight position={[-120, 80, 50]} intensity={0.5} color="#ffffff" />

        {/* Rim Light (back-top) */}
        <directionalLight position={[0, 100, -120]} intensity={0.7} color="#ffffff" />

        {/* Bounce Light (bottom) */}
        <directionalLight position={[0, -100, 0]} intensity={0.3} color="#ffffff" />

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
          <BoundsFit resetTrigger={resetTrigger}>
            <Suspense fallback={<CanvasLoader />}>
              {/* Page 1: Local file preview meshes */}
              {isPreview && (
                <>
                  {previewFiles?.mesh1 && (
                    <LocalSTLMesh
                      file={previewFiles.mesh1}
                      color="#3b82f6"
                      visible={previewVisibility.mesh1}
                      onLoaded={onMeshLoaded}
                    />
                  )}
                  {previewFiles?.mesh2 && (
                    <LocalSTLMesh
                      file={previewFiles.mesh2}
                      color="#94a3b8"
                      visible={previewVisibility.mesh2}
                      onLoaded={onMeshLoaded}
                    />
                  )}
                </>
              )}

              {/* Page 2: URL-based meshes */}
              {isViewer && (
                <>
                  {/* Input meshes — solid plaster model */}
                  {meshUrls?.inputMaxilla && (
                    <UrlSTLMesh
                      url={meshUrls.inputMaxilla}
                      color="#3b82f6"
                      emissive="#000000"
                      roughness={0.4}
                      metalness={0.1}
                      clearcoat={0.3}
                      clearcoatRoughness={0.2}
                      visible={visibility.inputMaxilla}
                      onLoaded={onMeshLoaded}
                    />
                  )}
                  {meshUrls?.inputMandible && (
                    <UrlSTLMesh
                      url={meshUrls.inputMandible}
                      color="#8b7df5"
                      emissive="#000000"
                      roughness={0.4}
                      metalness={0.1}
                      clearcoat={0.3}
                      clearcoatRoughness={0.2}
                      visible={visibility.inputMandible}
                      onLoaded={onMeshLoaded}
                    />
                  )}

                  {/* Output meshes — solid cyan plaster & teal resin */}
                  {meshUrls?.outputMaxilla && (
                    <UrlSTLMesh
                      url={meshUrls.outputMaxilla}
                      color="#06b6d4"
                      emissive="#000000"
                      roughness={0.4}
                      metalness={0.1}
                      clearcoat={0.3}
                      clearcoatRoughness={0.2}
                      visible={visibility.outputMaxilla}
                      onLoaded={onMeshLoaded}
                    />
                  )}
                  {meshUrls?.outputMandible && (
                    <UrlSTLMesh
                      url={meshUrls.outputMandible}
                      color="#0d9488"
                      emissive="#000000"
                      roughness={0.4}
                      metalness={0.1}
                      clearcoat={0.3}
                      clearcoatRoughness={0.2}
                      visible={visibility.outputMandible}
                      onLoaded={onMeshLoaded}
                    />
                  )}
                </>
              )}
            </Suspense>
          </BoundsFit>
        </Bounds>

        <OrbitControls
          enableDamping
          dampingFactor={0.06}
          minPolarAngle={Math.PI * 0.1}
          maxPolarAngle={Math.PI * 0.85}
          makeDefault
        />

        {/* 2D Axis Updater */}
        <AxisUpdater containerRef={axisContainerRef} />
      </Canvas>

      {/* CloudCompare-style Coordinate Axis Widget Overlay */}
      <div
        ref={axisContainerRef}
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          width: '74px',
          height: '74px',
          pointerEvents: 'none',
          zIndex: 10,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(4px)',
          borderRadius: '50%',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="80" height="80" style={{ overflow: 'visible' }}>
          {/* X axis - Red */}
          <line id="axis-line-x" x1="40" y1="40" x2="65" y2="40" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
          <text id="axis-text-x" x="72" y="43" fill="#ef4444" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">X</text>

          {/* Y axis - Green */}
          <line id="axis-line-y" x1="40" y1="40" x2="40" y2="15" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
          <text id="axis-text-y" x="40" y="8" fill="#22c55e" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">Y</text>

          {/* Z axis - Blue */}
          <line id="axis-line-z" x1="40" y1="40" x2="40" y2="40" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
          <text id="axis-text-z" x="40" y="43" fill="#3b82f6" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">Z</text>

          {/* Center dot */}
          <circle cx="40" cy="40" r="3.5" fill="#ffffff" stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
        </svg>
      </div>

      {/* Premium Medical Scanner Loading Overlay */}
      {isProcessing && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: '#080c14',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          color: '#06b6d4',
          fontFamily: 'monospace',
          gap: '16px',
          userSelect: 'none',
        }}>
          {/* Pulsing Scanner Ring */}
          <div style={{
            width: '44px',
            height: '44px',
            border: '2px solid rgba(6, 182, 212, 0.1)',
            borderTopColor: '#06b6d4',
            borderBottomColor: '#06b6d4',
            borderRadius: '50%',
            animation: 'spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite',
          }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Preparing 3D Models
            </span>
            <span style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.04em' }}>
              Parsing geometries and rendering scene ({loadedCount}/{targetCount})
            </span>
          </div>
          {/* Monospace progress bar */}
          <div style={{
            width: '160px',
            height: '3px',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${(loadedCount / targetCount) * 100}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #06b6d4, #0d9488)',
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }} />
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
}