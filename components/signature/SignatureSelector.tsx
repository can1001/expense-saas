'use client';

import { useState, useEffect } from 'react';
import { Pen, Stamp, Check, Loader2 } from 'lucide-react';
import { SignatureCanvas } from './SignatureCanvas';

interface UserSignature {
  id: string;
  type: 'signature' | 'stamp';
  name: string;
  imageData: string;
  isDefault: boolean;
  createdAt: string;
}

interface SignatureData {
  type: 'signature' | 'stamp' | 'realtime';
  data?: string;
  signatureId?: string;
}

interface SignatureSelectorProps {
  onSelect: (data: SignatureData | null) => void;
  selectedData?: SignatureData | null;
}

export function SignatureSelector({ onSelect }: SignatureSelectorProps) {
  const [mode, setMode] = useState<'realtime' | 'saved'>('saved');
  const [signatures, setSignatures] = useState<UserSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [realtimeSignature, setRealtimeSignature] = useState<string | null>(null);

  // 저장된 서명/도장 목록 조회
  useEffect(() => {
    async function fetchSignatures() {
      try {
        const res = await fetch('/api/users/me/signatures');
        if (res.ok) {
          const data = await res.json();
          setSignatures(data.signatures || []);

          // 기본 서명이 있으면 자동 선택
          const defaultSignature = data.signatures?.find(
            (s: UserSignature) => s.isDefault && s.type === 'signature'
          );
          if (defaultSignature) {
            setSelectedId(defaultSignature.id);
            onSelect({
              type: defaultSignature.type,
              signatureId: defaultSignature.id,
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch signatures:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchSignatures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 모드 변경 시 선택 초기화
  const handleModeChange = (newMode: 'realtime' | 'saved') => {
    setMode(newMode);
    setSelectedId(null);
    setRealtimeSignature(null);
    onSelect(null);
  };

  // 저장된 서명/도장 선택
  const handleSelectSaved = (sig: UserSignature) => {
    setSelectedId(sig.id);
    onSelect({
      type: sig.type,
      signatureId: sig.id,
    });
  };

  // 실시간 서명 완료
  const handleRealtimeComplete = (data: string) => {
    setRealtimeSignature(data);
    onSelect({
      type: 'realtime',
      data,
    });
  };

  const signatureList = signatures.filter((s) => s.type === 'signature');
  const stampList = signatures.filter((s) => s.type === 'stamp');

  return (
    <div className="space-y-4">
      {/* 모드 선택 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleModeChange('realtime')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
            mode === 'realtime'
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          }`}
        >
          <Pen className="w-4 h-4" />
          <span className="text-sm font-medium">실시간 서명</span>
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('saved')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
            mode === 'saved'
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          }`}
        >
          <Stamp className="w-4 h-4" />
          <span className="text-sm font-medium">저장된 서명/도장</span>
        </button>
      </div>

      {/* 실시간 서명 모드 */}
      {mode === 'realtime' && (
        <div className="border rounded-lg p-4 bg-gray-50">
          {realtimeSignature ? (
            <div className="space-y-3">
              <div className="text-center text-sm text-green-600 font-medium flex items-center justify-center gap-1">
                <Check className="w-4 h-4" />
                서명이 완료되었습니다
              </div>
              <div className="flex justify-center">
                <img
                  src={realtimeSignature}
                  alt="서명"
                  className="max-w-[200px] h-auto border rounded bg-white"
                />
              </div>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setRealtimeSignature(null);
                    onSelect(null);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  다시 서명하기
                </button>
              </div>
            </div>
          ) : (
            <SignatureCanvas onComplete={handleRealtimeComplete} />
          )}
        </div>
      )}

      {/* 저장된 서명/도장 모드 */}
      {mode === 'saved' && (
        <div className="border rounded-lg p-4 bg-gray-50">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : signatures.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-2">저장된 서명/도장이 없습니다.</p>
              <p className="text-sm">
                마이페이지에서 서명/도장을 등록해주세요.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 서명 목록 */}
              {signatureList.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                    <Pen className="w-3.5 h-3.5" />
                    서명
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {signatureList.map((sig) => (
                      <button
                        key={sig.id}
                        type="button"
                        onClick={() => handleSelectSaved(sig)}
                        className={`relative p-2 border-2 rounded-lg bg-white transition-colors ${
                          selectedId === sig.id
                            ? 'border-blue-500 ring-2 ring-blue-200'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <img
                          src={sig.imageData}
                          alt={sig.name}
                          className="w-full h-16 object-contain"
                        />
                        <div className="mt-1 text-xs text-gray-600 truncate">
                          {sig.name}
                        </div>
                        {sig.isDefault && (
                          <span className="absolute top-1 right-1 px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded">
                            기본
                          </span>
                        )}
                        {selectedId === sig.id && (
                          <div className="absolute top-1 left-1">
                            <Check className="w-4 h-4 text-blue-500" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 도장 목록 */}
              {stampList.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                    <Stamp className="w-3.5 h-3.5" />
                    도장
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {stampList.map((sig) => (
                      <button
                        key={sig.id}
                        type="button"
                        onClick={() => handleSelectSaved(sig)}
                        className={`relative p-2 border-2 rounded-lg bg-white transition-colors ${
                          selectedId === sig.id
                            ? 'border-blue-500 ring-2 ring-blue-200'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <img
                          src={sig.imageData}
                          alt={sig.name}
                          className="w-full h-16 object-contain"
                        />
                        <div className="mt-1 text-xs text-gray-600 truncate">
                          {sig.name}
                        </div>
                        {sig.isDefault && (
                          <span className="absolute top-1 right-1 px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded">
                            기본
                          </span>
                        )}
                        {selectedId === sig.id && (
                          <div className="absolute top-1 left-1">
                            <Check className="w-4 h-4 text-blue-500" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
