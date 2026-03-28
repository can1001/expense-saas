'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Pen,
  Stamp,
  Plus,
  Trash2,
  Star,
  Loader2,
  X,
  Check,
} from 'lucide-react';
import { SignatureCanvas } from './SignatureCanvas';

interface UserSignature {
  id: string;
  type: 'signature' | 'stamp';
  name: string;
  imageData: string;
  isDefault: boolean;
  createdAt: string;
}

export function SignatureManager() {
  const [signatures, setSignatures] = useState<UserSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<'signature' | 'stamp'>('signature');
  const [addName, setAddName] = useState('');
  const [addImageData, setAddImageData] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  // 목록 조회
  const fetchSignatures = useCallback(async () => {
    try {
      const res = await fetch('/api/users/me/signatures');
      if (res.ok) {
        const data = await res.json();
        setSignatures(data.signatures || []);
      }
    } catch (error) {
      console.error('Failed to fetch signatures:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignatures();
  }, [fetchSignatures]);

  // 추가 모달 열기
  const openAddModal = (type: 'signature' | 'stamp') => {
    setAddType(type);
    setAddName(type === 'signature' ? '기본 서명' : '기본 도장');
    setAddImageData(null);
    setShowAddModal(true);
  };

  // 추가 모달 닫기
  const closeAddModal = () => {
    setShowAddModal(false);
    setAddName('');
    setAddImageData(null);
  };

  // 서명/도장 저장
  const handleSave = async () => {
    if (!addName.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }
    if (!addImageData) {
      alert(addType === 'signature' ? '서명을 입력해주세요.' : '도장 이미지를 등록해주세요.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/users/me/signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: addType,
          name: addName.trim(),
          imageData: addImageData,
          isDefault: signatures.filter((s) => s.type === addType).length === 0,
        }),
      });

      if (res.ok) {
        await fetchSignatures();
        closeAddModal();
      } else {
        const data = await res.json();
        alert(data.error || '저장에 실패했습니다.');
      }
    } catch {
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 삭제
  const handleDelete = async (id: string, type: string) => {
    if (!confirm(`${type === 'signature' ? '서명' : '도장'}을 삭제하시겠습니까?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/users/me/signatures/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchSignatures();
      } else {
        const data = await res.json();
        alert(data.error || '삭제에 실패했습니다.');
      }
    } catch {
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  // 기본 설정
  const handleSetDefault = async (id: string) => {
    setSettingDefaultId(id);
    try {
      const res = await fetch(`/api/users/me/signatures/${id}/default`, {
        method: 'PUT',
      });

      if (res.ok) {
        await fetchSignatures();
      } else {
        const data = await res.json();
        alert(data.error || '설정에 실패했습니다.');
      }
    } catch {
      alert('설정 중 오류가 발생했습니다.');
    } finally {
      setSettingDefaultId(null);
    }
  };

  // 파일 업로드 (도장용)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setAddImageData(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const signatureList = signatures.filter((s) => s.type === 'signature');
  const stampList = signatures.filter((s) => s.type === 'stamp');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 추가 버튼 */}
      <div className="flex gap-2">
        <button
          onClick={() => openAddModal('signature')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <Pen className="w-4 h-4" />
          서명 추가
        </button>
        <button
          onClick={() => openAddModal('stamp')}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <Stamp className="w-4 h-4" />
          도장 추가
        </button>
      </div>

      {/* 서명 목록 */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Pen className="w-5 h-5" />
          내 서명
        </h3>
        {signatureList.length === 0 ? (
          <div className="text-gray-500 text-sm py-4 border rounded-lg bg-gray-50 text-center">
            등록된 서명이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {signatureList.map((sig) => (
              <div
                key={sig.id}
                className="border rounded-lg p-4 bg-white relative"
              >
                {sig.isDefault && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" />
                    기본
                  </span>
                )}
                <img
                  src={sig.imageData}
                  alt={sig.name}
                  className="w-full h-24 object-contain mb-3 border rounded bg-gray-50"
                />
                <div className="text-sm font-medium mb-3 truncate">{sig.name}</div>
                <div className="flex gap-2">
                  {!sig.isDefault && (
                    <button
                      onClick={() => handleSetDefault(sig.id)}
                      disabled={settingDefaultId === sig.id}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-50 disabled:opacity-50"
                    >
                      {settingDefaultId === sig.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Star className="w-3 h-3" />
                          기본 설정
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(sig.id, sig.type)}
                    disabled={deletingId === sig.id}
                    className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-red-600 border border-red-300 rounded hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === sig.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="w-3 h-3" />
                        삭제
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 도장 목록 */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Stamp className="w-5 h-5" />
          내 도장
        </h3>
        {stampList.length === 0 ? (
          <div className="text-gray-500 text-sm py-4 border rounded-lg bg-gray-50 text-center">
            등록된 도장이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stampList.map((sig) => (
              <div
                key={sig.id}
                className="border rounded-lg p-4 bg-white relative"
              >
                {sig.isDefault && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" />
                    기본
                  </span>
                )}
                <img
                  src={sig.imageData}
                  alt={sig.name}
                  className="w-full h-24 object-contain mb-3 border rounded bg-gray-50"
                />
                <div className="text-sm font-medium mb-3 truncate">{sig.name}</div>
                <div className="flex gap-2">
                  {!sig.isDefault && (
                    <button
                      onClick={() => handleSetDefault(sig.id)}
                      disabled={settingDefaultId === sig.id}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-red-600 border border-red-300 rounded hover:bg-red-50 disabled:opacity-50"
                    >
                      {settingDefaultId === sig.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Star className="w-3 h-3" />
                          기본 설정
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(sig.id, sig.type)}
                    disabled={deletingId === sig.id}
                    className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-red-600 border border-red-300 rounded hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === sig.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="w-3 h-3" />
                        삭제
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {addType === 'signature' ? (
                  <Pen className="w-5 h-5" />
                ) : (
                  <Stamp className="w-5 h-5" />
                )}
                {addType === 'signature' ? '서명' : '도장'} 추가
              </h3>
              <button
                onClick={closeAddModal}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 이름 입력 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이름
              </label>
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="예: 기본 서명"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 서명 입력 또는 이미지 업로드 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {addType === 'signature' ? '서명 입력' : '도장 이미지'}
              </label>

              {addType === 'signature' ? (
                <div className="border rounded-lg p-4 bg-gray-50">
                  {addImageData ? (
                    <div className="space-y-3">
                      <div className="text-center text-sm text-green-600 font-medium flex items-center justify-center gap-1">
                        <Check className="w-4 h-4" />
                        서명이 입력되었습니다
                      </div>
                      <div className="flex justify-center">
                        <img
                          src={addImageData}
                          alt="서명"
                          className="max-w-full h-auto border rounded bg-white"
                        />
                      </div>
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => setAddImageData(null)}
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          다시 서명하기
                        </button>
                      </div>
                    </div>
                  ) : (
                    <SignatureCanvas onComplete={setAddImageData} />
                  )}
                </div>
              ) : (
                <div className="border rounded-lg p-4 bg-gray-50">
                  {addImageData ? (
                    <div className="space-y-3">
                      <div className="flex justify-center">
                        <img
                          src={addImageData}
                          alt="도장"
                          className="max-w-[200px] h-auto border rounded bg-white"
                        />
                      </div>
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => setAddImageData(null)}
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          다른 이미지 선택
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <label className="cursor-pointer">
                        <div className="flex flex-col items-center gap-2 text-gray-500">
                          <Stamp className="w-12 h-12" />
                          <span className="text-sm">클릭하여 도장 이미지 업로드</span>
                          <span className="text-xs text-gray-400">
                            PNG, JPG 파일 지원
                          </span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !addName.trim() || !addImageData}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={closeAddModal}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
