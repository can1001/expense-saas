'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, X, RotateCcw, Check, Loader2 } from 'lucide-react';

// 이미지 리사이징 설정 (home-care-service와 동일)
const MAX_IMAGE_SIZE = 800; // 가로 또는 세로 중 긴 쪽 기준 최대 크기
const IMAGE_QUALITY = 0.3; // 30% 품질

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isSaving, setIsSaving] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      setError(null);

      // 기존 스트림 정리
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('카메라에 접근할 수 없습니다. 카메라 권한을 확인해주세요.');
    }
  }, [facingMode]);

  // 컴포넌트 마운트 시 카메라 시작, 언마운트 시 정리
  useEffect(() => {
    startCamera();

    return () => {
      // 정리: 스트림 중지
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [startCamera]);

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

    // 이미지 리사이징 계산 (긴 쪽이 MAX_IMAGE_SIZE를 초과하면 비율 유지하며 축소)
    let width = video.videoWidth;
    let height = video.videoHeight;

    if (width > MAX_IMAGE_SIZE || height > MAX_IMAGE_SIZE) {
      if (width > height) {
        height = Math.round((height * MAX_IMAGE_SIZE) / width);
        width = MAX_IMAGE_SIZE;
      } else {
        width = Math.round((width * MAX_IMAGE_SIZE) / height);
        height = MAX_IMAGE_SIZE;
      }
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 리사이징하여 그리기
    ctx.drawImage(video, 0, 0, width, height);

    // iOS Safari 호환: toBlob() 사용하여 Blob 직접 저장
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setCapturedImage(url);
          setCapturedBlob(blob);
          stopCamera();
          console.log(
            `이미지 최적화: ${video.videoWidth}x${video.videoHeight} → ${width}x${height}, 크기: ${(blob.size / 1024).toFixed(1)}KB`
          );
        } else {
          setError('이미지 캡처에 실패했습니다. 다시 시도해주세요.');
        }
      },
      'image/jpeg',
      IMAGE_QUALITY
    );
  };

  const handleRetake = () => {
    // 이전 이미지 URL 정리
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedImage(null);
    setCapturedBlob(null);
    setError(null);
    startCamera();
  };

  const handleConfirm = async () => {
    if (!capturedBlob || isSaving) return;

    setIsSaving(true);
    setError(null);

    try {
      const file = new File([capturedBlob], `receipt_${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });

      // 이미지 URL 정리
      if (capturedImage) {
        URL.revokeObjectURL(capturedImage);
      }

      onCapture(file);
      onClose();
    } catch (err) {
      console.error('이미지 저장 실패:', err);
      setError('이미지 저장에 실패했습니다. 다시 시도해주세요.');
      setIsSaving(false);
    }
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
              disabled={isSaving}
              className="flex flex-col items-center gap-1 text-white"
            >
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                isSaving ? 'bg-gray-400' : 'bg-blue-500'
              }`}>
                {isSaving ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Check className="w-6 h-6" />
                )}
              </div>
              <span className="text-sm">{isSaving ? '저장중...' : '사용하기'}</span>
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
