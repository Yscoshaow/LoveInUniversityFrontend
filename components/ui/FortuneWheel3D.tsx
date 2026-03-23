import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';

interface WheelSegment {
  type: string;
  value: number;
  color: string;
  label: string;
}

interface FortuneWheel3DProps {
  segments: WheelSegment[];
  isSpinning: boolean;
  targetRotation?: number;
  onSpinComplete?: () => void;
}

// Default segments - using consistent pink/rose theme
const DEFAULT_SEGMENTS: WheelSegment[] = [
  { type: 'ADD_TIME', value: 30, color: '#f43f5e', label: '+30分' },
  { type: 'REMOVE_TIME', value: 15, color: '#10b981', label: '-15分' },
  { type: 'NOTHING', value: 0, color: '#94a3b8', label: '无' },
  { type: 'ADD_TIME', value: 60, color: '#e11d48', label: '+60分' },
  { type: 'FREEZE', value: 30, color: '#8b5cf6', label: '冻结' },
  { type: 'REMOVE_TIME', value: 30, color: '#059669', label: '-30分' },
  { type: 'DICE_ROLL', value: 0, color: '#ec4899', label: '骰子' },
  { type: 'DOUBLE_OR_NOTHING', value: 0, color: '#a855f7', label: '双倍' }
];

export const FortuneWheel3D: React.FC<FortuneWheel3DProps> = ({
  segments,
  isSpinning,
  targetRotation = 0,
  onSpinComplete
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const wheelRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const spinAnimationRef = useRef<number | null>(null);
  const currentRotationRef = useRef(0);
  const initializedRef = useRef(false);

  // Memoize segments
  const wheelSegments = useMemo(() => {
    return segments.length > 0 ? segments : DEFAULT_SEGMENTS;
  }, [segments]);

  // Initialize and animate
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Wait for container to have dimensions
    const initScene = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;

      if (width === 0 || height === 0) {
        // Retry after a short delay
        requestAnimationFrame(initScene);
        return;
      }

      if (initializedRef.current) return;
      initializedRef.current = true;

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xfff1f2);
      sceneRef.current = scene;

      // Camera
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.set(0, 0, 5);
      cameraRef.current = camera;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Lighting
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(5, 5, 5);
      scene.add(dirLight);

      // Wheel group
      const wheel = new THREE.Group();
      wheelRef.current = wheel;
      scene.add(wheel);

      // Build segments
      const segmentCount = wheelSegments.length;
      const segmentAngle = (Math.PI * 2) / segmentCount;

      for (let i = 0; i < segmentCount; i++) {
        const seg = wheelSegments[i];

        // Segment
        const geo = new THREE.CircleGeometry(1.8, 32, i * segmentAngle, segmentAngle);
        const mat = new THREE.MeshPhongMaterial({
          color: new THREE.Color(seg.color),
          side: THREE.DoubleSide,
          shininess: 30
        });
        wheel.add(new THREE.Mesh(geo, mat));

        // Border
        const borderGeo = new THREE.BufferGeometry();
        const pts = [new THREE.Vector3(0, 0, 0.01)];
        for (let j = 0; j <= 32; j++) {
          const a = i * segmentAngle + (j / 32) * segmentAngle;
          pts.push(new THREE.Vector3(Math.cos(a) * 1.8, Math.sin(a) * 1.8, 0.01));
        }
        pts.push(new THREE.Vector3(0, 0, 0.01));
        borderGeo.setFromPoints(pts);
        wheel.add(new THREE.Line(borderGeo, new THREE.LineBasicMaterial({ color: 0xffffff })));

        // Label
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(seg.label, 64, 32);

        const tex = new THREE.CanvasTexture(canvas);
        const labelMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(0.6, 0.3),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
        );
        const la = i * segmentAngle + segmentAngle / 2;
        labelMesh.position.set(Math.cos(la) * 1.2, Math.sin(la) * 1.2, 0.02);
        labelMesh.rotation.z = la - Math.PI / 2;
        wheel.add(labelMesh);
      }

      // Center
      const center = new THREE.Mesh(
        new THREE.CircleGeometry(0.3, 32),
        new THREE.MeshPhongMaterial({ color: 0xfb7185, side: THREE.DoubleSide, shininess: 60 })
      );
      center.position.z = 0.03;
      wheel.add(center);

      const innerCenter = new THREE.Mesh(
        new THREE.CircleGeometry(0.15, 32),
        new THREE.MeshPhongMaterial({ color: 0xfda4af, side: THREE.DoubleSide, shininess: 80 })
      );
      innerCenter.position.z = 0.04;
      wheel.add(innerCenter);

      // Outer ring
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.78, 1.92, 64),
        new THREE.MeshPhongMaterial({ color: 0x334155, side: THREE.DoubleSide })
      );
      ring.position.z = 0.01;
      wheel.add(ring);

      // Glow ring
      const glowRing = new THREE.Mesh(
        new THREE.RingGeometry(1.92, 1.98, 64),
        new THREE.MeshPhongMaterial({ color: 0xfb7185, side: THREE.DoubleSide, emissive: 0xfb7185, emissiveIntensity: 0.3 })
      );
      glowRing.position.z = 0.01;
      wheel.add(glowRing);

      // Pointer
      const pointer = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.35, 3),
        new THREE.MeshPhongMaterial({ color: 0xf43f5e, shininess: 50 })
      );
      pointer.position.set(0, 2.15, 0.1);
      pointer.rotation.z = Math.PI;
      scene.add(pointer);

      const pointerBase = new THREE.Mesh(
        new THREE.CircleGeometry(0.12, 16),
        new THREE.MeshPhongMaterial({ color: 0xe11d48, shininess: 30 })
      );
      pointerBase.position.set(0, 2.0, 0.08);
      scene.add(pointerBase);

      // Animation loop
      const animate = () => {
        animationFrameRef.current = requestAnimationFrame(animate);
        if (wheelRef.current && !spinAnimationRef.current) {
          wheelRef.current.rotation.z += Math.sin(Date.now() * 0.001) * 0.0005;
        }
        renderer.render(scene, camera);
      };
      animate();

      // Resize
      const handleResize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    };

    initScene();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (spinAnimationRef.current) cancelAnimationFrame(spinAnimationRef.current);
      if (rendererRef.current && container.contains(rendererRef.current.domElement)) {
        container.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
      initializedRef.current = false;
    };
  }, [wheelSegments]);

  // Spin animation - separate from initialization
  useEffect(() => {
    if (!isSpinning || !wheelRef.current || targetRotation === 0) return;

    // Cancel any existing animation
    if (spinAnimationRef.current) {
      cancelAnimationFrame(spinAnimationRef.current);
      spinAnimationRef.current = null;
    }

    const startRot = currentRotationRef.current;
    const targetRad = (targetRotation * Math.PI) / 180;
    const duration = 4000;
    const startTime = Date.now();
    let animationCompleted = false;

    const spinAnimate = () => {
      if (animationCompleted) return;

      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const newRot = startRot + targetRad * eased;

      if (wheelRef.current) {
        wheelRef.current.rotation.z = newRot;
      }

      if (progress < 1) {
        spinAnimationRef.current = requestAnimationFrame(spinAnimate);
      } else {
        // Animation complete
        animationCompleted = true;
        currentRotationRef.current = newRot;
        spinAnimationRef.current = null;
        // Use setTimeout to ensure state update happens after render
        setTimeout(() => {
          onSpinComplete?.();
        }, 100);
      }
    };

    spinAnimationRef.current = requestAnimationFrame(spinAnimate);

    return () => {
      animationCompleted = true;
      if (spinAnimationRef.current) {
        cancelAnimationFrame(spinAnimationRef.current);
        spinAnimationRef.current = null;
      }
    };
  }, [isSpinning, targetRotation, onSpinComplete]);

  return (
    <div
      ref={containerRef}
      className="w-full h-64 rounded-2xl overflow-hidden bg-rose-50 dark:bg-rose-950"
      style={{ touchAction: 'none', minHeight: '256px' }}
    />
  );
};

export default FortuneWheel3D;
