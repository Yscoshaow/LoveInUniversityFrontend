import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

interface DiceResult {
  systemRolls: number[];
  userRolls: number[];
  systemTotal: number;
  userTotal: number;
  resultType: 'WIN' | 'LOSE' | 'TIE';
}

interface Dice3DProps {
  isRolling: boolean;
  diceCount?: number;
  result?: DiceResult;
  onRollComplete?: () => void;
}

// Dice face rotations
const DICE_ROTATIONS: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: Math.PI / 2 },
  3: { x: -Math.PI / 2, y: 0 },
  4: { x: Math.PI / 2, y: 0 },
  5: { x: 0, y: -Math.PI / 2 },
  6: { x: Math.PI, y: 0 }
};

export const Dice3D: React.FC<Dice3DProps> = ({
  isRolling,
  diceCount = 1,
  result,
  onRollComplete
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const systemDiceRef = useRef<THREE.Mesh[]>([]);
  const userDiceRef = useRef<THREE.Mesh[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const rollAnimationRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  // Create dice texture
  const createDiceTexture = useCallback((face: number, color: string, isSystem: boolean) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 256, 256);

    // Background with rounded corners
    const cornerRadius = 32;
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 240, cornerRadius);
    ctx.closePath();

    // Gradient
    const gradient = ctx.createLinearGradient(0, 0, 256, 256);
    if (isSystem) {
      gradient.addColorStop(0, '#fda4af');
      gradient.addColorStop(0.5, color);
      gradient.addColorStop(1, '#be123c');
    } else {
      gradient.addColorStop(0, '#c4b5fd');
      gradient.addColorStop(0.5, color);
      gradient.addColorStop(1, '#6d28d9');
    }
    ctx.fillStyle = gradient;
    ctx.fill();

    // Inner glow
    ctx.beginPath();
    ctx.roundRect(16, 16, 224, 224, cornerRadius - 4);
    ctx.closePath();
    const innerGradient = ctx.createLinearGradient(0, 0, 256, 256);
    innerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    innerGradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
    ctx.fillStyle = innerGradient;
    ctx.fill();

    // Border
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 240, cornerRadius);
    ctx.closePath();
    ctx.strokeStyle = isSystem ? '#9f1239' : '#5b21b6';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Dots
    const dotRadius = 18;
    const positions: Record<number, [number, number][]> = {
      1: [[128, 128]],
      2: [[64, 64], [192, 192]],
      3: [[64, 64], [128, 128], [192, 192]],
      4: [[64, 64], [192, 64], [64, 192], [192, 192]],
      5: [[64, 64], [192, 64], [128, 128], [64, 192], [192, 192]],
      6: [[64, 64], [192, 64], [64, 128], [192, 128], [64, 192], [192, 192]]
    };

    positions[face].forEach(([x, y]) => {
      // Shadow
      ctx.beginPath();
      ctx.arc(x + 2, y + 2, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fill();

      // Main dot
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Highlight
      ctx.beginPath();
      ctx.arc(x - 4, y - 4, dotRadius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fill();
    });

    return new THREE.CanvasTexture(canvas);
  }, []);

  // Create dice mesh
  const createDice = useCallback((isSystem: boolean) => {
    const geometry = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
    const color = isSystem ? '#fb7185' : '#a78bfa';

    const materials = [
      new THREE.MeshPhongMaterial({ map: createDiceTexture(2, color, isSystem), shininess: 80 }),
      new THREE.MeshPhongMaterial({ map: createDiceTexture(5, color, isSystem), shininess: 80 }),
      new THREE.MeshPhongMaterial({ map: createDiceTexture(3, color, isSystem), shininess: 80 }),
      new THREE.MeshPhongMaterial({ map: createDiceTexture(4, color, isSystem), shininess: 80 }),
      new THREE.MeshPhongMaterial({ map: createDiceTexture(1, color, isSystem), shininess: 80 }),
      new THREE.MeshPhongMaterial({ map: createDiceTexture(6, color, isSystem), shininess: 80 })
    ];

    const dice = new THREE.Mesh(geometry, materials);
    dice.castShadow = true;
    dice.receiveShadow = true;
    return dice;
  }, [createDiceTexture]);

  // Initialize scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initScene = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;

      if (width === 0 || height === 0) {
        requestAnimationFrame(initScene);
        return;
      }

      if (initializedRef.current) return;
      initializedRef.current = true;

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf5f3ff);

      // Camera
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.set(0, 3, 5);
      camera.lookAt(0, 0, 0);

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Lighting
      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(5, 10, 5);
      dirLight.castShadow = true;
      scene.add(dirLight);

      // Floor
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.MeshPhongMaterial({ color: 0x4c1d95, shininess: 50 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.5;
      floor.receiveShadow = true;
      scene.add(floor);

      // Floor glow
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 6),
        new THREE.MeshBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.3 })
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = -0.49;
      scene.add(glow);

      // Create dice
      systemDiceRef.current = [];
      for (let i = 0; i < diceCount; i++) {
        const dice = createDice(true);
        dice.position.set(-1.5 + i * 0.3, 0, 0);
        scene.add(dice);
        systemDiceRef.current.push(dice);
      }

      userDiceRef.current = [];
      for (let i = 0; i < diceCount; i++) {
        const dice = createDice(false);
        dice.position.set(1.5 + i * 0.3, 0, 0);
        scene.add(dice);
        userDiceRef.current.push(dice);
      }

      // Labels
      const createLabel = (text: string, position: THREE.Vector3, isSystem: boolean) => {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 80;
        const ctx = canvas.getContext('2d')!;

        ctx.beginPath();
        ctx.roundRect(10, 10, 140, 60, 16);
        ctx.fillStyle = isSystem ? 'rgba(251, 113, 133, 0.9)' : 'rgba(167, 139, 250, 0.9)';
        ctx.fill();

        ctx.strokeStyle = isSystem ? '#e11d48' : '#7c3aed';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 80, 42);

        const texture = new THREE.CanvasTexture(canvas);
        const label = new THREE.Mesh(
          new THREE.PlaneGeometry(1.2, 0.6),
          new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
        );
        label.position.copy(position);
        label.rotation.x = -Math.PI / 4;
        scene.add(label);
      };

      createLabel('系统', new THREE.Vector3(-1.5, -0.3, 1.2), true);
      createLabel('你', new THREE.Vector3(1.5, -0.3, 1.2), false);

      // Animation loop
      const animate = () => {
        animationFrameRef.current = requestAnimationFrame(animate);

        // Idle floating
        if (!rollAnimationRef.current) {
          const time = Date.now() * 0.001;
          systemDiceRef.current.forEach((dice, i) => {
            dice.position.y = Math.sin(time * 2 + i) * 0.1;
            dice.rotation.x += 0.001;
            dice.rotation.y += 0.001;
          });
          userDiceRef.current.forEach((dice, i) => {
            dice.position.y = Math.sin(time * 2 + i + 1) * 0.1;
            dice.rotation.x += 0.001;
            dice.rotation.y += 0.001;
          });
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
      if (rollAnimationRef.current) cancelAnimationFrame(rollAnimationRef.current);
      if (rendererRef.current && container.contains(rendererRef.current.domElement)) {
        container.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
      initializedRef.current = false;
    };
  }, [diceCount, createDice]);

  // Roll animation
  useEffect(() => {
    if (!isRolling || !result) return;

    // Cancel any existing animation
    if (rollAnimationRef.current) {
      cancelAnimationFrame(rollAnimationRef.current);
      rollAnimationRef.current = null;
    }

    let animationCompleted = false;

    const rollDice = (
      diceArray: THREE.Mesh[],
      targetValues: number[],
      onComplete: () => void
    ) => {
      if (animationCompleted || diceArray.length === 0) {
        onComplete();
        return;
      }

      const duration = 1500;
      const startTime = Date.now();
      const startRotations = diceArray.map(d => ({ x: d.rotation.x, y: d.rotation.y, z: d.rotation.z }));
      const startPositions = diceArray.map(d => ({ x: d.position.x, y: d.position.y, z: d.position.z }));

      const animateRoll = () => {
        if (animationCompleted) return;

        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        diceArray.forEach((dice, i) => {
          const target = DICE_ROTATIONS[targetValues[i] || 1];
          const spinFactor = (1 - eased) * 20;
          dice.rotation.x = startRotations[i].x + target.x * eased + spinFactor;
          dice.rotation.y = startRotations[i].y + target.y * eased + spinFactor * 0.7;
          // Use absolute value to prevent going below 0, and add base height
          const bounceHeight = Math.abs(Math.sin(progress * Math.PI * 3)) * (1 - progress) * 1.2;
          dice.position.y = Math.max(0, bounceHeight);
        });

        if (progress < 1) {
          rollAnimationRef.current = requestAnimationFrame(animateRoll);
        } else {
          // Animation complete - set final positions
          diceArray.forEach((dice, i) => {
            const target = DICE_ROTATIONS[targetValues[i] || 1];
            dice.rotation.x = target.x;
            dice.rotation.y = target.y;
            dice.position.y = 0;
          });
          onComplete();
        }
      };

      rollAnimationRef.current = requestAnimationFrame(animateRoll);
    };

    // Roll system dice first, then user dice
    rollDice(systemDiceRef.current, result.systemRolls, () => {
      if (animationCompleted) return;
      setTimeout(() => {
        if (animationCompleted) return;
        rollDice(userDiceRef.current, result.userRolls, () => {
          if (animationCompleted) return;
          rollAnimationRef.current = null;
          // Use setTimeout to ensure state update happens after render
          setTimeout(() => {
            onRollComplete?.();
          }, 100);
        });
      }, 300);
    });

    return () => {
      animationCompleted = true;
      if (rollAnimationRef.current) {
        cancelAnimationFrame(rollAnimationRef.current);
        rollAnimationRef.current = null;
      }
    };
  }, [isRolling, result, onRollComplete]);

  return (
    <div
      ref={containerRef}
      className="w-full h-64 rounded-2xl overflow-hidden bg-violet-50 dark:bg-violet-950"
      style={{ touchAction: 'none', minHeight: '256px' }}
    />
  );
};

export default Dice3D;
