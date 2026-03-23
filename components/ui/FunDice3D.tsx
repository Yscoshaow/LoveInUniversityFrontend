import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as CANNON from 'cannon-es';

interface FunDice3DProps {
  onRollComplete: (playerDice: number, systemDice: number) => void;
  disabled?: boolean;
}

// 骰子面法向量对应的点数
const FACE_NORMALS = [
  new THREE.Vector3(1, 0, 0),  // +x -> 1
  new THREE.Vector3(-1, 0, 0), // -x -> 6
  new THREE.Vector3(0, 1, 0),  // +y -> 2
  new THREE.Vector3(0, -1, 0), // -y -> 5
  new THREE.Vector3(0, 0, 1),  // +z -> 3
  new THREE.Vector3(0, 0, -1)  // -z -> 4
];
const FACE_VALUES = [1, 6, 2, 5, 3, 4];

// 颜色配置
const COLORS = {
  player: '#a78bfa',      // 紫色 - 玩家
  system: '#fb7185',      // 粉红 - 系统
  outline: '#725349',     // 描边颜色
  shadow: '#F3BD2E',      // 阴影颜色
  background: '#F6F3EB',  // 背景色
  dots: '#FFFFFF'         // 点数颜色
};

interface DiceObject {
  mesh: THREE.Mesh;
  outline: THREE.Mesh;
  shadow: THREE.Mesh;
  body: CANNON.Body;
  spinOffset: number;
  isReturning: boolean;
  isPlayer: boolean;
}

export const FunDice3D: React.FC<FunDice3DProps> = ({ onRollComplete, disabled = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const worldRef = useRef<CANNON.World | null>(null);
  const diceObjectsRef = useRef<DiceObject[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  const isHoldingRef = useRef(false);
  const needsResultCheckRef = useRef(false);
  const mouseRef = useRef(new THREE.Vector2());
  const raycasterRef = useRef(new THREE.Raycaster());
  const dragPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -12));
  const disabledRef = useRef(disabled);

  const [isRolling, setIsRolling] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [result, setResult] = useState<{ player: number; system: number } | null>(null);
  const hasCalledBackRef = useRef(false);
  const onRollCompleteRef = useRef(onRollComplete);

  // Keep refs in sync
  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    onRollCompleteRef.current = onRollComplete;
  }, [onRollComplete]);

  // 创建骰子贴图
  const createDiceTexture = useCallback((faceNumber: number, colorHex: string) => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // 背景色
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, size, size);

    // 点数位置
    const dotSize = size / 5;
    const center = size / 2;
    const q1 = size / 4;
    const q3 = (size * 3) / 4;

    ctx.fillStyle = COLORS.dots;

    const drawDot = (x: number, y: number) => {
      ctx.beginPath();
      ctx.arc(x, y, dotSize / 2, 0, Math.PI * 2);
      ctx.fill();
    };

    // 根据点数绘制圆点
    if (faceNumber === 1) drawDot(center, center);
    else if (faceNumber === 2) { drawDot(q1, q1); drawDot(q3, q3); }
    else if (faceNumber === 3) { drawDot(q1, q1); drawDot(center, center); drawDot(q3, q3); }
    else if (faceNumber === 4) { drawDot(q1, q1); drawDot(q3, q1); drawDot(q1, q3); drawDot(q3, q3); }
    else if (faceNumber === 5) { drawDot(q1, q1); drawDot(q3, q1); drawDot(center, center); drawDot(q1, q3); drawDot(q3, q3); }
    else if (faceNumber === 6) { drawDot(q1, q1); drawDot(q3, q1); drawDot(q1, center); drawDot(q3, center); drawDot(q1, q3); drawDot(q3, q3); }

    return new THREE.CanvasTexture(canvas);
  }, []);

  // 创建骰子
  const createDice = useCallback((isPlayer: boolean, world: CANNON.World, scene: THREE.Scene, startX: number) => {
    const boxSize = 2.5;
    const colorHex = isPlayer ? COLORS.player : COLORS.system;

    // 圆角骰子几何体
    const geometry = new RoundedBoxGeometry(boxSize, boxSize, boxSize, 4, 0.4);

    // 六面材质
    const materials = [];
    for (let j = 1; j <= 6; j++) {
      materials.push(new THREE.MeshBasicMaterial({ map: createDiceTexture(j, colorHex) }));
    }
    // 调整材质顺序以匹配 Cube UV
    const matArray = [
      materials[0], materials[5], materials[1],
      materials[4], materials[2], materials[3]
    ];

    const mesh = new THREE.Mesh(geometry, matArray);
    scene.add(mesh);

    // 描边效果
    const outlineMat = new THREE.MeshBasicMaterial({ color: COLORS.outline, side: THREE.BackSide });
    const outline = new THREE.Mesh(geometry.clone(), outlineMat);
    outline.scale.setScalar(1.06);
    scene.add(outline);

    // 阴影
    const shadowGeo = new THREE.CircleGeometry(boxSize * 0.6, 32);
    const shadowMat = new THREE.MeshBasicMaterial({ color: COLORS.shadow, transparent: true, opacity: 0.2 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    scene.add(shadow);

    // 物理体 - 初始位置在地面上
    const shape = new CANNON.Box(new CANNON.Vec3(boxSize / 2, boxSize / 2, boxSize / 2));
    const body = new CANNON.Body({
      mass: 5,
      shape: shape,
      position: new CANNON.Vec3(startX, boxSize / 2 + 0.01, 0),  // 放在地面上
      sleepSpeedLimit: 0.3,
      sleepTimeLimit: 0.5
    });
    // 初始状态设为休眠
    body.sleep();
    world.addBody(body);

    return { mesh, outline, shadow, body, spinOffset: Math.random() * 100, isReturning: false, isPlayer };
  }, [createDiceTexture]);

  // 获取骰子朝上的点数
  const getDiceValue = useCallback((mesh: THREE.Mesh): number => {
    let maxDot = -Infinity;
    let resultValue = 1;

    FACE_NORMALS.forEach((normal, index) => {
      const worldNormal = normal.clone().applyQuaternion(mesh.quaternion);
      if (worldNormal.y > maxDot) {
        maxDot = worldNormal.y;
        resultValue = FACE_VALUES[index];
      }
    });

    return resultValue;
  }, []);

  // 施加投掷力
  const applyThrowForce = useCallback((body: CANNON.Body) => {
    const xDist = -body.position.x;
    const zDist = -body.position.z;

    body.velocity.set(
      xDist * 1.5 + (Math.random() - 0.5) * 15,
      -15 - Math.random() * 10,
      zDist * 1.5 + (Math.random() - 0.5) * 15
    );

    body.angularVelocity.set(
      (Math.random() - 0.5) * 35,
      (Math.random() - 0.5) * 35,
      (Math.random() - 0.5) * 35
    );
  }, []);

  // 初始化场景
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    // 场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.background);
    sceneRef.current = scene;

    // 正交相机
    const FRUSTUM_SIZE = 18;
    const aspect = width / height;
    const camera = new THREE.OrthographicCamera(
      (FRUSTUM_SIZE * aspect) / -2,
      (FRUSTUM_SIZE * aspect) / 2,
      FRUSTUM_SIZE / 2,
      FRUSTUM_SIZE / -2,
      1,
      1000
    );
    camera.position.set(40, 40, 40);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.userSelect = 'none';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 物理世界
    const world = new CANNON.World();
    world.gravity.set(0, -40, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    (world.solver as CANNON.GSSolver).iterations = 20;
    world.allowSleep = true;
    worldRef.current = world;

    // 材质接触设定
    const wallMat = new CANNON.Material();
    const diceMat = new CANNON.Material();
    world.addContactMaterial(
      new CANNON.ContactMaterial(wallMat, diceMat, {
        friction: 0.3,
        restitution: 0.6
      })
    );

    // 地板
    const floorBody = new CANNON.Body({ mass: 0, material: wallMat });
    floorBody.addShape(new CANNON.Plane());
    floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(floorBody);

    // 墙壁
    const wallDistance = 10;
    const createWall = (x: number, z: number, rot: number) => {
      const body = new CANNON.Body({ mass: 0, material: wallMat });
      body.addShape(new CANNON.Plane());
      body.position.set(x, 0, z);
      body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rot);
      world.addBody(body);
    };
    createWall(wallDistance, 0, -Math.PI / 2);
    createWall(-wallDistance, 0, Math.PI / 2);
    createWall(0, -wallDistance, 0);
    createWall(0, wallDistance, Math.PI);

    // 创建两个骰子
    const systemDice = createDice(false, world, scene, -2.5);
    const playerDice = createDice(true, world, scene, 2.5);
    diceObjectsRef.current = [systemDice, playerDice];

    // 标签
    const createLabel = (text: string, x: number, isSystem: boolean) => {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 80;
      const ctx = canvas.getContext('2d')!;

      ctx.beginPath();
      ctx.roundRect(10, 10, 140, 60, 16);
      ctx.fillStyle = isSystem ? 'rgba(251, 113, 133, 0.9)' : 'rgba(167, 139, 250, 0.9)';
      ctx.fill();

      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = 'white';
      ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 80, 42);

      const texture = new THREE.CanvasTexture(canvas);
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.8),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
      );
      label.position.set(x, 0.02, 5);
      label.rotation.x = -Math.PI / 2;
      scene.add(label);
    };
    createLabel('系统', -2.5, true);
    createLabel('你', 2.5, false);

    // 动画循环
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      const time = performance.now() * 0.01;
      const diceObjects = diceObjectsRef.current;

      if (isHoldingRef.current) {
        // 拖拽中
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const targetPoint = new THREE.Vector3();
        raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, targetPoint);

        if (targetPoint) {
          diceObjects.forEach((obj, i) => {
            const offsetX = Math.sin(time + i) * 1.0;
            const offsetZ = Math.cos(time + i * 2) * 1.0;

            obj.body.position.x += (targetPoint.x + offsetX - obj.body.position.x) * 0.25;
            obj.body.position.y += (12 - obj.body.position.y) * 0.25;
            obj.body.position.z += (targetPoint.z + offsetZ - obj.body.position.z) * 0.25;

            obj.body.quaternion.setFromEuler(
              time * 2 + obj.spinOffset,
              time * 3 + obj.spinOffset,
              time * 1.5
            );

            obj.body.velocity.set(0, 0, 0);
            obj.body.angularVelocity.set(0, 0, 0);
            obj.isReturning = false;
          });
        }
      } else {
        // 检查飞回
        diceObjects.forEach((obj) => {
          if (obj.isReturning) {
            obj.body.position.x += (0 - obj.body.position.x) * 0.15;
            obj.body.position.z += (0 - obj.body.position.z) * 0.15;
            obj.body.position.y += (10 - obj.body.position.y) * 0.1;

            obj.body.quaternion.setFromEuler(time * 5, time * 5, 0);
            obj.body.velocity.set(0, 0, 0);
            obj.body.angularVelocity.set(0, 0, 0);

            if (Math.abs(obj.body.position.x) < 7 && Math.abs(obj.body.position.z) < 7) {
              obj.isReturning = false;
              obj.body.wakeUp();
              applyThrowForce(obj.body);
            }
          }
        });

        world.step(1 / 60);
      }

      // 同步视觉
      diceObjects.forEach((obj) => {
        obj.mesh.position.copy(obj.body.position as unknown as THREE.Vector3);
        obj.mesh.quaternion.copy(obj.body.quaternion as unknown as THREE.Quaternion);

        obj.outline.position.copy(obj.mesh.position);
        obj.outline.quaternion.copy(obj.mesh.quaternion);

        obj.shadow.position.x = obj.body.position.x;
        obj.shadow.position.z = obj.body.position.z;

        const height = Math.max(0, obj.body.position.y - 1);
        const scale = Math.max(0.5, 1 - height * 0.04);
        const opacity = Math.max(0, 0.2 - height * 0.01);
        obj.shadow.scale.setScalar(scale);
        (obj.shadow.material as THREE.MeshBasicMaterial).opacity = opacity;
      });

      // 结果判定
      if (needsResultCheckRef.current && !hasCalledBackRef.current) {
        let allStopped = true;
        for (const o of diceObjects) {
          if (o.isReturning) {
            allStopped = false;
            break;
          }
          if (o.body.velocity.length() > 0.1 || o.body.angularVelocity.length() > 0.1) {
            allStopped = false;
            break;
          }
        }

        if (allStopped) {
          const playerDice = diceObjects.find(d => d.isPlayer);
          const systemDice = diceObjects.find(d => !d.isPlayer);

          if (playerDice && systemDice) {
            const playerValue = getDiceValue(playerDice.mesh);
            const systemValue = getDiceValue(systemDice.mesh);

            setResult({ player: playerValue, system: systemValue });
            setIsRolling(false);
            hasCalledBackRef.current = true;
            needsResultCheckRef.current = false;
            onRollCompleteRef.current(playerValue, systemValue);
          }
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    // 窗口调整
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        const newAspect = w / h;
        camera.left = (-FRUSTUM_SIZE * newAspect) / 2;
        camera.right = (FRUSTUM_SIZE * newAspect) / 2;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };
    window.addEventListener('resize', handleResize);

    // 事件处理函数 - 定义在 useEffect 内部避免闭包问题
    const updateMouse = (e: MouseEvent | TouchEvent) => {
      const rect = container.getBoundingClientRect();
      let x: number, y: number;
      if ('changedTouches' in e) {
        x = e.changedTouches[0].clientX;
        y = e.changedTouches[0].clientY;
      } else {
        x = e.clientX;
        y = e.clientY;
      }
      mouseRef.current.x = ((x - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((y - rect.top) / rect.height) * 2 + 1;
    };

    const handleInputStart = (e: MouseEvent | TouchEvent) => {
      if (disabledRef.current || hasCalledBackRef.current) return;
      e.preventDefault();
      isHoldingRef.current = true;
      needsResultCheckRef.current = false;
      setIsRolling(true);
      setShowHint(false);
      setResult(null);
      updateMouse(e);
      diceObjectsRef.current.forEach(obj => {
        obj.body.wakeUp();
        obj.spinOffset = Math.random() * 100;
        obj.isReturning = false;
      });
    };

    const handleInputMove = (e: MouseEvent | TouchEvent) => {
      if (!isHoldingRef.current) return;
      e.preventDefault();
      updateMouse(e);
    };

    const handleInputEnd = () => {
      if (!isHoldingRef.current) return;
      isHoldingRef.current = false;
      const SAFE_LIMIT = 7;
      diceObjectsRef.current.forEach((obj) => {
        const isOutside =
          Math.abs(obj.body.position.x) > SAFE_LIMIT ||
          Math.abs(obj.body.position.z) > SAFE_LIMIT;
        if (isOutside) {
          obj.isReturning = true;
        } else {
          obj.body.wakeUp();
          applyThrowForce(obj.body);
        }
      });
      setTimeout(() => {
        needsResultCheckRef.current = true;
      }, 500);
    };

    // 绑定事件到 canvas
    const canvas = renderer.domElement;
    canvas.addEventListener('mousedown', handleInputStart as EventListener);
    canvas.addEventListener('touchstart', handleInputStart as EventListener, { passive: false });
    window.addEventListener('mousemove', handleInputMove as EventListener);
    window.addEventListener('touchmove', handleInputMove as EventListener, { passive: false });
    window.addEventListener('mouseup', handleInputEnd);
    window.addEventListener('touchend', handleInputEnd);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousedown', handleInputStart as EventListener);
      canvas.removeEventListener('touchstart', handleInputStart as EventListener);
      window.removeEventListener('mousemove', handleInputMove as EventListener);
      window.removeEventListener('touchmove', handleInputMove as EventListener);
      window.removeEventListener('mouseup', handleInputEnd);
      window.removeEventListener('touchend', handleInputEnd);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (rendererRef.current && container.contains(rendererRef.current.domElement)) {
        container.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createDice, getDiceValue, applyThrowForce]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={`w-full h-72 rounded-2xl overflow-hidden ${disabled ? 'opacity-50 pointer-events-none' : 'cursor-grab active:cursor-grabbing'}`}
        style={{ touchAction: 'none', minHeight: '288px' }}
      />

      {/* 提示 */}
      {showHint && !disabled && (
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <span className="text-amber-700 dark:text-amber-400/60 text-sm font-bold tracking-wide uppercase animate-pulse">
            拖拽骰子然后松开
          </span>
        </div>
      )}

      {/* 结果显示 */}
      {result && !isRolling && (
        <div className="absolute top-4 left-0 right-0 flex justify-center">
          <div className="bg-amber-800/90 text-white px-6 py-3 rounded-2xl shadow-lg">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-3xl font-black">{result.system}</div>
                <div className="text-xs opacity-80">系统</div>
              </div>
              <div className="text-2xl font-bold opacity-60">VS</div>
              <div className="text-center">
                <div className="text-3xl font-black">{result.player}</div>
                <div className="text-xs opacity-80">你</div>
              </div>
            </div>
            <div className={`text-center mt-2 text-sm font-bold ${result.player > result.system ? 'text-green-300' : 'text-red-300'}`}>
              {result.player > result.system ? '🎉 你赢了!' : result.player < result.system ? '😅 你输了' : '🤝 平局'}
            </div>
          </div>
        </div>
      )}

      {/* 加载中 */}
      {isRolling && !isHoldingRef.current && (
        <div className="absolute top-4 left-0 right-0 text-center">
          <span className="text-amber-700 dark:text-amber-400 text-sm font-bold">
            🎲 骰子滚动中...
          </span>
        </div>
      )}
    </div>
  );
};

export default FunDice3D;
