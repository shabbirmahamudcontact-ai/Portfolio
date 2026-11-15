import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import { EffectComposer, Bloom, DepthOfField, Noise } from '@react-three/postprocessing';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  buildExtrudedWordGeometries,
  createRoundedFrameShape,
  createRoundedRectShape,
} from './extrudedTextShapes';
import { detectWebGLCapabilities } from './webglCapability';

interface HeroSceneR3FProps {
  name3D?: string;
  accentColor?: string;
  ownerName?: string;
}

/* -------------------------------------------------------------------------- */
/* Procedural RoomEnvironment PMREM (zero network HDRI fetches)               */
/* -------------------------------------------------------------------------- */
function ProceduralRoomEnv() {
  const { gl, scene } = useThree();

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const roomEnv = new RoomEnvironment();
    const renderTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = renderTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    return () => {
      scene.environment = null;
      renderTarget.dispose();
    };
  }, [gl, scene]);

  return null;
}

/* -------------------------------------------------------------------------- */
/* Procedural Brushed Metal Roughness/Bump Map (Linear NoColorSpace)          */
/* -------------------------------------------------------------------------- */
function createBrushedMetalTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#B8B8B8';
  ctx.fillRect(0, 0, 512, 512);

  for (let y = 0; y < 512; y += 2) {
    const lum = 155 + Math.floor(Math.sin(y * 0.37) * 24 + (Math.random() - 0.5) * 32);
    ctx.fillStyle = `rgb(${lum},${lum},${lum})`;
    ctx.fillRect(0, y, 512, 1.5);
  }

  for (let i = 0; i < 420; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const len = 30 + Math.random() * 140;
    const alpha = 0.08 + Math.random() * 0.14;
    ctx.strokeStyle = i % 2 === 0 ? `rgba(255,255,255,${alpha})` : `rgba(80,80,80,${alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/* -------------------------------------------------------------------------- */
/* Radial Contact Shadow Grounding Texture                                    */
/* -------------------------------------------------------------------------- */
function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 16, 128, 128, 126);
  grad.addColorStop(0, 'rgba(5, 7, 6, 0.85)');
  grad.addColorStop(0.55, 'rgba(10, 13, 11, 0.42)');
  grad.addColorStop(1, 'rgba(17, 20, 18, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* -------------------------------------------------------------------------- */
/* HiDPI Procedural CanvasTextures for Editorial Strategy Cards               */
/* -------------------------------------------------------------------------- */
function createPostCardTexture(
  tag: string,
  title: string,
  metric: string,
  subtitle: string,
  accentHex: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 680;
  const ctx = canvas.getContext('2d')!;

  // Deep obsidian-emerald editorial glass face
  const bgGrad = ctx.createLinearGradient(0, 0, 1024, 680);
  bgGrad.addColorStop(0, '#191E1B');
  bgGrad.addColorStop(1, '#111513');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1024, 680);

  // Subtle architectural grid
  ctx.strokeStyle = 'rgba(226, 195, 116, 0.08)';
  ctx.lineWidth = 2;
  for (let x = 72; x < 1024; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 680);
    ctx.stroke();
  }
  for (let y = 84; y < 680; y += 128) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  // Champagne-gold top hairline
  const goldGrad = ctx.createLinearGradient(0, 0, 1024, 0);
  goldGrad.addColorStop(0, '#C6A24B');
  goldGrad.addColorStop(0.5, '#F0D589');
  goldGrad.addColorStop(1, '#C6A24B');
  ctx.fillStyle = goldGrad;
  ctx.fillRect(0, 0, 1024, 14);

  // Category eyebrow + verified swatch
  ctx.fillStyle = '#34D399';
  ctx.fillRect(68, 86, 14, 14);
  ctx.fillStyle = '#E2C374';
  ctx.font = '600 32px sans-serif';
  ctx.fillText(tag.toUpperCase(), 98, 104);

  // Card Title
  ctx.fillStyle = '#F7F5F0';
  ctx.font = '700 62px sans-serif';
  ctx.fillText(title, 68, 192);

  // Divider rule
  ctx.fillStyle = 'rgba(247, 245, 240, 0.12)';
  ctx.fillRect(68, 236, 888, 2);

  // Bar sparkline graphic
  const barHeights = [92, 148, 116, 198, 166, 236, 212, 268];
  barHeights.forEach((h, i) => {
    const x = 68 + i * 54;
    const y = 576 - h;
    ctx.fillStyle = i >= 6 ? '#E2C374' : i >= 4 ? '#2CA57F' : accentHex;
    ctx.fillRect(x, y, 34, h);
  });

  // Metric readout
  ctx.fillStyle = '#F7F5F0';
  ctx.font = '700 96px monospace';
  ctx.fillText(metric, 550, 428);

  ctx.fillStyle = '#B9C0B9';
  ctx.font = '500 32px sans-serif';
  ctx.fillText(subtitle, 550, 488);

  // Thin bottom accent bar
  ctx.fillStyle = 'rgba(226, 195, 116, 0.35)';
  ctx.fillRect(550, 524, 380, 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createPhoneFeedTexture(displayName: string): {
  texture: THREE.CanvasTexture;
  drawScroll: (offsetY: number) => void;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 540;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d')!;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const drawScroll = (offsetY: number) => {
    ctx.fillStyle = '#101312';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const posts = [
      { label: 'SOCIAL STRATEGY', title: 'Editorial Reel Reach', val: '+148%' },
      { label: 'AI MARKETING', title: 'n8n Lead Routing', val: '24/7' },
      { label: 'WEB ANALYTICS', title: 'Conversion Funnel', val: '4.8x' },
      { label: 'BRAND SYSTEMS', title: 'Creative Visual Deck', val: '100%' },
    ];

    const loopHeight = posts.length * 265;
    const shift = ((offsetY % loopHeight) + loopHeight) % loopHeight;

    for (let copy = -1; copy <= 1; copy++) {
      posts.forEach((post, idx) => {
        const y = 140 + idx * 265 - shift + copy * loopHeight;
        if (y > canvas.height || y + 230 < 100) return;

        ctx.fillStyle = '#1A1F1C';
        ctx.fillRect(28, y, 484, 232);
        ctx.strokeStyle = 'rgba(226, 195, 116, 0.24)';
        ctx.lineWidth = 2;
        ctx.strokeRect(28, y, 484, 232);

        ctx.fillStyle = '#C6A24B';
        ctx.fillRect(28, y, 484, 6);

        ctx.fillStyle = '#E2C374';
        ctx.font = '600 20px sans-serif';
        ctx.fillText(post.label, 52, y + 52);

        ctx.fillStyle = '#F7F5F0';
        ctx.font = '700 32px sans-serif';
        ctx.fillText(post.title, 52, y + 102);

        ctx.fillStyle = '#34D399';
        ctx.font = '700 42px monospace';
        ctx.fillText(post.val, 52, y + 178);

        for (let b = 0; b < 6; b++) {
          const bh = 22 + ((idx * 17 + b * 13) % 54);
          ctx.fillStyle = b === 5 ? '#E2C374' : 'rgba(247,245,240,0.22)';
          ctx.fillRect(306 + b * 28, y + 196 - bh, 17, bh);
        }
      });
    }

    // Fixed obsidian phone top header with Shabbir Mahamud branding
    ctx.fillStyle = '#141816';
    ctx.fillRect(0, 0, canvas.width, 116);
    ctx.fillStyle = 'rgba(226, 195, 116, 0.35)';
    ctx.fillRect(0, 114, canvas.width, 2);

    ctx.fillStyle = '#E2C374';
    ctx.font = '700 22px sans-serif';
    ctx.fillText(displayName.toUpperCase(), 32, 74);

    ctx.fillStyle = '#34D399';
    ctx.font = '600 18px monospace';
    ctx.fillText('LIVE STUDIO', 392, 74);

    tex.needsUpdate = true;
  };

  drawScroll(0);
  return { texture: tex, drawScroll };
}

function createParticleDotTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255, 240, 194, 1)');
  grad.addColorStop(0.4, 'rgba(226, 195, 116, 0.65)');
  grad.addColorStop(1, 'rgba(198, 162, 75, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* -------------------------------------------------------------------------- */
/* Architectural Gyroscope Calibration Markers (InstancedMesh)                */
/* -------------------------------------------------------------------------- */
function GyroscopeTickMarkers({ radius, count }: { radius: number; count: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const inst = meshRef.current;
    if (!inst) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
      dummy.rotation.set(0, 0, a);
      const isCardinal = i % (count / 4) === 0;
      dummy.scale.set(isCardinal ? 1.8 : 1.0, isCardinal ? 1.4 : 0.85, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
  }, [radius, count]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.07, 0.018, 0.03]} />
      <meshPhysicalMaterial color="#E2C374" metalness={0.95} roughness={0.18} />
    </instancedMesh>
  );
}

/* -------------------------------------------------------------------------- */
/* Inner 3D Scene Graph (Mouse Parallax + Scroll Camera Path + Sculptures)    */
/* -------------------------------------------------------------------------- */
function SpatialStage({
  name3D,
  accentColor,
  ownerName,
  isLowPower,
  isSoftwareRenderer,
}: {
  name3D: string;
  accentColor: string;
  ownerName: string;
  isLowPower: boolean;
  isSoftwareRenderer: boolean;
}) {
  const { gl } = useThree();
  const rootGroupRef = useRef<THREE.Group>(null);
  const nameGroupRef = useRef<THREE.Group>(null);
  const haloOuterRef = useRef<THREE.Group>(null);
  const haloInnerRef = useRef<THREE.Group>(null);
  const phoneGroupRef = useRef<THREE.Group>(null);
  const barsGroupRef = useRef<THREE.Group>(null);
  const barGroupRefs = useRef<Array<THREE.Group | null>>([]);
  const dustPointsRef = useRef<THREE.Points>(null);

  const scrollNormRef = useRef(0);
  const pointerNormRef = useRef({ x: 0, y: 0 });
  const lastFeedDrawRef = useRef(0);

  // Extruded champagne-gold 3D name ("Shabbir Mahamud" multi-line layout)
  const wordSpec = useMemo(() => buildExtrudedWordGeometries(name3D, 0.075, 0.22), [name3D]);

  // Precision rounded-rect & beveled geometries for glass cards, phone, and analytics bars
  const geometries = useMemo(() => {
    const cardGlassGeo = new THREE.ExtrudeGeometry(createRoundedRectShape(1.56, 1.04, 0.08), {
      depth: 0.03,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.012,
      bevelThickness: 0.012,
      curveSegments: 12,
    });
    cardGlassGeo.center();

    const cardFrameGeo = new THREE.ExtrudeGeometry(createRoundedFrameShape(1.58, 1.06, 0.085, 0.025), {
      depth: 0.04,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.008,
      bevelThickness: 0.008,
      curveSegments: 12,
    });
    cardFrameGeo.center();

    const phoneBodyGeo = new THREE.ExtrudeGeometry(createRoundedRectShape(0.94, 1.88, 0.14), {
      depth: 0.08,
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: 0.018,
      bevelThickness: 0.018,
      curveSegments: 16,
    });
    phoneBodyGeo.center();

    const phoneScreenBezelGeo = new THREE.ExtrudeGeometry(createRoundedRectShape(0.86, 1.8, 0.11), {
      depth: 0.015,
      bevelEnabled: false,
      curveSegments: 14,
    });
    phoneScreenBezelGeo.center();

    const phoneIslandGeo = new THREE.ExtrudeGeometry(createRoundedRectShape(0.24, 0.055, 0.025), {
      depth: 0.01,
      bevelEnabled: false,
      curveSegments: 8,
    });
    phoneIslandGeo.center();

    const cameraBumpGeo = new THREE.ExtrudeGeometry(createRoundedRectShape(0.32, 0.36, 0.06), {
      depth: 0.025,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.008,
      bevelThickness: 0.008,
      curveSegments: 10,
    });
    cameraBumpGeo.center();

    const barShape = createRoundedRectShape(0.24, 0.24, 0.035);
    const barUnitGeo = new THREE.ExtrudeGeometry(barShape, {
      depth: 1,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.01,
      bevelThickness: 0.01,
      curveSegments: 8,
    });
    barUnitGeo.rotateX(-Math.PI / 2);

    return {
      cardGlassGeo,
      cardFrameGeo,
      phoneBodyGeo,
      phoneScreenBezelGeo,
      phoneIslandGeo,
      cameraBumpGeo,
      barUnitGeo,
    };
  }, []);

  useEffect(() => {
    return () => {
      for (const item of wordSpec.letters) {
        item.geometry.dispose();
      }
    };
  }, [wordSpec]);

  useEffect(() => {
    return () => {
      Object.values(geometries).forEach((geo) => geo.dispose());
    };
  }, [geometries]);

  const brushedMetalTex = useMemo(() => createBrushedMetalTexture(), []);
  const contactShadowTex = useMemo(() => createContactShadowTexture(), []);
  const cardTextures = useMemo(() => {
    return [
      createPostCardTexture('Social Strategy', 'Audience Growth', '+142%', 'Organic Reach Velocity', accentColor),
      createPostCardTexture('AI Marketing', 'n8n Automation', '99.4%', 'Pipeline Uptime', accentColor),
      createPostCardTexture('Web Analytics', 'Attribution', '4.6x', 'Verified Funnel ROI', accentColor),
    ];
  }, [accentColor]);

  const phoneFeed = useMemo(
    () => createPhoneFeedTexture(ownerName || name3D || 'Shabbir Mahamud'),
    [ownerName, name3D]
  );
  const dustSprite = useMemo(() => createParticleDotTexture(), []);

  useEffect(() => {
    const maxAniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
    cardTextures.forEach((t) => {
      t.anisotropy = maxAniso;
    });
    phoneFeed.texture.anisotropy = maxAniso;
    brushedMetalTex.anisotropy = maxAniso;
  }, [gl, cardTextures, phoneFeed, brushedMetalTex]);

  useEffect(() => {
    return () => {
      brushedMetalTex.dispose();
      contactShadowTex.dispose();
      cardTextures.forEach((t) => t.dispose());
      phoneFeed.texture.dispose();
      dustSprite.dispose();
    };
  }, [brushedMetalTex, contactShadowTex, cardTextures, phoneFeed, dustSprite]);

  // Sparse floating champagne dust particles
  const particlePositions = useMemo(() => {
    const count = isLowPower ? 36 : 84;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 10.5;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 6.5;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 5.5 - 0.8;
    }
    return arr;
  }, [isLowPower]);

  useEffect(() => {
    const onScroll = () => {
      const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 900);
      scrollNormRef.current = Math.min(1, Math.max(0, window.scrollY / Math.min(maxScroll, 2400)));
    };
    const onPointerMove = (e: PointerEvent) => {
      pointerNormRef.current.x = (e.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
      pointerNormRef.current.y = -((e.clientY / Math.max(window.innerHeight, 1)) * 2 - 1);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, []);

  const barBaseHeights = [0.58, 0.92, 0.74, 1.18, 1.46];
  const barColors = ['#1B5E4A', '#26735B', '#C6A24B', '#1B5E4A', '#E2C374'];
  const enableGlassTransmission = !isLowPower && !isSoftwareRenderer;

  useFrame((state, delta) => {
    const s = scrollNormRef.current;
    const px = pointerNormRef.current.x;
    const py = pointerNormRef.current.y;
    const t = state.clock.elapsedTime;

    // Smooth scroll-driven camera trajectory with subtle pointer parallax
    const targetCamX = Math.sin(s * Math.PI * 0.85) * 0.85 + px * 0.35;
    const targetCamY = 0.22 - s * 0.5 + py * 0.2;
    const targetCamZ = 6.35 - s * 1.1;

    state.camera.position.x = THREE.MathUtils.damp(state.camera.position.x, targetCamX, 4, delta);
    state.camera.position.y = THREE.MathUtils.damp(state.camera.position.y, targetCamY, 4, delta);
    state.camera.position.z = THREE.MathUtils.damp(state.camera.position.z, targetCamZ, 4, delta);
    state.camera.lookAt(0, 0.05 - s * 0.14, 0);

    // Extruded champagne-gold 3D "Shabbir Mahamud" centerpiece motion
    if (nameGroupRef.current) {
      const targetMaxWidth = wordSpec.lineCount > 1 ? 3.55 : 4.0;
      const wordScale = Math.min(0.88, targetMaxWidth / Math.max(wordSpec.totalWidth, 2.2));
      const targetScale = wordScale * (1 - s * 0.1);
      nameGroupRef.current.scale.setScalar(
        THREE.MathUtils.damp(nameGroupRef.current.scale.x, targetScale, 5, delta)
      );
      nameGroupRef.current.rotation.y = THREE.MathUtils.damp(
        nameGroupRef.current.rotation.y,
        px * 0.2 + Math.sin(t * 0.45) * 0.06 + s * 0.4,
        4,
        delta
      );
      nameGroupRef.current.rotation.x = THREE.MathUtils.damp(
        nameGroupRef.current.rotation.x,
        -py * 0.1 + s * 0.08,
        4,
        delta
      );
    }

    // Architectural gyroscope orbit rings
    if (haloOuterRef.current) {
      haloOuterRef.current.rotation.z = t * 0.08 + s * 0.4;
      haloOuterRef.current.rotation.y = Math.sin(t * 0.3) * 0.18 + px * 0.12;
    }
    if (haloInnerRef.current) {
      haloInnerRef.current.rotation.z = -t * 0.12 - s * 0.35;
      haloInnerRef.current.rotation.x = 0.35 + Math.cos(t * 0.28) * 0.1;
    }

    // Rotating composite smartphone
    if (phoneGroupRef.current) {
      phoneGroupRef.current.rotation.y = -0.35 + t * 0.32 + s * 1.25 + px * 0.22;
      phoneGroupRef.current.position.y = 0.08 + Math.sin(t * 0.9) * 0.07 - s * 0.25;
    }

    // Scroll-driven 3D analytics bars growth
    barGroupRefs.current.forEach((grp, idx) => {
      if (!grp) return;
      const growthFactor = 0.45 + s * 0.92 + Math.sin(t * 1.1 + idx * 0.65) * 0.055;
      const targetScaleY = Math.max(0.25, growthFactor);
      grp.scale.y = THREE.MathUtils.damp(grp.scale.y, targetScaleY, 5, delta);
    });

    // Throttled live canvas feed animation
    if (!isLowPower && t - lastFeedDrawRef.current > 0.055) {
      lastFeedDrawRef.current = t;
      phoneFeed.drawScroll(t * 54 + s * 240);
    }

    if (dustPointsRef.current) {
      dustPointsRef.current.rotation.y = t * 0.025 + px * 0.04;
    }
  });

  return (
    <group ref={rootGroupRef}>
      <color attach="background" args={['#111412']} />
      <fogExp2 attach="fog" args={['#111412', 0.068]} />
      <ProceduralRoomEnv />

      {/* Warm/Cool Editorial Studio Lighting Rig */}
      <hemisphereLight args={['#FFF6E5', '#172620', 0.72]} />
      <directionalLight position={[4.5, 6.5, 5.5]} intensity={2.6} color="#FFF0D4" />
      <directionalLight position={[-5.5, 2.5, -3.5]} intensity={1.45} color="#6EE7B7" />
      <pointLight position={[0.4, -1.3, 3.6]} intensity={1.35} color="#E2C374" />
      <spotLight
        position={[0, 5.2, 2.5]}
        angle={0.55}
        penumbra={0.85}
        intensity={1.9}
        color="#FFE8B5"
      />

      {/* Studio Horizon Architectural Stage & Contact Shadow */}
      <group position={[0, -1.78, -0.25]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <planeGeometry args={[10, 10]} />
          <meshBasicMaterial
            map={contactShadowTex}
            transparent
            opacity={0.7}
            depthWrite={false}
          />
        </mesh>
        {/* Brushed Dark Obsidian Pedestal Disc */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[2.25, 2.42, 0.1, 64]} />
          <meshPhysicalMaterial
            color="#1A1E1B"
            metalness={0.55}
            roughness={0.32}
            clearcoat={0.4}
          />
        </mesh>
        {/* Inlaid Champagne Gold Concentric Rim */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.055, 0]}>
          <ringGeometry args={[2.14, 2.18, 64]} />
          <meshPhysicalMaterial color="#E2C374" metalness={0.95} roughness={0.18} />
        </mesh>
      </group>

      {/* Architectural Gyroscope Halo behind centerpiece */}
      <group position={[-0.2, 0.55, -0.9]}>
        <group ref={haloOuterRef}>
          <mesh>
            <torusGeometry args={[2.25, 0.018, 16, 96]} />
            <meshPhysicalMaterial
              color="#C6A24B"
              metalness={0.94}
              roughness={0.2}
              envMapIntensity={1.6}
            />
          </mesh>
          <GyroscopeTickMarkers radius={2.34} count={24} />
        </group>
        <group ref={haloInnerRef}>
          <mesh>
            <torusGeometry args={[1.82, 0.012, 16, 84]} />
            <meshPhysicalMaterial color="#2C3530" metalness={0.8} roughness={0.28} />
          </mesh>
        </group>
      </group>

      {/* 1. Extruded Brushed Champagne-Gold 3D Name ("Shabbir Mahamud") */}
      <Float speed={1.35} rotationIntensity={0.05} floatIntensity={0.14}>
        <group ref={nameGroupRef} position={[-0.2, 0.62, 0.35]}>
          {wordSpec.letters.map((letter, idx) => (
            <mesh
              key={idx}
              geometry={letter.geometry}
              position={[letter.xOffset, letter.yOffset, -0.11]}
              scale={letter.scale}
            >
              <meshPhysicalMaterial
                color="#E3BF68"
                metalness={0.95}
                roughness={0.18}
                roughnessMap={brushedMetalTex}
                bumpMap={brushedMetalTex}
                bumpScale={0.008}
                clearcoat={0.85}
                clearcoatRoughness={0.1}
                anisotropy={0.75}
                envMapIntensity={1.85}
              />
            </mesh>
          ))}
        </group>
      </Float>

      {/* 2. Composite Rounded Frosted-Glass Strategy Cards */}
      <Float speed={1.6} rotationIntensity={0.1} floatIntensity={0.2}>
        <group position={[-2.05, -0.35, 0.78]} rotation={[0.05, 0.32, -0.04]} scale={0.92}>
          <mesh geometry={geometries.cardGlassGeo} position={[0, 0, -0.025]}>
            <meshPhysicalMaterial
              color="#DCE6E0"
              transmission={enableGlassTransmission ? 0.72 : 0}
              transparent
              opacity={enableGlassTransmission ? 0.92 : 0.42}
              ior={1.5}
              thickness={0.18}
              roughness={0.12}
              clearcoat={1.0}
            />
          </mesh>
          <mesh geometry={geometries.cardFrameGeo} position={[0, 0, -0.015]}>
            <meshPhysicalMaterial color="#D6B25E" metalness={0.92} roughness={0.22} />
          </mesh>
          <mesh position={[0, 0, 0.008]}>
            <planeGeometry args={[1.44, 0.94]} />
            <meshStandardMaterial map={cardTextures[0]} roughness={0.32} metalness={0.08} />
          </mesh>
        </group>
      </Float>

      <Float speed={1.25} rotationIntensity={0.09} floatIntensity={0.18}>
        <group position={[-1.55, 1.56, -0.9]} rotation={[0.08, 0.22, 0.04]} scale={0.82}>
          <mesh geometry={geometries.cardGlassGeo} position={[0, 0, -0.025]}>
            <meshPhysicalMaterial
              color="#DCE6E0"
              transmission={enableGlassTransmission ? 0.65 : 0}
              transparent
              opacity={enableGlassTransmission ? 0.9 : 0.4}
              ior={1.48}
              thickness={0.16}
              roughness={0.14}
              clearcoat={1.0}
            />
          </mesh>
          <mesh geometry={geometries.cardFrameGeo} position={[0, 0, -0.015]}>
            <meshPhysicalMaterial color="#C6A24B" metalness={0.9} roughness={0.24} />
          </mesh>
          <mesh position={[0, 0, 0.008]}>
            <planeGeometry args={[1.44, 0.94]} />
            <meshStandardMaterial map={cardTextures[1]} roughness={0.32} />
          </mesh>
        </group>
      </Float>

      <Float speed={1.5} rotationIntensity={0.09} floatIntensity={0.18}>
        <group position={[1.98, 1.48, -0.78]} rotation={[-0.04, -0.26, -0.03]} scale={0.82}>
          <mesh geometry={geometries.cardGlassGeo} position={[0, 0, -0.025]}>
            <meshPhysicalMaterial
              color="#DCE6E0"
              transmission={enableGlassTransmission ? 0.65 : 0}
              transparent
              opacity={enableGlassTransmission ? 0.9 : 0.4}
              ior={1.48}
              thickness={0.16}
              roughness={0.14}
              clearcoat={1.0}
            />
          </mesh>
          <mesh geometry={geometries.cardFrameGeo} position={[0, 0, -0.015]}>
            <meshPhysicalMaterial color="#C6A24B" metalness={0.9} roughness={0.24} />
          </mesh>
          <mesh position={[0, 0, 0.008]}>
            <planeGeometry args={[1.44, 0.94]} />
            <meshStandardMaterial map={cardTextures[2]} roughness={0.32} />
          </mesh>
        </group>
      </Float>

      {/* 3. Composite Rounded Smartphone (6+ Distinct Parts) */}
      <group ref={phoneGroupRef} position={[1.88, 0.08, 0.68]}>
        {/* Champagne Titanium Unibody */}
        <mesh geometry={geometries.phoneBodyGeo}>
          <meshPhysicalMaterial
            color="#D6B25E"
            metalness={0.94}
            roughness={0.2}
            roughnessMap={brushedMetalTex}
            clearcoat={0.6}
            envMapIntensity={1.6}
          />
        </mesh>
        {/* Front Obsidian Glass Bezel */}
        <mesh geometry={geometries.phoneScreenBezelGeo} position={[0, 0, 0.056]}>
          <meshPhysicalMaterial color="#0D0F0E" roughness={0.12} metalness={0.3} clearcoat={1.0} />
        </mesh>
        {/* Live Scrolling Feed Screen */}
        <mesh position={[0, 0, 0.065]}>
          <planeGeometry args={[0.78, 1.66]} />
          <meshStandardMaterial
            map={phoneFeed.texture}
            roughness={0.22}
            emissive="#FFFFFF"
            emissiveMap={phoneFeed.texture}
            emissiveIntensity={0.22}
          />
        </mesh>
        {/* Dynamic Island Cutout */}
        <mesh geometry={geometries.phoneIslandGeo} position={[0, 0.75, 0.066]}>
          <meshStandardMaterial color="#050606" roughness={0.3} />
        </mesh>
        {/* Rear Camera Island */}
        <mesh geometry={geometries.cameraBumpGeo} position={[-0.22, 0.64, -0.062]}>
          <meshPhysicalMaterial color="#181A18" metalness={0.78} roughness={0.25} clearcoat={0.7} />
        </mesh>
        {/* Dual Rear Sapphire Lenses */}
        {[-0.08, 0.08].map((ly, idx) => (
          <group key={idx} position={[-0.22, 0.64 + ly, -0.084]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.055, 0.055, 0.018, 24]} />
              <meshPhysicalMaterial color="#C6A24B" metalness={0.95} roughness={0.18} />
            </mesh>
            <mesh position={[0, 0, -0.008]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.036, 0.036, 0.01, 20]} />
              <meshPhysicalMaterial color="#122C38" metalness={0.4} roughness={0.05} clearcoat={1.0} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 4. Composite 3D Analytics Bars on Architectural Plinth */}
      <group ref={barsGroupRef} position={[0.1, -1.68, -0.22]}>
        {barBaseHeights.map((baseH, idx) => (
          <group
            key={idx}
            ref={(el) => {
              barGroupRefs.current[idx] = el;
            }}
            position={[-0.76 + idx * 0.38, 0, 0]}
          >
            <mesh geometry={geometries.barUnitGeo} scale={[1, baseH, 1]}>
              <meshPhysicalMaterial
                color={barColors[idx]}
                metalness={idx === 2 || idx === 4 ? 0.88 : 0.4}
                roughness={0.22}
                clearcoat={0.6}
              />
            </mesh>
            {/* Glowing Accent Cap */}
            <mesh position={[0, baseH + 0.015, 0]}>
              <boxGeometry args={[0.21, 0.02, 0.21]} />
              <meshStandardMaterial
                color="#F2D98A"
                emissive={idx === 2 || idx === 4 ? '#E2C374' : '#34D399'}
                emissiveIntensity={1.25}
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* 5. Sparse Floating Champagne Gold Dust */}
      <points ref={dustPointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={dustSprite}
          size={0.095}
          sizeAttenuation
          transparent
          opacity={0.78}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          color="#F2D98A"
        />
      </points>
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* Exported Lazy-Ready Hero 3D Component with Mobile & Fallback Modes         */
/* -------------------------------------------------------------------------- */
export default function HeroSceneR3F({
  name3D = 'Shabbir Mahamud',
  accentColor = '#1B5E4A',
  ownerName = 'Shabbir Mahamud',
}: HeroSceneR3FProps) {
  const [caps, setCaps] = useState(() => detectWebGLCapabilities());
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    const refresh = () => setCaps(detectWebGLCapabilities());
    window.addEventListener('resize', refresh);
    return () => window.removeEventListener('resize', refresh);
  }, []);

  const resolvedName = name3D && name3D.trim() ? name3D.trim() : 'Shabbir Mahamud';
  const fallbackHeadline =
    resolvedName.toLowerCase() === 'shabbir mahamud' ? 'Shabbir' : resolvedName;

  if (!caps.webglSupported || contextLost || caps.reducedMotion) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-[#141816] via-[#181D1A] to-[#0F1210] text-center">
        <div className="border border-[#C6A24B]/45 bg-[#1B211E]/95 rounded-2xl px-8 py-7 max-w-sm shadow-lg">
          <p className="text-[11px] font-mono-tabular uppercase tracking-widest text-[#E2C374]">
            Creative Spatial Identity
          </p>
          <p className="text-4xl font-display font-extrabold tracking-tight text-[#F7F5F0] mt-2">
            {fallbackHeadline}
          </p>
          <p className="text-xs text-[#C7CCC6] mt-2.5 leading-relaxed">
            {ownerName} · Social Strategy, AI Automation &amp; Analytics
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-[#111412]" data-cursor="Explore">
      <Canvas
        dpr={[1, caps.isLowPower ? 1 : 2]}
        camera={{ position: [0, 0.22, 6.35], fov: 40, near: 0.1, far: 60 }}
        gl={{
          antialias: !caps.isLowPower,
          powerPreference: 'high-performance',
          alpha: false,
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.12;
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            setContextLost(true);
          });
        }}
      >
        <SpatialStage
          name3D={resolvedName}
          accentColor={accentColor}
          ownerName={ownerName}
          isLowPower={caps.isLowPower}
          isSoftwareRenderer={caps.isSoftwareRenderer}
        />

        {/* Post-processing enabled on capable desktop GPUs only */}
        {!caps.isLowPower && !caps.isSoftwareRenderer && (
          <EffectComposer multisampling={0}>
            <Bloom
              intensity={0.36}
              luminanceThreshold={0.86}
              luminanceSmoothing={0.32}
              mipmapBlur
            />
            <DepthOfField
              focusDistance={0.018}
              focalLength={0.052}
              bokehScale={1.25}
            />
            <Noise opacity={0.018} />
          </EffectComposer>
        )}
      </Canvas>

      <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] font-mono-tabular text-[#D7D2C6]/80">
        <span>3D Studio Scene · {resolvedName}</span>
        <span>Move Pointer &amp; Scroll</span>
      </div>
    </div>
  );
}
