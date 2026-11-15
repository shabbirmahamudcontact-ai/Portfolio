import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { detectWebGLCapabilities } from './webglCapability';
import { ResilientImage } from '../ResilientImage';
import { resolveAssetUrl } from '../../lib/assetUrl';

interface ProjectDeviceMockup3DProps {
  imageUrl: string;
  title: string;
  deviceType: 'laptop' | 'phone';
}

function MockupEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const rt = pmrem.fromScene(room, 0.04);
    scene.environment = rt.texture;
    room.dispose();
    pmrem.dispose();
    return () => {
      scene.environment = null;
      rt.dispose();
    };
  }, [gl, scene]);
  return null;
}

function useSafeProjectTexture(imageUrl: string, title: string): THREE.Texture {
  const resolvedUrl = resolveAssetUrl(imageUrl);
  const fallbackTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 640;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#181A18';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#C6A24B';
    ctx.fillRect(0, 0, canvas.width, 12);
    ctx.fillStyle = '#F7F5F0';
    ctx.font = '700 42px sans-serif';
    ctx.fillText(title.slice(0, 32), 64, 180);
    ctx.fillStyle = '#9CA097';
    ctx.font = '500 24px sans-serif';
    ctx.fillText('Interactive 3D Project Preview', 64, 236);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [title]);

  const [loadedTex, setLoadedTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!resolvedUrl) {
      setLoadedTex(null);
      return;
    }
    let active = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!active) return;
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      setLoadedTex(tex);
    };
    img.onerror = () => {
      if (active) setLoadedTex(null);
    };
    img.src = resolvedUrl;

    return () => {
      active = false;
    };
  }, [resolvedUrl]);

  useEffect(() => {
    return () => {
      loadedTex?.dispose();
    };
  }, [loadedTex]);

  useEffect(() => {
    return () => {
      fallbackTexture.dispose();
    };
  }, [fallbackTexture]);

  return loadedTex || fallbackTexture;
}

function DeviceMesh({
  imageUrl,
  title,
  deviceType,
  dragOffset,
}: ProjectDeviceMockup3DProps & { dragOffset: { x: number; y: number } }) {
  const groupRef = useRef<THREE.Group>(null);
  const texture = useSafeProjectTexture(imageUrl, title);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    const targetRotY = dragOffset.x + Math.sin(t * 0.55) * 0.16;
    const targetRotX = dragOffset.y + (deviceType === 'laptop' ? 0.18 : 0.06);
    groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, targetRotY, 6, delta);
    groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, targetRotX, 6, delta);
  });

  if (deviceType === 'phone') {
    return (
      <group ref={groupRef} position={[0, 0, 0]}>
        {/* Phone Champagne-Gold Titanium Frame */}
        <mesh>
          <boxGeometry args={[1.38, 2.75, 0.14]} />
          <meshPhysicalMaterial color="#C6A24B" metalness={0.92} roughness={0.22} clearcoat={0.6} />
        </mesh>
        {/* Front Bezel */}
        <mesh position={[0, 0, 0.072]}>
          <boxGeometry args={[1.28, 2.64, 0.015]} />
          <meshStandardMaterial color="#111312" roughness={0.2} metalness={0.3} />
        </mesh>
        {/* Project Screen */}
        <mesh position={[0, 0, 0.082]}>
          <planeGeometry args={[1.18, 2.46]} />
          <meshStandardMaterial map={texture} roughness={0.24} />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={groupRef} position={[0, -0.25, 0]}>
      {/* Laptop Base Deck */}
      <mesh position={[0, -0.58, 0.58]} rotation={[0.04, 0, 0]}>
        <boxGeometry args={[3.36, 0.1, 2.15]} />
        <meshPhysicalMaterial color="#242724" metalness={0.85} roughness={0.28} clearcoat={0.4} />
      </mesh>
      {/* Trackpad Accent */}
      <mesh position={[0, -0.528, 1.15]} rotation={[-Math.PI / 2 + 0.04, 0, 0]}>
        <planeGeometry args={[1.05, 0.68]} />
        <meshStandardMaterial color="#181A18" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Champagne-Gold Hinge Strip */}
      <mesh position={[0, -0.5, -0.45]}>
        <cylinderGeometry args={[0.045, 0.045, 2.75, 16]} />
        <meshStandardMaterial color="#C6A24B" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Hinged Display Lid */}
      <group position={[0, 0.42, -0.48]} rotation={[-0.14, 0, 0]}>
        <mesh>
          <boxGeometry args={[3.34, 2.02, 0.08]} />
          <meshPhysicalMaterial color="#1D201E" metalness={0.88} roughness={0.22} />
        </mesh>
        <mesh position={[0, 0, 0.043]}>
          <planeGeometry args={[3.14, 1.84]} />
          <meshStandardMaterial map={texture} roughness={0.25} />
        </mesh>
      </group>
    </group>
  );
}

export default function ProjectDeviceMockup3D({
  imageUrl,
  title,
  deviceType,
}: ProjectDeviceMockup3DProps) {
  const [caps] = useState(() => detectWebGLCapabilities());
  const [contextLost, setContextLost] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });

  if (!caps.webglSupported || contextLost || caps.reducedMotion) {
    return (
      <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[#E0DDD5] bg-[#FFFFFF]">
        <ResilientImage src={imageUrl} alt={title} lazy={false} className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className="aspect-[4/3] w-full rounded-2xl border border-[#E0DDD5] bg-gradient-to-br from-[#EFECE6] to-[#E5E0D5] relative overflow-hidden cursor-grab active:cursor-grabbing select-none"
      data-cursor="Drag"
      onPointerDown={(e) => {
        draggingRef.current = true;
        lastPointerRef.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!draggingRef.current) return;
        const dx = e.clientX - lastPointerRef.current.x;
        const dy = e.clientY - lastPointerRef.current.y;
        lastPointerRef.current = { x: e.clientX, y: e.clientY };
        setDragOffset((prev) => ({
          x: Math.max(-1.1, Math.min(1.1, prev.x + dx * 0.008)),
          y: Math.max(-0.45, Math.min(0.45, prev.y + dy * 0.006)),
        }));
      }}
      onPointerUp={() => {
        draggingRef.current = false;
      }}
      onPointerLeave={() => {
        draggingRef.current = false;
      }}
    >
      <Canvas
        dpr={[1, caps.isLowPower ? 1 : 2]}
        camera={{ position: [0, 0.25, 4.4], fov: 38 }}
        gl={{ antialias: !caps.isLowPower, alpha: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            setContextLost(true);
          });
        }}
      >
        <MockupEnvironment />
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 5, 5]} intensity={1.9} color="#FFF4DF" />
        <DeviceMesh
          imageUrl={imageUrl}
          title={title}
          deviceType={deviceType}
          dragOffset={dragOffset}
        />
      </Canvas>
      <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] font-mono-tabular text-[#5A5E58]">
        <span>Interactive 3D {deviceType === 'phone' ? 'Smartphone' : 'Laptop'} Mockup</span>
        <span>Drag to Rotate</span>
      </div>
    </div>
  );
}
