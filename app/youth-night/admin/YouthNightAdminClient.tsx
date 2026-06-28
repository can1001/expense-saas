'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { TEXT_HERO, TEXT_SUBTITLE, TEXT_SECTION_TITLE, PADDING_PAGE, PADDING_CARD, MARGIN_SECTION } from '@/lib/constants/styles';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import QuizManager from '@/components/admin/QuizManager';

interface UserInfo {
  id: string;
  userid: string;
  username: string;
  role: string;
  department?: string | null;
}

interface Lesson {
  id: string;
  title: string;
  lessonNumber: number;
  isActive: boolean;
  publishedAt: Date | null;
}

interface LessonDetail {
  id: string;
  title: string;
  description: string | null;
  bibleVerse: string | null;
  keyPoint: string | null;
  content: string | null;
  videoUrl: string | null;
  materialUrl: string | null;
  lessonNumber: number;
  isActive: boolean;
  publishedAt: Date | null;
  curriculum: {
    id: string;
    title: string;
    ageGroup: string;
  };
}

interface Curriculum {
  id: string;
  title: string;
  description: string | null;
  ageGroup: string;
  startDate: Date | null;
  endDate: Date | null;
  isActive: boolean;
  sortOrder: number;
  lessons: Lesson[];
}

interface Props {
  user: UserInfo;
  curriculums: Curriculum[];
}

const AGE_GROUP_NAMES = {
  KIDS: '유아부 (3-6세)',
  ELEMENTARY: '초등부 (7-12세)',
  MIDDLE: '중등부 (13-15세)',
  HIGH: '고등부 (16-18세)',
  YOUNG_ADULT: '청년부 (19-29세)',
};

export default function YouthNightAdminClient({ user, curriculums }: Props) {
  const [activeTab, setActiveTab] = useState<'curriculums' | 'lessons' | 'create' | 'recitations' | 'dashboard'>('curriculums');

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className={`${PADDING_PAGE}`}>
        <div className="max-w-7xl mx-auto">
          {/* 헤더 */}
          <div className={`text-center ${MARGIN_SECTION}`}>
            <h1 className={`${TEXT_HERO} text-gray-900 mb-2 sm:mb-4`}>
              청나잇 관리자 페이지
            </h1>
            <p className={`${TEXT_SUBTITLE} text-gray-700`}>
              교안 업로드 및 커리큘럼 관리
            </p>
            <p className="text-sm sm:text-base text-gray-600 mt-2">
              {user.username}님 (관리자)
            </p>
          </div>

          {/* 상단 네비게이션 */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab('curriculums')}
                className={`px-4 sm:px-6 py-3 text-sm sm:text-base font-semibold border-b-2 ${
                  activeTab === 'curriculums'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-700 hover:text-gray-900'
                }`}
              >
                커리큘럼 관리
              </button>
              <button
                onClick={() => setActiveTab('lessons')}
                className={`px-4 sm:px-6 py-3 text-sm sm:text-base font-semibold border-b-2 ${
                  activeTab === 'lessons'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-700 hover:text-gray-900'
                }`}
              >
                레슨 관리
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={`px-4 sm:px-6 py-3 text-sm sm:text-base font-semibold border-b-2 ${
                  activeTab === 'create'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-700 hover:text-gray-900'
                }`}
              >
                교안 업로드
              </button>
              <button
                onClick={() => setActiveTab('recitations')}
                className={`px-4 sm:px-6 py-3 text-sm sm:text-base font-semibold border-b-2 ${
                  activeTab === 'recitations'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-700 hover:text-gray-900'
                }`}
              >
                암송 승인
              </button>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-4 sm:px-6 py-3 text-sm sm:text-base font-semibold border-b-2 ${
                  activeTab === 'dashboard'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-700 hover:text-gray-900'
                }`}
              >
                통계 대시보드
              </button>
            </div>
          </div>

          {/* 탭 컨텐츠 */}
          {activeTab === 'curriculums' && (
            <CurriculumManagement curriculums={curriculums} />
          )}

          {activeTab === 'lessons' && (
            <LessonManagement curriculums={curriculums} />
          )}

          {activeTab === 'create' && (
            <CurriculumUpload />
          )}

          {activeTab === 'recitations' && (
            <RecitationApproval />
          )}

          {activeTab === 'dashboard' && (
            <StatsDashboard />
          )}

          {/* 뒤로가기 */}
          <div className="mt-8 text-center">
            <Link
              href="/youth-night"
              className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
            >
              ← 청나잇 메인으로 돌아가기
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

// 커리큘럼 생성 모달 컴포넌트
function CurriculumCreateModal({
  onClose,
  onSave,
  isSaving,
}: {
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    ageGroup: 'ELEMENTARY',
    startDate: '',
    endDate: '',
    sortOrder: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-black">새 커리큘럼 추가</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                커리큘럼 제목 *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="예: 2026년 5월 초등부 교안"
              />
            </div>

            <div>
              <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                대상 연령 *
              </label>
              <select
                required
                value={formData.ageGroup}
                onChange={(e) => setFormData({ ...formData, ageGroup: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {Object.entries(AGE_GROUP_NAMES).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                설명
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="커리큘럼에 대한 간단한 설명"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                  시작일
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                  종료일
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                정렬 순서
              </label>
              <input
                type="number"
                min="0"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-sm text-gray-700">낮은 숫자가 먼저 표시됩니다</p>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-black font-semibold hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? '생성 중...' : '커리큘럼 생성'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// 커리큘럼 수정 모달 컴포넌트
function CurriculumEditModal({
  curriculum,
  onClose,
  onSave,
  isSaving,
}: {
  curriculum: Curriculum;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  isSaving: boolean;
}) {
  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return new Date(date).toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    title: curriculum.title,
    description: curriculum.description || '',
    ageGroup: curriculum.ageGroup,
    startDate: formatDate(curriculum.startDate),
    endDate: formatDate(curriculum.endDate),
    sortOrder: curriculum.sortOrder,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-black">커리큘럼 수정</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                커리큘럼 제목 *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                대상 연령 *
              </label>
              <select
                required
                value={formData.ageGroup}
                onChange={(e) => setFormData({ ...formData, ageGroup: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {Object.entries(AGE_GROUP_NAMES).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                설명
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                  시작일
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                  종료일
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                정렬 순서
              </label>
              <input
                type="number"
                min="0"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-sm text-gray-700">낮은 숫자가 먼저 표시됩니다</p>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-black font-semibold hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// 드래그 가능한 레슨 아이템 컴포넌트
function SortableLessonItem({ lesson }: { lesson: Lesson }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border rounded-lg p-3 flex items-center justify-between ${
        isDragging ? 'shadow-lg ring-2 ring-blue-400' : ''
      }`}
    >
      <div className="flex items-center space-x-3">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 touch-none"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </button>
        <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
          #{lesson.lessonNumber}
        </span>
        <span className="text-sm sm:text-base font-medium text-gray-900">
          {lesson.title}
        </span>
      </div>
      <div className="flex items-center space-x-2">
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
          lesson.isActive
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-200 text-gray-700'
        }`}>
          {lesson.isActive ? '활성' : '비활성'}
        </span>
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
          lesson.publishedAt
            ? 'bg-blue-100 text-blue-800'
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {lesson.publishedAt ? '공개' : '비공개'}
        </span>
      </div>
    </div>
  );
}

// 커리큘럼 관리 컴포넌트
function CurriculumManagement({ curriculums: initialCurriculums }: { curriculums: Curriculum[] }) {
  const [curriculums, setCurriculums] = useState<Curriculum[]>(initialCurriculums);
  const [editingCurriculum, setEditingCurriculum] = useState<Curriculum | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedCurriculumId, setExpandedCurriculumId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  // DnD 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 드래그 종료 핸들러
  const handleDragEnd = async (event: DragEndEvent, curriculumId: string) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const curriculum = curriculums.find(c => c.id === curriculumId);
    if (!curriculum) return;

    const oldIndex = curriculum.lessons.findIndex(l => l.id === active.id);
    const newIndex = curriculum.lessons.findIndex(l => l.id === over.id);

    // 로컬 상태 먼저 업데이트 (즉시 반응)
    const newLessons = arrayMove(curriculum.lessons, oldIndex, newIndex).map((lesson, index) => ({
      ...lesson,
      lessonNumber: index + 1,
    }));

    setCurriculums(prev =>
      prev.map(c =>
        c.id === curriculumId ? { ...c, lessons: newLessons } : c
      )
    );

    // 서버에 저장
    setIsReordering(true);
    try {
      const response = await fetch('/api/youth-night/admin/lesson', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curriculumId,
          lessonIds: newLessons.map(l => l.id),
        }),
      });

      if (!response.ok) {
        // 실패 시 원래대로 복원
        setCurriculums(initialCurriculums);
        alert('레슨 순서 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error('레슨 순서 변경 실패:', error);
      setCurriculums(initialCurriculums);
      alert('레슨 순서 변경 중 오류가 발생했습니다.');
    } finally {
      setIsReordering(false);
    }
  };

  const handleCreateCurriculum = async (data: any) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/youth-night/admin/curriculum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curriculum: data,
          lessons: [], // 빈 레슨 배열로 커리큘럼만 생성
        }),
      });

      if (response.ok) {
        alert('커리큘럼이 생성되었습니다!');
        setIsCreateModalOpen(false);
        window.location.reload();
      } else {
        const errorData = await response.json();
        alert(`생성 실패: ${errorData.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('커리큘럼 생성 실패:', error);
      alert('커리큘럼 생성 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditCurriculum = async (data: any) => {
    if (!editingCurriculum) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/youth-night/admin/curriculum', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curriculumId: editingCurriculum.id,
          ...data,
        }),
      });

      if (response.ok) {
        alert('커리큘럼이 수정되었습니다!');
        setEditingCurriculum(null);
        window.location.reload();
      } else {
        const errorData = await response.json();
        alert(`수정 실패: ${errorData.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('커리큘럼 수정 실패:', error);
      alert('커리큘럼 수정 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (curriculumId: string, isActive: boolean) => {
    try {
      await fetch('/api/youth-night/admin/curriculum', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curriculumId, isActive: !isActive }),
      });
      window.location.reload();
    } catch (error) {
      console.error('커리큘럼 상태 변경 실패:', error);
    }
  };

  const handleDelete = async (curriculumId: string) => {
    if (!confirm('정말로 이 커리큘럼을 삭제하시겠습니까?')) return;

    try {
      await fetch('/api/youth-night/admin/curriculum', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curriculumId }),
      });
      window.location.reload();
    } catch (error) {
      console.error('커리큘럼 삭제 실패:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className={`${TEXT_SECTION_TITLE} text-gray-900`}>
            전체 커리큘럼 ({curriculums.length}개)
          </h2>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-semibold flex items-center space-x-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>커리큘럼 추가</span>
          </button>
        </div>

        <div className="space-y-4">
          {curriculums.map((curriculum) => {
            const isExpanded = expandedCurriculumId === curriculum.id;
            return (
              <div
                key={curriculum.id}
                className="border rounded-lg overflow-hidden"
              >
                <div
                  className="p-4 hover:bg-gray-50 cursor-pointer"
                  onDoubleClick={() => setExpandedCurriculumId(isExpanded ? null : curriculum.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedCurriculumId(isExpanded ? null : curriculum.id);
                          }}
                          className="text-gray-500 hover:text-gray-700 transition-transform"
                        >
                          <svg
                            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
                          {curriculum.title}
                        </h3>
                        <span className="text-sm sm:text-base text-gray-700">
                          {AGE_GROUP_NAMES[curriculum.ageGroup as keyof typeof AGE_GROUP_NAMES]}
                        </span>
                        <span className={`px-2 py-1 text-sm font-semibold rounded-full ${
                          curriculum.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-200 text-gray-700'
                        }`}>
                          {curriculum.isActive ? '활성' : '비활성'}
                        </span>
                      </div>
                      {curriculum.description && (
                        <p className="text-sm sm:text-base text-gray-700 mb-2 ml-8">
                          {curriculum.description}
                        </p>
                      )}
                      <div className="flex items-center space-x-4 text-sm text-gray-600 ml-8">
                        <span>{curriculum.lessons.length}개 레슨</span>
                        <span>순서: {curriculum.sortOrder}</span>
                        {curriculum.startDate && (
                          <span>
                            시작일: {new Date(curriculum.startDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedCurriculumId(isExpanded ? null : curriculum.id);
                        }}
                        className="px-3 py-1.5 text-sm font-semibold text-purple-800 bg-purple-100 rounded hover:bg-purple-200"
                      >
                        {isExpanded ? '접기' : '상세'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActive(curriculum.id, curriculum.isActive);
                        }}
                        className={`px-3 py-1.5 text-sm font-semibold rounded ${
                          curriculum.isActive
                            ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                            : 'bg-green-100 text-green-800 hover:bg-green-200'
                        }`}
                      >
                        {curriculum.isActive ? '비활성화' : '활성화'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCurriculum(curriculum);
                        }}
                        className="px-3 py-1.5 text-sm font-semibold text-blue-800 bg-blue-100 rounded hover:bg-blue-200"
                      >
                        수정
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(curriculum.id);
                        }}
                        className="px-3 py-1.5 text-sm font-semibold text-red-800 bg-red-100 rounded hover:bg-red-200"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>

                {/* 확장된 레슨 목록 */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-700">
                        레슨 목록 ({curriculum.lessons.length}개)
                      </h4>
                      {curriculum.lessons.length > 1 && (
                        <span className="text-xs text-gray-500 flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                          </svg>
                          드래그하여 순서 변경
                          {isReordering && <span className="ml-2 text-blue-600">저장 중...</span>}
                        </span>
                      )}
                    </div>
                    {curriculum.lessons.length > 0 ? (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => handleDragEnd(event, curriculum.id)}
                      >
                        <SortableContext
                          items={curriculum.lessons.map(l => l.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-2">
                            {curriculum.lessons.map((lesson) => (
                              <SortableLessonItem key={lesson.id} lesson={lesson} />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    ) : (
                      <div className="text-center py-6 text-gray-500">
                        <svg
                          className="w-10 h-10 text-gray-300 mx-auto mb-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                          />
                        </svg>
                        <p className="text-sm">아직 등록된 레슨이 없습니다</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 커리큘럼 생성 모달 */}
      {isCreateModalOpen && (
        <CurriculumCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          onSave={handleCreateCurriculum}
          isSaving={isSaving}
        />
      )}

      {/* 커리큘럼 수정 모달 */}
      {editingCurriculum && (
        <CurriculumEditModal
          curriculum={editingCurriculum}
          onClose={() => setEditingCurriculum(null)}
          onSave={handleEditCurriculum}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}

// 레슨 수정 모달 컴포넌트
function LessonEditModal({
  lesson,
  curriculums,
  onClose,
  onSave,
  isSaving,
}: {
  lesson: LessonDetail;
  curriculums: Curriculum[];
  onClose: () => void;
  onSave: (data: Partial<LessonDetail> & { curriculumId?: string }) => Promise<void>;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState({
    curriculumId: lesson.curriculum.id,
    title: lesson.title || '',
    description: lesson.description || '',
    bibleVerse: lesson.bibleVerse || '',
    keyPoint: lesson.keyPoint || '',
    content: lesson.content || '',
    videoUrl: lesson.videoUrl || '',
    materialUrl: lesson.materialUrl || '',
  });

  const isCurriculumChanged = formData.curriculumId !== lesson.curriculum.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-black">레슨 수정</h2>
              <p className="text-sm sm:text-base text-black mt-1">
                {lesson.curriculum.title} - 레슨 {lesson.lessonNumber}
                ({AGE_GROUP_NAMES[lesson.curriculum.ageGroup as keyof typeof AGE_GROUP_NAMES]})
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                커리큘럼 *
              </label>
              <select
                required
                value={formData.curriculumId}
                onChange={(e) => setFormData({ ...formData, curriculumId: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {curriculums.map((curriculum) => (
                  <option key={curriculum.id} value={curriculum.id}>
                    {curriculum.title} ({AGE_GROUP_NAMES[curriculum.ageGroup as keyof typeof AGE_GROUP_NAMES]})
                  </option>
                ))}
              </select>
              {isCurriculumChanged && (
                <p className="mt-1 text-sm text-orange-600">
                  ⚠️ 커리큘럼 변경 시 레슨 번호가 새 커리큘럼의 마지막 번호로 재할당됩니다.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                제목 *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                설명
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                  성경 구절
                </label>
                <input
                  type="text"
                  value={formData.bibleVerse}
                  onChange={(e) => setFormData({ ...formData, bibleVerse: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: 요한복음 3:16"
                />
              </div>

              <div>
                <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                  핵심 포인트
                </label>
                <input
                  type="text"
                  value={formData.keyPoint}
                  onChange={(e) => setFormData({ ...formData, keyPoint: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                내용 (마크다운 지원)
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={8}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="# 제목&#10;&#10;레슨 내용을 마크다운 형식으로 작성하세요."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                  비디오 URL
                </label>
                <input
                  type="url"
                  value={formData.videoUrl}
                  onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                  교재 URL
                </label>
                <input
                  type="url"
                  value={formData.materialUrl}
                  onChange={(e) => setFormData({ ...formData, materialUrl: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-black font-semibold hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// 레슨 생성 모달 컴포넌트
function LessonCreateModal({
  curriculums,
  onClose,
  onSave,
  isSaving,
}: {
  curriculums: Curriculum[];
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState({
    curriculumId: curriculums[0]?.id || '',
    title: '',
    description: '',
    bibleVerse: '',
    keyPoint: '',
    content: '',
    videoUrl: '',
    materialUrl: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-black">새 레슨 추가</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                커리큘럼 선택 *
              </label>
              <select
                required
                value={formData.curriculumId}
                onChange={(e) => setFormData({ ...formData, curriculumId: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {curriculums.map((curriculum) => (
                  <option key={curriculum.id} value={curriculum.id}>
                    {curriculum.title} ({AGE_GROUP_NAMES[curriculum.ageGroup as keyof typeof AGE_GROUP_NAMES]})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                레슨 제목 *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="예: 하나님의 사랑"
              />
            </div>

            <div>
              <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                설명
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="레슨에 대한 간단한 설명"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                  성경 구절
                </label>
                <input
                  type="text"
                  value={formData.bibleVerse}
                  onChange={(e) => setFormData({ ...formData, bibleVerse: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: 요한복음 3:16"
                />
              </div>

              <div>
                <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                  핵심 포인트
                </label>
                <input
                  type="text"
                  value={formData.keyPoint}
                  onChange={(e) => setFormData({ ...formData, keyPoint: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="이 레슨의 핵심 메시지"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                내용 (마크다운 지원)
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={8}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="# 제목&#10;&#10;레슨 내용을 마크다운 형식으로 작성하세요."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                  비디오 URL
                </label>
                <input
                  type="url"
                  value={formData.videoUrl}
                  onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                  교재 URL
                </label>
                <input
                  type="url"
                  value={formData.materialUrl}
                  onChange={(e) => setFormData({ ...formData, materialUrl: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-black font-semibold hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? '생성 중...' : '레슨 생성'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// 레슨 관리 컴포넌트
function LessonManagement({ curriculums }: { curriculums: Curriculum[] }) {
  const [editingLesson, setEditingLesson] = useState<LessonDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [quizManagingLesson, setQuizManagingLesson] = useState<{ id: string; title: string } | null>(null);

  const handleCreateLesson = async (data: any) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/youth-night/admin/lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        alert('레슨이 생성되었습니다!');
        setIsCreateModalOpen(false);
        window.location.reload();
      } else {
        const errorData = await response.json();
        alert(`생성 실패: ${errorData.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('레슨 생성 실패:', error);
      alert('레슨 생성 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const allLessons = curriculums.flatMap(curriculum =>
    curriculum.lessons.map(lesson => ({
      ...lesson,
      curriculumTitle: curriculum.title,
      curriculumAgeGroup: curriculum.ageGroup,
    }))
  );

  const handleTogglePublish = async (lessonId: string, publishedAt: Date | null) => {
    try {
      await fetch('/api/youth-night/admin/lesson', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          publishedAt: publishedAt ? null : new Date(),
        }),
      });
      window.location.reload();
    } catch (error) {
      console.error('레슨 공개 상태 변경 실패:', error);
    }
  };

  const handleOpenEditModal = async (lessonId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/youth-night/admin/lesson?lessonId=${lessonId}`);
      if (response.ok) {
        const lessonData = await response.json();
        setEditingLesson(lessonData);
        setIsModalOpen(true);
      } else {
        alert('레슨 정보를 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('레슨 조회 실패:', error);
      alert('레슨 정보를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveLesson = async (data: Partial<LessonDetail>) => {
    if (!editingLesson) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/youth-night/admin/lesson', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: editingLesson.id,
          ...data,
        }),
      });

      if (response.ok) {
        alert('레슨이 수정되었습니다.');
        setIsModalOpen(false);
        setEditingLesson(null);
        window.location.reload();
      } else {
        const errorData = await response.json();
        alert(`수정 실패: ${errorData.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('레슨 수정 실패:', error);
      alert('레슨 수정 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingLesson(null);
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className={`${TEXT_SECTION_TITLE} text-gray-900`}>
            전체 레슨 ({allLessons.length}개)
          </h2>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            disabled={curriculums.length === 0}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-semibold flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>레슨 추가</span>
          </button>
        </div>

        {curriculums.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            레슨을 추가하려면 먼저 커리큘럼을 생성해주세요.
          </div>
        )}

        <div className="space-y-3">
          {allLessons.map((lesson) => (
            <div
              key={lesson.id}
              className="border rounded-lg p-4 hover:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-base sm:text-lg font-semibold text-gray-900">
                      {lesson.curriculumTitle} - 레슨 {lesson.lessonNumber}
                    </span>
                    <span className="text-sm text-gray-700">
                      ({AGE_GROUP_NAMES[lesson.curriculumAgeGroup as keyof typeof AGE_GROUP_NAMES]})
                    </span>
                  </div>
                  <p className="text-sm sm:text-base text-gray-700 mb-2">{lesson.title}</p>
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 text-sm font-semibold rounded-full ${
                      lesson.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      {lesson.isActive ? '활성' : '비활성'}
                    </span>
                    <span className={`px-2 py-1 text-sm font-semibold rounded-full ${
                      lesson.publishedAt
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {lesson.publishedAt ? '공개' : '비공개'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setQuizManagingLesson({ id: lesson.id, title: lesson.title })}
                    className="px-3 py-1.5 text-sm font-semibold text-purple-800 bg-purple-100 rounded hover:bg-purple-200"
                  >
                    퀴즈
                  </button>
                  <button
                    onClick={() => handleOpenEditModal(lesson.id)}
                    disabled={isLoading}
                    className="px-3 py-1.5 text-sm font-semibold text-blue-800 bg-blue-100 rounded hover:bg-blue-200 disabled:opacity-50"
                  >
                    {isLoading ? '...' : '수정'}
                  </button>
                  <button
                    onClick={() => handleTogglePublish(lesson.id, lesson.publishedAt)}
                    className={`px-3 py-1.5 text-sm font-semibold rounded ${
                      lesson.publishedAt
                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                    }`}
                  >
                    {lesson.publishedAt ? '비공개' : '공개'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 레슨 수정 모달 */}
      {isModalOpen && editingLesson && (
        <LessonEditModal
          lesson={editingLesson}
          curriculums={curriculums}
          onClose={handleCloseModal}
          onSave={handleSaveLesson}
          isSaving={isSaving}
        />
      )}

      {/* 레슨 생성 모달 */}
      {isCreateModalOpen && (
        <LessonCreateModal
          curriculums={curriculums}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={handleCreateLesson}
          isSaving={isSaving}
        />
      )}

      {/* 퀴즈 관리 패널 */}
      <QuizManager
        lessonId={quizManagingLesson?.id || ''}
        lessonTitle={quizManagingLesson?.title || ''}
        isOpen={!!quizManagingLesson}
        onClose={() => setQuizManagingLesson(null)}
      />
    </div>
  );
}

// 교안 업로드 컴포넌트
function CurriculumUpload() {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    ageGroup: 'KIDS',
    startDate: '',
    endDate: '',
    sortOrder: 0,
  });

  const [lessons, setLessons] = useState([
    {
      title: '',
      description: '',
      bibleVerse: '',
      keyPoint: '',
      content: '',
      lessonNumber: 1,
    }
  ]);

  const [loading, setLoading] = useState(false);

  const handleAddLesson = () => {
    setLessons([...lessons, {
      title: '',
      description: '',
      bibleVerse: '',
      keyPoint: '',
      content: '',
      lessonNumber: lessons.length + 1,
    }]);
  };

  const handleRemoveLesson = (index: number) => {
    const newLessons = lessons.filter((_, i) => i !== index);
    // 레슨 번호 재정렬
    const reorderedLessons = newLessons.map((lesson, i) => ({
      ...lesson,
      lessonNumber: i + 1,
    }));
    setLessons(reorderedLessons);
  };

  const handleLessonChange = (index: number, field: string, value: string) => {
    const newLessons = [...lessons];
    newLessons[index] = { ...newLessons[index], [field]: value };
    setLessons(newLessons);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/youth-night/admin/curriculum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curriculum: formData,
          lessons,
        }),
      });

      if (response.ok) {
        alert('교안이 성공적으로 업로드되었습니다!');
        // 폼 리셋
        setFormData({
          title: '',
          description: '',
          ageGroup: 'KIDS',
          startDate: '',
          endDate: '',
          sortOrder: 0,
        });
        setLessons([{
          title: '',
          description: '',
          bibleVerse: '',
          keyPoint: '',
          content: '',
          lessonNumber: 1,
        }]);
      } else {
        throw new Error('업로드 실패');
      }
    } catch (error) {
      console.error('교안 업로드 실패:', error);
      alert('교안 업로드에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
        <h2 className={`${TEXT_SECTION_TITLE} text-black mb-6`}>
          새 교안 업로드
        </h2>

        {/* 커리큘럼 기본 정보 */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm sm:text-base font-semibold text-black mb-2">
              커리큘럼 제목 *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="예: 2024년 청나잇 말씀 시리즈"
            />
          </div>

          <div>
            <label className="block text-sm sm:text-base font-semibold text-black mb-2">
              대상 연령 *
            </label>
            <select
              required
              value={formData.ageGroup}
              onChange={(e) => setFormData({ ...formData, ageGroup: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Object.entries(AGE_GROUP_NAMES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm sm:text-base font-semibold text-black mb-2">
              시작일
            </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm sm:text-base font-semibold text-black mb-2">
              종료일
            </label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm sm:text-base font-semibold text-black mb-2">
              정렬 순서
            </label>
            <input
              type="number"
              min="0"
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm sm:text-base font-semibold text-black mb-2">
            커리큘럼 설명
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="커리큘럼에 대한 간단한 설명을 입력해주세요"
          />
        </div>

        {/* 레슨들 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg sm:text-xl font-semibold text-black">레슨 목록</h3>
            <button
              type="button"
              onClick={handleAddLesson}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold"
            >
              + 레슨 추가
            </button>
          </div>

          <div className="space-y-6">
            {lessons.map((lesson, index) => (
              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-black text-base sm:text-lg">레슨 {index + 1}</h4>
                  {lessons.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLesson(index)}
                      className="text-red-600 hover:text-red-800 text-sm font-semibold"
                    >
                      삭제
                    </button>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                      레슨 제목 *
                    </label>
                    <input
                      type="text"
                      required
                      value={lesson.title}
                      onChange={(e) => handleLessonChange(index, 'title', e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-black focus:ring-2 focus:ring-blue-500"
                      placeholder="예: 하나님의 사랑"
                    />
                  </div>

                  <div>
                    <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                      성경 구절
                    </label>
                    <input
                      type="text"
                      value={lesson.bibleVerse}
                      onChange={(e) => handleLessonChange(index, 'bibleVerse', e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-black focus:ring-2 focus:ring-blue-500"
                      placeholder="예: 요한복음 3:16"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                      레슨 설명
                    </label>
                    <input
                      type="text"
                      value={lesson.description}
                      onChange={(e) => handleLessonChange(index, 'description', e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-black focus:ring-2 focus:ring-blue-500"
                      placeholder="레슨에 대한 간단한 설명"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                      핵심 포인트
                    </label>
                    <input
                      type="text"
                      value={lesson.keyPoint}
                      onChange={(e) => handleLessonChange(index, 'keyPoint', e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-black focus:ring-2 focus:ring-blue-500"
                      placeholder="이 레슨의 핵심 메시지"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                      레슨 내용 (마크다운 지원)
                    </label>
                    <textarea
                      value={lesson.content}
                      onChange={(e) => handleLessonChange(index, 'content', e.target.value)}
                      rows={6}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 font-mono"
                      placeholder="# 제목&#10;&#10;## 소제목&#10;&#10;레슨 내용을 마크다운 형식으로 작성하세요.&#10;&#10;**굵은글씨**, *기울임글씨*, `코드` 등을 사용할 수 있습니다."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 제출 버튼 */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => {
              if (confirm('입력한 내용이 모두 사라집니다. 계속하시겠습니까?')) {
                window.location.reload();
              }
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-black font-semibold hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '업로드 중...' : '교안 업로드'}
          </button>
        </div>
      </form>
    </div>
  );
}

// 암송 승인 컴포넌트
function RecitationApproval() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    status: 'PENDING',
    ageGroup: '',
  });
  const [approving, setApproving] = useState<string | null>(null);

  const fetchSubmissions = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filter.status) queryParams.append('status', filter.status);
      if (filter.ageGroup) queryParams.append('ageGroup', filter.ageGroup);

      const response = await fetch(`/api/youth-night/recitation/approve?${queryParams}`);
      const data = await response.json();

      if (response.ok) {
        setSubmissions(data.submissions || []);
      } else {
        console.error('암송 목록 조회 실패:', data.error);
      }
    } catch (error) {
      console.error('암송 목록 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleApprove = async (submissionId: string, score: number) => {
    if (!confirm(`${score}점으로 암송을 승인하시겠습니까?`)) return;

    setApproving(submissionId);
    try {
      const response = await fetch('/api/youth-night/recitation/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          action: 'approve',
          score,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(`암송이 승인되었습니다! (${data.pointsAwarded}점 획득)`);
        fetchSubmissions();
      } else {
        alert(`승인 실패: ${data.error}`);
      }
    } catch (error) {
      console.error('암송 승인 오류:', error);
      alert('암송 승인 중 오류가 발생했습니다.');
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (submissionId: string) => {
    const rejectionReason = prompt('반려 사유를 입력하세요:');
    if (!rejectionReason) return;

    setApproving(submissionId);
    try {
      const response = await fetch('/api/youth-night/recitation/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          action: 'reject',
          rejectionReason,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert('암송이 반려되었습니다.');
        fetchSubmissions();
      } else {
        alert(`반려 실패: ${data.error}`);
      }
    } catch (error) {
      console.error('암송 반려 오류:', error);
      alert('암송 반려 중 오류가 발생했습니다.');
    } finally {
      setApproving(null);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING': return '승인 대기';
      case 'APPROVED': return '승인됨';
      case 'REJECTED': return '반려됨';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6">
        {/* 필터 */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h2 className={`${TEXT_SECTION_TITLE} text-gray-900`}>
            암송 승인 관리
          </h2>

          <div className="flex items-center space-x-3">
            <select
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              className="text-sm border border-gray-300 rounded px-3 py-1"
            >
              <option value="PENDING">승인 대기</option>
              <option value="APPROVED">승인됨</option>
              <option value="REJECTED">반려됨</option>
            </select>

            <select
              value={filter.ageGroup}
              onChange={(e) => setFilter({ ...filter, ageGroup: e.target.value })}
              className="text-sm border border-gray-300 rounded px-3 py-1"
            >
              <option value="">전체 연령</option>
              {Object.entries(AGE_GROUP_NAMES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 암송 목록 */}
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-gray-500">암송 목록을 불러오는 중...</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-8">
            <svg
              className="w-16 h-16 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-gray-500">
              {filter.status === 'PENDING' ? '승인 대기 중인' : getStatusText(filter.status)} 암송이 없습니다
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => (
              <div
                key={submission.id}
                className="border rounded-lg p-4 hover:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-medium text-gray-900">
                        {submission.lesson.curriculum.title} - 레슨 {submission.lesson.lessonNumber}
                      </h3>
                      <span className="text-sm text-gray-500">
                        ({AGE_GROUP_NAMES[submission.lesson.curriculum.ageGroup as keyof typeof AGE_GROUP_NAMES]})
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(submission.status)}`}>
                        {getStatusText(submission.status)}
                      </span>
                    </div>

                    <p className="text-gray-600 mb-2">{submission.lesson.title}</p>
                    <p className="text-sm text-gray-500 mb-2">성경 구절: {submission.bibleVerse}</p>

                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>제출자: {submission.user.username}</span>
                      <span>제출일: {new Date(submission.submittedAt).toLocaleDateString()}</span>
                      {submission.status === 'APPROVED' && (
                        <span className="text-green-600">점수: {submission.score}점</span>
                      )}
                      {submission.status === 'REJECTED' && (
                        <span className="text-red-600">반려 사유: {submission.rejectionReason}</span>
                      )}
                      {submission.approver && (
                        <span>처리자: {submission.approver.username}</span>
                      )}
                    </div>

                    {/* 제출 내용 */}
                    <div className="mt-3 p-3 bg-gray-50 rounded">
                      {submission.audioUrl && (
                        <div className="mb-2">
                          <label className="block text-sm sm:text-base font-semibold text-gray-800 mb-1">
                            음성 파일:
                          </label>
                          <audio controls className="w-full max-w-md">
                            <source src={submission.audioUrl} type="audio/mpeg" />
                            브라우저가 오디오를 지원하지 않습니다.
                          </audio>
                        </div>
                      )}

                      {submission.videoUrl && (
                        <div className="mb-2">
                          <label className="block text-sm sm:text-base font-semibold text-gray-800 mb-1">
                            영상 파일:
                          </label>
                          <video controls className="w-full max-w-md h-32">
                            <source src={submission.videoUrl} type="video/mp4" />
                            브라우저가 비디오를 지원하지 않습니다.
                          </video>
                        </div>
                      )}

                      {submission.textContent && (
                        <div>
                          <label className="block text-sm sm:text-base font-semibold text-gray-800 mb-1">
                            텍스트 암송:
                          </label>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">
                            {submission.textContent}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 승인/반려 버튼 */}
                  {submission.status === 'PENDING' && (
                    <div className="flex flex-col space-y-2 ml-4">
                      <div className="flex space-x-2">
                        {[95, 85, 75, 65].map((score) => (
                          <button
                            key={score}
                            onClick={() => handleApprove(submission.id, score)}
                            disabled={approving === submission.id}
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              score >= 95 ? 'bg-green-100 text-green-800 hover:bg-green-200' :
                              score >= 85 ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' :
                              score >= 75 ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' :
                              'bg-orange-100 text-orange-800 hover:bg-orange-200'
                            } disabled:opacity-50`}
                          >
                            {score}점
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => handleReject(submission.id)}
                        disabled={approving === submission.id}
                        className="px-3 py-1 text-xs font-medium text-red-800 bg-red-100 rounded hover:bg-red-200 disabled:opacity-50"
                      >
                        반려
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 통계 대시보드 컴포넌트
function StatsDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState('');

  const fetchStats = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (selectedAgeGroup) queryParams.append('ageGroup', selectedAgeGroup);

      const response = await fetch(`/api/youth-night/stats?${queryParams}`);
      const data = await response.json();

      if (response.ok) {
        setStats(data);
      } else {
        console.error('통계 데이터 조회 실패:', data.error);
      }
    } catch (error) {
      console.error('통계 데이터 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgeGroup]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-gray-500">통계 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="text-center">
          <p className="text-gray-500">통계 데이터를 불러올 수 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 및 필터 */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className={`${TEXT_SECTION_TITLE} text-gray-900`}>
            청나잇 통계 대시보드
          </h2>

          <div className="flex items-center space-x-3">
            <label className="text-sm font-medium text-gray-700">연령별 필터:</label>
            <select
              value={selectedAgeGroup}
              onChange={(e) => setSelectedAgeGroup(e.target.value)}
              className="text-sm border border-gray-300 rounded px-3 py-1"
            >
              <option value="">전체 연령</option>
              {Object.entries(AGE_GROUP_NAMES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 전체 현황 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl sm:text-3xl font-bold text-blue-600">
            {stats.overview?.totalUsers || 0}
          </div>
          <div className="text-sm text-gray-600">총 사용자 수</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl sm:text-3xl font-bold text-green-600">
            {stats.overview?.totalLessons || 0}
          </div>
          <div className="text-sm text-gray-600">총 레슨 수</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl sm:text-3xl font-bold text-purple-600">
            {stats.overview?.totalAttendance || 0}
          </div>
          <div className="text-sm text-gray-600">총 출석 수</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl sm:text-3xl font-bold text-orange-600">
            {stats.overview?.totalPoints || 0}
          </div>
          <div className="text-sm text-gray-600">총 포인트</div>
        </div>
      </div>

      {/* 상세 통계 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* 최근 활동 */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">최근 30일 활동</h3>

          {stats.dailyActivity && stats.dailyActivity.length > 0 ? (
            <div className="space-y-3">
              {stats.dailyActivity.slice(0, 7).map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <div className="font-medium text-gray-900">
                      {new Date(item.date).toLocaleDateString('ko-KR')}
                    </div>
                    <div className="text-sm text-gray-500">일별 활동</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-blue-600">{item.activities}</div>
                    <div className="text-sm text-gray-500">활동</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              최근 활동 데이터가 없습니다.
            </div>
          )}
        </div>

        {/* 전체 현황 요약 */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">전체 현황 요약</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
              <span className="font-medium text-gray-900">활성 커리큘럼</span>
              <span className="text-lg font-semibold text-blue-600">{stats.overview?.activeCurriculums || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded">
              <span className="font-medium text-gray-900">총 퀴즈 응답</span>
              <span className="text-lg font-semibold text-green-600">{stats.overview?.totalQuizResponses || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded">
              <span className="font-medium text-gray-900">총 암송 제출</span>
              <span className="text-lg font-semibold text-purple-600">{stats.overview?.totalRecitations || 0}</span>
            </div>
          </div>
        </div>

        {/* 포인트 타입별 분포 */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">포인트 타입별 분포</h3>

          {stats.pointDistribution && stats.pointDistribution.length > 0 ? (
            <div className="space-y-3">
              {stats.pointDistribution.map((item: any) => (
                <div key={item.type} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <div className="font-medium text-gray-900">
                      {item.type === 'ATTENDANCE' && '출석'}
                      {item.type === 'QUIZ_PERFECT' && '퀴즈 만점'}
                      {item.type === 'QUIZ_GOOD' && '퀴즈 우수'}
                      {item.type === 'RECITATION' && '암송'}
                      {item.type === 'LESSON_COMPLETE' && '레슨 완료'}
                    </div>
                    <div className="text-sm text-gray-500">{item.count}건</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-purple-600">{item.totalPoints}</div>
                    <div className="text-sm text-gray-500">포인트</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              포인트 분포 데이터가 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* 상위 학습자 랭킹 */}
      {stats.topLearners && stats.topLearners.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">상위 학습자 랭킹</h3>

          <div className="space-y-3">
            {stats.topLearners.map((learner: any, index: number) => (
              <div key={learner.user?.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                    index === 0 ? 'bg-yellow-500' :
                    index === 1 ? 'bg-gray-400' :
                    index === 2 ? 'bg-orange-400' :
                    'bg-gray-300'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{learner.user?.username || '알 수 없음'}</div>
                    <div className="text-sm text-gray-500">상위 학습자</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-purple-600">{learner.totalPoints}</div>
                  <div className="text-sm text-gray-500">포인트</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}