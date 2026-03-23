import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, RotateCcw, Check } from 'lucide-react';

interface CameraCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (originalImage: string, blurredPreview: string) => void;
  blurRadius?: number; // Blur radius in pixels (default 20)
}

// Blur area size constants (percentage of image)
const BLUR_AREA_WIDTH_PERCENT = 0.8;  // 80% width
const BLUR_AREA_HEIGHT_PERCENT = 0.6; // 60% height

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  isOpen,
  onClose,
  onCapture,
  blurRadius = 25,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [blurredPreview, setBlurredPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setError(null);

      // Stop existing stream first
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      setError('无法访问相机。请确保已授予相机权限。');
    }
  }, [facingMode, stream]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Start camera when opened
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setOriginalImage(null);
      setBlurredPreview(null);
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Restart camera when facing mode changes
  useEffect(() => {
    if (isOpen && !originalImage) {
      startCamera();
    }
  }, [facingMode]);

  // Switch camera
  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  // Capture photo - save original and create blurred preview
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the full video frame
    ctx.drawImage(video, 0, 0);

    // Save original image first (for upload)
    const originalDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setOriginalImage(originalDataUrl);

    // Now create blurred preview
    // Define the blur area (center rectangle) - larger area
    const blurAreaWidth = canvas.width * BLUR_AREA_WIDTH_PERCENT;
    const blurAreaHeight = canvas.height * BLUR_AREA_HEIGHT_PERCENT;
    const blurAreaX = (canvas.width - blurAreaWidth) / 2;
    const blurAreaY = (canvas.height - blurAreaHeight) / 2;

    // Get the center area image data
    const centerImageData = ctx.getImageData(blurAreaX, blurAreaY, blurAreaWidth, blurAreaHeight);

    // Apply blur to center area using box blur (multiple passes for stronger effect)
    let blurredData = applyBlur(centerImageData, blurRadius);
    blurredData = applyBlur(blurredData, blurRadius); // Second pass for stronger blur

    // Put the blurred data back
    ctx.putImageData(blurredData, blurAreaX, blurAreaY);

    // Save blurred preview
    const blurredDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setBlurredPreview(blurredDataUrl);
  };

  // Simple box blur implementation
  const applyBlur = (imageData: ImageData, radius: number): ImageData => {
    const { data, width, height } = imageData;
    const result = new Uint8ClampedArray(data);

    // Horizontal pass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, count = 0;

        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < width) {
            const idx = (y * width + nx) * 4;
            r += data[idx];
            g += data[idx + 1];
            b += data[idx + 2];
            count++;
          }
        }

        const idx = (y * width + x) * 4;
        result[idx] = r / count;
        result[idx + 1] = g / count;
        result[idx + 2] = b / count;
      }
    }

    // Vertical pass
    const temp = new Uint8ClampedArray(result);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, count = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          const ny = y + dy;
          if (ny >= 0 && ny < height) {
            const idx = (ny * width + x) * 4;
            r += temp[idx];
            g += temp[idx + 1];
            b += temp[idx + 2];
            count++;
          }
        }

        const idx = (y * width + x) * 4;
        result[idx] = r / count;
        result[idx + 1] = g / count;
        result[idx + 2] = b / count;
      }
    }

    return new ImageData(result, width, height);
  };

  // Retake photo
  const retakePhoto = () => {
    setOriginalImage(null);
    setBlurredPreview(null);
  };

  // Confirm photo - pass original image for upload and blurred preview for display
  const confirmPhoto = () => {
    if (originalImage && blurredPreview) {
      onCapture(originalImage, blurredPreview);
      onClose();
    }
  };

  // Handle close
  const handleClose = () => {
    stopCamera();
    setOriginalImage(null);
    setBlurredPreview(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 flex justify-between items-center">
        <button
          onClick={handleClose}
          className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white"
        >
          <X size={24} />
        </button>
        <div className="text-white font-semibold text-sm">
          拍摄奖励图片
        </div>
        {!originalImage && (
          <button
            onClick={switchCamera}
            className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white"
          >
            <RotateCcw size={20} />
          </button>
        )}
        {originalImage && <div className="w-10" />}
      </div>

      {/* Camera View or Captured Image */}
      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-white text-center p-8">
            <div>
              <Camera size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg">{error}</p>
              <button
                onClick={startCamera}
                className="mt-4 px-6 py-2 bg-secondary rounded-full text-sm font-semibold"
              >
                重试
              </button>
            </div>
          </div>
        ) : blurredPreview ? (
          // Show blurred preview (original will be uploaded)
          <img
            src={blurredPreview}
            alt="Preview"
            className="w-full h-full object-contain"
          />
        ) : (
          // Camera preview with blur overlay
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Blur Preview Overlay - shows where blur will be applied (80% x 60%) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* Top darkened area - 20% height */}
              <div className="absolute top-0 left-0 right-0 h-[20%] bg-black/40" />
              {/* Bottom darkened area - 20% height */}
              <div className="absolute bottom-0 left-0 right-0 h-[20%] bg-black/40" />
              {/* Left darkened area - 10% width */}
              <div className="absolute top-[20%] bottom-[20%] left-0 w-[10%] bg-black/40" />
              {/* Right darkened area - 10% width */}
              <div className="absolute top-[20%] bottom-[20%] right-0 w-[10%] bg-black/40" />

              {/* Center blur indicator - 80% x 60% */}
              <div className="w-[80%] h-[60%] border-2 border-white/60 rounded-2xl relative">
                {/* Blur effect preview (CSS blur) */}
                <div className="absolute inset-0 backdrop-blur-xl rounded-2xl" />

                {/* Label */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black/60 px-4 py-2 rounded-full">
                    <span className="text-white text-xs font-semibold">模糊区域</span>
                  </div>
                </div>

                {/* Corner markers */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-lg" />
              </div>
            </div>

            {/* Hint text */}
            <div className="absolute bottom-32 left-0 right-0 text-center">
              <p className="text-white/80 text-sm px-8">
                将奖励内容放在中央区域，该区域将被模糊处理
              </p>
            </div>
          </>
        )}
      </div>

      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-8 pb-12">
        {blurredPreview ? (
          // Confirm/Retake buttons
          <div className="flex items-center justify-center gap-12">
            <button
              onClick={retakePhoto}
              className="w-16 h-16 rounded-full bg-white/20 dark:bg-slate-800/20 flex items-center justify-center text-white"
            >
              <RotateCcw size={28} />
            </button>
            <button
              onClick={confirmPhoto}
              className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center text-white shadow-glow-secondary"
            >
              <Check size={36} />
            </button>
          </div>
        ) : (
          // Capture button
          <div className="flex items-center justify-center">
            <button
              onClick={capturePhoto}
              disabled={!stream}
              className="w-20 h-20 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center disabled:opacity-50"
            >
              <div className="w-16 h-16 rounded-full border-4 border-slate-800" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
