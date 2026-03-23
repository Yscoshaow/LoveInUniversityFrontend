"use client";
import React, { useRef, useEffect, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useMotionTemplate,
} from "motion/react";
import { cn } from "@/lib/utils";
import { isCard3DEffectEnabled } from "@/lib/local-settings";

// Check if device has gyroscope support
const hasGyroscope = () => {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
};

// Check if we're on a mobile device
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const CometCard = ({
  rotateDepth = 17.5,
  translateDepth = 20,
  className,
  children,
  onSwipeDown,
}: {
  rotateDepth?: number;
  translateDepth?: number;
  className?: string;
  children: React.ReactNode;
  onSwipeDown?: () => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const [useGyroscope, setUseGyroscope] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [is3DEnabled, setIs3DEnabled] = useState(true);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 20 });

  // Check if 3D effect is enabled from local settings
  useEffect(() => {
    setIs3DEnabled(isCard3DEffectEnabled());
  }, []);

  // Request permission for DeviceOrientation on iOS 13+
  useEffect(() => {
    // Skip if 3D effect is disabled
    if (!is3DEnabled) return;

    const requestPermission = async () => {
      if (!hasGyroscope() || !isMobileDevice()) {
        return;
      }

      // For iOS 13+ we need to request permission
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          const permission = await (DeviceOrientationEvent as any).requestPermission();
          if (permission === 'granted') {
            setPermissionGranted(true);
            setUseGyroscope(true);
          }
        } catch (e) {
          console.log('Gyroscope permission denied');
        }
      } else {
        // Non-iOS or older iOS - permission not required
        setPermissionGranted(true);
        setUseGyroscope(true);
      }
    };

    requestPermission();
  }, [is3DEnabled]);

  // Handle device orientation for gyroscope effect
  useEffect(() => {
    if (!useGyroscope || !permissionGranted) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const { beta, gamma } = event;

      if (beta === null || gamma === null) return;

      // beta: front-back tilt (-180 to 180), gamma: left-right tilt (-90 to 90)
      // Normalize to -0.5 to 0.5 range
      // Clamp values for smoother experience
      const clampedBeta = Math.max(-45, Math.min(45, beta - 45)); // Offset by 45 for natural phone holding
      const clampedGamma = Math.max(-45, Math.min(45, gamma));

      const normalizedY = clampedBeta / 90; // -0.5 to 0.5
      const normalizedX = clampedGamma / 90; // -0.5 to 0.5

      x.set(normalizedX);
      y.set(normalizedY);
    };

    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [useGyroscope, permissionGranted, x, y]);

  const rotateX = useTransform(
    mouseYSpring,
    [-0.5, 0.5],
    [`-${rotateDepth}deg`, `${rotateDepth}deg`],
  );
  const rotateY = useTransform(
    mouseXSpring,
    [-0.5, 0.5],
    [`${rotateDepth}deg`, `-${rotateDepth}deg`],
  );

  const translateX = useTransform(
    mouseXSpring,
    [-0.5, 0.5],
    [`-${translateDepth}px`, `${translateDepth}px`],
  );
  const translateY = useTransform(
    mouseYSpring,
    [-0.5, 0.5],
    [`${translateDepth}px`, `-${translateDepth}px`],
  );

  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], [0, 100]);
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], [0, 100]);

  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.9) 10%, rgba(255, 255, 255, 0.75) 20%, rgba(255, 255, 255, 0) 80%)`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Skip if 3D effect is disabled or using gyroscope
    if (!is3DEnabled || useGyroscope) return;
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();

    const width = rect.width;
    const height = rect.height;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;

    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    // Skip if 3D effect is disabled or using gyroscope
    if (!is3DEnabled || useGyroscope) return;
    x.set(0);
    y.set(0);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;

    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchEndY - touchStartY.current;

    // Swipe down threshold: 50px
    if (deltaY > 50 && onSwipeDown) {
      onSwipeDown();
    }

    touchStartY.current = null;
  };

  // If 3D effect is disabled, render a simple card without animations
  if (!is3DEnabled) {
    return (
      <div className={cn(className)}>
        <div
          ref={ref}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="relative rounded-3xl overflow-hidden"
          style={{
            boxShadow:
              "rgba(0, 0, 0, 0.01) 0px 520px 146px 0px, rgba(0, 0, 0, 0.04) 0px 333px 133px 0px, rgba(0, 0, 0, 0.26) 0px 83px 83px 0px, rgba(0, 0, 0, 0.29) 0px 21px 46px 0px",
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(className)} style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}>
      <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          rotateX,
          rotateY,
          translateX,
          translateY,
          boxShadow:
            "rgba(0, 0, 0, 0.01) 0px 520px 146px 0px, rgba(0, 0, 0, 0.04) 0px 333px 133px 0px, rgba(0, 0, 0, 0.26) 0px 83px 83px 0px, rgba(0, 0, 0, 0.29) 0px 21px 46px 0px",
        }}
        initial={{ scale: 1, z: 0 }}
        whileHover={{
          scale: 1.05,
          z: 50,
          transition: { duration: 0.2 },
        }}
        className="relative rounded-3xl overflow-hidden"
      >
        {children}
        <motion.div
          className="pointer-events-none absolute inset-0 z-50 h-full w-full rounded-3xl mix-blend-overlay"
          style={{
            background: glareBackground,
            opacity: 0.6,
          }}
          transition={{ duration: 0.2 }}
        />
      </motion.div>
    </div>
  );
};
