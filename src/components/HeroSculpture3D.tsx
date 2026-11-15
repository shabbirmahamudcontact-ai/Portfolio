import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

interface HeroSculpture3DProps {
  accentColor?: string;
}

export function HeroSculpture3D({ accentColor = '#1B5E4A' }: HeroSculpture3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fallbackActive, setFallbackActive] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Detect software WebGL cleanly via GPU renderer string
    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2') || probe.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param) || '');
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setFallbackActive(true);
      return;
    }

    const width = container.clientWidth || 560;
    const height = container.clientHeight || 560;

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(canvas);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setFallbackActive(true);
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xf7f5f0, 0.035);

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 50);
    camera.position.set(0, 0.65, 6.2);
    camera.lookAt(0, 0.1, 0);

    // Procedural Studio IBL Environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    // 3-Point Warm/Cool Architectural Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xfaf8f4, 0x2c302e, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.2);
    keyLight.position.set(4.5, 6.0, 5.0);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 20;
      keyLight.shadow.camera.left = -3.5;
      keyLight.shadow.camera.right = 3.5;
      keyLight.shadow.camera.top = 3.5;
      keyLight.shadow.camera.bottom = -3.5;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xd9ece5, 1.3);
    rimLight.position.set(-4.5, 2.5, -4.0);
    scene.add(rimLight);

    // Contact shadow plane using procedural radial CanvasTexture
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const sCtx = shadowCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(128, 128, 12, 128, 128, 122);
      grad.addColorStop(0, 'rgba(24, 26, 24, 0.28)');
      grad.addColorStop(0.5, 'rgba(24, 26, 24, 0.10)');
      grad.addColorStop(1, 'rgba(24, 26, 24, 0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 256, 256);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    shadowTex.colorSpace = THREE.SRGBColorSpace;
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 4.4),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.65;
    scene.add(shadowPlane);

    // Composite 8-Part Kinetic Architectural Sculpture (THREE.Group)
    const sculpture = new THREE.Group();
    scene.add(sculpture);

    const disposableGeometries: THREE.BufferGeometry[] = [];
    const disposableMaterials: THREE.Material[] = [];

    const parsedAccent = new THREE.Color(accentColor || '#1B5E4A');

    // Materials with varied roughness >= 0.25 contrast
    const charcoalMetal = new THREE.MeshPhysicalMaterial({
      color: 0x1e211f,
      metalness: 0.9,
      roughness: 0.24,
      clearcoat: 0.25,
    });
    const travertineMat = new THREE.MeshStandardMaterial({
      color: 0xeae5db,
      metalness: 0.05,
      roughness: 0.72,
    });
    const emeraldCoreMat = new THREE.MeshPhysicalMaterial({
      color: parsedAccent,
      metalness: 0.12,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      ior: 1.58,
    });
    const brassTrimMat = new THREE.MeshPhysicalMaterial({
      color: 0xc2a878,
      metalness: 0.94,
      roughness: 0.18,
    });
    disposableMaterials.push(charcoalMetal, travertineMat, emeraldCoreMat, brassTrimMat);

    // 1. Grounded Architectural Pedestal Base (LatheGeometry)
    const lathePoints = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(1.05, 0.0),
      new THREE.Vector2(1.05, 0.14),
      new THREE.Vector2(0.88, 0.2),
      new THREE.Vector2(0.78, 0.28),
      new THREE.Vector2(0.0, 0.28),
    ];
    const baseGeo = new THREE.LatheGeometry(lathePoints, 48);
    disposableGeometries.push(baseGeo);
    const baseMesh = new THREE.Mesh(baseGeo, travertineMat);
    baseMesh.position.y = -1.62;
    baseMesh.receiveShadow = true;
    baseMesh.castShadow = true;
    sculpture.add(baseMesh);

    // 2. Vertical Precision Axis Column
    const axisGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.35, 20);
    disposableGeometries.push(axisGeo);
    const axisMesh = new THREE.Mesh(axisGeo, brassTrimMat);
    axisMesh.position.y = -0.95;
    axisMesh.castShadow = true;
    sculpture.add(axisMesh);

    // 3. Primary Outer Charcoal Gyroscopic Frame
    const outerRingGeo = new THREE.TorusGeometry(1.38, 0.065, 24, 96);
    disposableGeometries.push(outerRingGeo);
    const outerRing = new THREE.Mesh(outerRingGeo, charcoalMetal);
    outerRing.rotation.set(0.32, -0.25, 0.15);
    outerRing.position.y = 0.22;
    outerRing.castShadow = true;
    sculpture.add(outerRing);

    // 4. Secondary Brass Precision Ring
    const innerRingGeo = new THREE.TorusGeometry(1.02, 0.028, 20, 84);
    disposableGeometries.push(innerRingGeo);
    const innerRing = new THREE.Mesh(innerRingGeo, brassTrimMat);
    innerRing.rotation.set(-0.55, 0.42, 0.2);
    innerRing.position.y = 0.22;
    innerRing.castShadow = true;
    sculpture.add(innerRing);

    // 5. Central Emerald Faceted Core
    const coreGroup = new THREE.Group();
    coreGroup.position.y = 0.22;
    sculpture.add(coreGroup);

    const coreGeo = new THREE.OctahedronGeometry(0.56, 0);
    disposableGeometries.push(coreGeo);
    const coreMesh = new THREE.Mesh(coreGeo, emeraldCoreMat);
    coreMesh.castShadow = true;
    coreGroup.add(coreMesh);

    // 6. Wireframe Architectural Cage around Core
    const cageGeo = new THREE.IcosahedronGeometry(0.78, 0);
    disposableGeometries.push(cageGeo);
    const cageEdges = new THREE.EdgesGeometry(cageGeo);
    disposableGeometries.push(cageEdges);
    const cageLines = new THREE.LineSegments(
      cageEdges,
      new THREE.LineBasicMaterial({ color: 0x181a18, transparent: true, opacity: 0.35 })
    );
    disposableMaterials.push(cageLines.material as THREE.Material);
    coreGroup.add(cageLines);

    // 7 & 8. Three Floating Geometric Calibration Prisms
    const satelliteGroup = new THREE.Group();
    satelliteGroup.position.y = 0.22;
    sculpture.add(satelliteGroup);

    const prismGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    disposableGeometries.push(prismGeo);
    const satelliteOffsets: Array<[number, number, number]> = [
      [1.38, 0.22, 0.1],
      [-1.12, -0.45, 0.65],
      [0.35, 1.15, -0.58],
    ];
    const satellites: THREE.Mesh[] = [];
    satelliteOffsets.forEach(([x, y, z], idx) => {
      const mat = idx === 1 ? emeraldCoreMat : idx === 2 ? travertineMat : charcoalMetal;
      const sat = new THREE.Mesh(prismGeo, mat);
      sat.position.set(x, y, z);
      sat.rotation.set(idx * 0.6, idx * 0.9, 0.3);
      sat.castShadow = true;
      satelliteGroup.add(sat);
      satellites.push(sat);
    });

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Mouse & Scroll Interaction Targets
    const targetPointer = { x: 0, y: 0 };
    const currentPointer = { x: 0, y: 0 };
    let scrollFactor = 0;

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      targetPointer.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      targetPointer.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };

    const onScroll = () => {
      scrollFactor = Math.min(window.scrollY / 600, 1.5);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 560;
      const h = container.clientHeight || 560;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const animate = () => {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      currentPointer.x = THREE.MathUtils.damp(currentPointer.x, targetPointer.x, 4.5, delta);
      currentPointer.y = THREE.MathUtils.damp(currentPointer.y, targetPointer.y, 4.5, delta);

      const motionScale = prefersReducedMotion ? 0 : 1;

      sculpture.rotation.y = currentPointer.x * 0.35 + scrollFactor * 0.45 + elapsed * 0.14 * motionScale;
      sculpture.rotation.x = currentPointer.y * 0.18;

      outerRing.rotation.z = 0.15 + elapsed * 0.18 * motionScale;
      innerRing.rotation.x = -0.55 + elapsed * -0.24 * motionScale;
      coreGroup.rotation.y = elapsed * -0.28 * motionScale;
      coreGroup.position.y = 0.22 + Math.sin(elapsed * 1.4) * 0.06 * motionScale;
      satelliteGroup.rotation.y = elapsed * 0.22 * motionScale;

      satellites.forEach((sat, idx) => {
        sat.rotation.x += delta * (0.4 + idx * 0.15) * motionScale;
        sat.rotation.y += delta * (0.3 + idx * 0.1) * motionScale;
      });

      renderer.render(scene, camera);

      if (prefersReducedMotion) {
        return; // Render crisp initial frame once
      }
      if (isSoftwareGl) {
        afterDraw(animate);
      } else {
        frameId = requestAnimationFrame(animate);
      }
    };

    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('webglcontextlost', handleContextLost);

      disposableGeometries.forEach((g) => g.dispose());
      disposableMaterials.forEach((m) => m.dispose());
      shadowPlane.geometry.dispose();
      (shadowPlane.material as THREE.Material).dispose();
      shadowTex.dispose();
      envTexture.dispose();
      renderer.dispose();
    };
  }, [accentColor]);

  if (fallbackActive) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#EFECE6] rounded-2xl border border-[#E0DDD5] p-8">
        <div className="text-center max-w-xs">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full border-2 border-[#1B5E4A] flex items-center justify-center">
            <div className="w-8 h-8 rotate-45 bg-[#1B5E4A]" />
          </div>
          <p className="text-sm font-medium text-[#181A18]">Creative Systems Architecture</p>
          <p className="text-xs text-[#5A5E58] mt-1">Design · Video · Web · AI Automation</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[380px] lg:min-h-[520px] relative select-none"
      aria-label="Interactive 3D architectural sculpture"
    />
  );
}
