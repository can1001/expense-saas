'use client';

import { useRef, useState, useCallback } from 'react';
import { Camera, X, RotateCcw, Check } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const startCamera = useCallback(async () => {
    try {
      setError(null);

      // 기존 스트림 정리
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
    } catch (err) {
      console.error('Camera error:', err);
      setError('카메라에 접근할 수 없습니다. 카메라 권한을 확인해주세요.');
    }
  }, [facingMode, stream]);

  // 컴포넌트 마운트 시 카메라 시작
  useState(() => {
    startCamera();
  });

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageData);
    stopCamera();
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleConfirm = () => {
    if (!capturedImage) return;

    // Base64를 File로 변환
    fetch(capturedImage)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], `receipt_${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
        onClose();
      });
  };

  const handleSwitchCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    startCamera();
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* 헤더 */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
        <button
          onClick={handleClose}
          className="p-2 text-white rounded-full bg-black/30"
        >
          <X className="w-6 h-6" />
        </button>
        <span className="text-white font-medium">영수증 촬영</span>
        <button
          onClick={handleSwitchCamera}
          className="p-2 text-white rounded-full bg-black/30"
        >
          <RotateCcw className="w-6 h-6" />
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm text-center">
            <p className="text-gray-800 mb-4">{error}</p>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 카메라 뷰 */}
      {!capturedImage && !error && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          onLoadedMetadata={() => videoRef.current?.play()}
        />
      )}

      {/* 캡처된 이미지 미리보기 */}
      {capturedImage && (
        <img
          src={capturedImage}
          alt="Captured"
          className="w-full h-full object-contain bg-black"
        />
      )}

      {/* 캔버스 (숨김) */}
      <canvas ref={canvasRef} className="hidden" />

      {/* 하단 컨트롤 */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/50 to-transparent">
        {!capturedImage ? (
          <div className="flex justify-center">
            <button
              onClick={handleCapture}
              disabled={!stream}
              className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg disabled:opacity-50"
            >
              <div className="w-16 h-16 bg-white border-4 border-gray-300 rounded-full" />
            </button>
          </div>
        ) : (
          <div className="flex justify-center gap-8">
            <button
              onClick={handleRetake}
              className="flex flex-col items-center gap-1 text-white"
            >
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                <RotateCcw className="w-6 h-6" />
              </div>
              <span className="text-sm">다시 촬영</span>
            </button>
            <button
              onClick={handleConfirm}
              className="flex flex-col items-center gap-1 text-white"
            >
              <div className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center">
                <Check className="w-6 h-6" />
              </div>
              <span className="text-sm">사용하기</span>
            </button>
          </div>
        )}
      </div>

      {/* 촬영 가이드 */}
      {!capturedImage && !error && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-[80%] h-[60%] border-2 border-white/50 rounded-lg">
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/50 px-3 py-1 rounded text-white text-sm">
              영수증을 프레임 안에 맞춰주세요
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 카메라 버튼 컴포넌트 (FileUpload와 함께 사용)
export function CameraButton({ onCapture }: { onCapture: (file: File) => void }) {
  const [showCamera, setShowCamera] = useState(false);

  // 카메라 지원 여부 확인
  const isCameraSupported = typeof navigator !== 'undefined' &&
    'mediaDevices' in navigator &&
    'getUserMedia' in navigator.mediaDevices;

  if (!isCameraSupported) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowCamera(true)}
        className="md:hidden flex items-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors w-full justify-center"
      >
        <Camera className="w-5 h-5" />
        <span>카메라로 영수증 촬영</span>
      </button>

      {showCamera && (
        <CameraCapture
          onCapture={onCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </>
  );
}
