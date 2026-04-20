'use client';

import { useState, useEffect, useCallback } from 'react';

interface Question {
  id: string;
  questionText: string;
  questionType: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  option4: string | null;
  correctAnswer: string;
  explanation: string | null;
  questionNumber: number;
}

interface QuizManagerProps {
  lessonId: string;
  lessonTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

const emptyQuestion = {
  questionText: '',
  questionType: 'MULTIPLE_CHOICE',
  option1: '',
  option2: '',
  option3: '',
  option4: '',
  correctAnswer: '1',
  explanation: '',
};

export default function QuizManager({
  lessonId,
  lessonTitle,
  isOpen,
  onClose,
  onUpdate,
}: QuizManagerProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState(emptyQuestion);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // 퀴즈 목록 로드
  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/youth-night/admin/questions?lessonId=${lessonId}`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
      }
    } catch (error) {
      console.error('퀴즈 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    if (isOpen) {
      loadQuestions();
    }
  }, [isOpen, loadQuestions]);

  // 새 문제 추가
  const handleAdd = async () => {
    if (!formData.questionText.trim()) {
      alert('질문을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/youth-night/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          ...formData,
        }),
      });

      if (res.ok) {
        setFormData(emptyQuestion);
        setIsAdding(false);
        loadQuestions();
        onUpdate?.();
      } else {
        const error = await res.json();
        alert(error.error || '문제 추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('문제 추가 오류:', error);
      alert('문제 추가 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 문제 수정
  const handleUpdate = async () => {
    if (!editingId || !formData.questionText.trim()) {
      alert('질문을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/youth-night/admin/questions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          ...formData,
        }),
      });

      if (res.ok) {
        setFormData(emptyQuestion);
        setEditingId(null);
        loadQuestions();
        onUpdate?.();
      } else {
        const error = await res.json();
        alert(error.error || '문제 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('문제 수정 오류:', error);
      alert('문제 수정 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 문제 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('이 문제를 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/youth-night/admin/questions?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        loadQuestions();
        onUpdate?.();
      } else {
        const error = await res.json();
        alert(error.error || '문제 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('문제 삭제 오류:', error);
      alert('문제 삭제 중 오류가 발생했습니다.');
    }
  };

  // 편집 시작
  const startEdit = (question: Question) => {
    setEditingId(question.id);
    setIsAdding(false);
    setFormData({
      questionText: question.questionText,
      questionType: question.questionType,
      option1: question.option1 || '',
      option2: question.option2 || '',
      option3: question.option3 || '',
      option4: question.option4 || '',
      correctAnswer: question.correctAnswer,
      explanation: question.explanation || '',
    });
  };

  // 드래그 앤 드롭
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newQuestions = [...questions];
    const draggedItem = newQuestions[draggedIndex];
    newQuestions.splice(draggedIndex, 1);
    newQuestions.splice(index, 0, draggedItem);
    setQuestions(newQuestions);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null) return;
    setDraggedIndex(null);

    // 순서 저장
    try {
      await fetch('/api/youth-night/admin/questions/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionIds: questions.map((q) => q.id),
        }),
      });
      onUpdate?.();
    } catch (error) {
      console.error('순서 변경 오류:', error);
    }
  };

  // 취소
  const handleCancel = () => {
    setFormData(emptyQuestion);
    setEditingId(null);
    setIsAdding(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-500 to-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">퀴즈 관리</h2>
              <p className="text-sm text-white/80 mt-0.5">{lessonTitle}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {/* Question List */}
              <div className="space-y-3 mb-6">
                {questions.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <span className="text-4xl mb-4 block">📝</span>
                    <p className="text-gray-500">등록된 퀴즈 문제가 없습니다.</p>
                    <p className="text-sm text-gray-400 mt-1">아래 버튼을 눌러 문제를 추가하세요.</p>
                  </div>
                ) : (
                  questions.map((question, index) => (
                    <div
                      key={question.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`bg-white border-2 rounded-xl p-4 cursor-move transition-all ${
                        draggedIndex === index
                          ? 'border-indigo-400 shadow-lg scale-[1.02]'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Drag Handle & Number */}
                        <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-bold text-sm">
                          {question.questionNumber}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 mb-2">{question.questionText}</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {[question.option1, question.option2, question.option3, question.option4]
                              .filter(Boolean)
                              .map((opt, i) => (
                                <div
                                  key={i}
                                  className={`px-3 py-1.5 rounded-lg ${
                                    question.correctAnswer === String(i + 1)
                                      ? 'bg-green-100 text-green-700 font-medium'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  {i + 1}. {opt}
                                </div>
                              ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex-shrink-0 flex gap-1">
                          <button
                            onClick={() => startEdit(question)}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(question.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add/Edit Form */}
              {(isAdding || editingId) && (
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-5 mb-6">
                  <h3 className="font-bold text-gray-900 mb-4">
                    {editingId ? '문제 수정' : '새 문제 추가'}
                  </h3>

                  <div className="space-y-4">
                    {/* Question Text */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        질문 <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={formData.questionText}
                        onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        rows={2}
                        placeholder="질문을 입력하세요"
                      />
                    </div>

                    {/* Options */}
                    <div className="grid grid-cols-2 gap-3">
                      {[1, 2, 3, 4].map((num) => (
                        <div key={num}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            선택지 {num}
                            {num <= 2 && <span className="text-red-500">*</span>}
                          </label>
                          <input
                            type="text"
                            value={formData[`option${num}` as keyof typeof formData] as string}
                            onChange={(e) =>
                              setFormData({ ...formData, [`option${num}`]: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder={`선택지 ${num}`}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Correct Answer */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        정답 <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setFormData({ ...formData, correctAnswer: String(num) })}
                            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                              formData.correctAnswer === String(num)
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {num}번
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Explanation */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        정답 설명 (선택)
                      </label>
                      <textarea
                        value={formData.explanation}
                        onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        rows={2}
                        placeholder="정답에 대한 설명을 입력하세요"
                      />
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={handleCancel}
                        className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                      >
                        취소
                      </button>
                      <button
                        onClick={editingId ? handleUpdate : handleAdd}
                        disabled={saving}
                        className="flex-1 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        {saving ? '저장 중...' : editingId ? '수정' : '추가'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Add Button */}
              {!isAdding && !editingId && (
                <button
                  onClick={() => {
                    setIsAdding(true);
                    setFormData(emptyQuestion);
                  }}
                  className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  새 문제 추가
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              총 {questions.length}개 문제
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-800 text-white font-medium rounded-xl hover:bg-gray-900 transition-colors"
            >
              완료
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
