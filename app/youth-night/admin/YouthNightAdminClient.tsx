'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { TEXT_HERO, TEXT_SUBTITLE, TEXT_SECTION_TITLE, PADDING_PAGE, PADDING_CARD, MARGIN_SECTION } from '@/lib/constants/styles';

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
  const [activeTab, setActiveTab] = useState<'curriculums' | 'lessons' | 'create' | 'recitations'>('curriculums');

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
            <p className={`${TEXT_SUBTITLE} text-gray-600`}>
              교안 업로드 및 커리큘럼 관리
            </p>
            <p className="text-xs sm:text-sm text-gray-500 mt-2">
              {user.username}님 (관리자)
            </p>
          </div>

          {/* 상단 네비게이션 */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab('curriculums')}
                className={`px-4 sm:px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'curriculums'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                커리큘럼 관리
              </button>
              <button
                onClick={() => setActiveTab('lessons')}
                className={`px-4 sm:px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'lessons'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                레슨 관리
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={`px-4 sm:px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'create'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                교안 업로드
              </button>
              <button
                onClick={() => setActiveTab('recitations')}
                className={`px-4 sm:px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'recitations'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                암송 승인
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

// 커리큘럼 관리 컴포넌트
function CurriculumManagement({ curriculums }: { curriculums: Curriculum[] }) {
  const [editingCurriculum, setEditingCurriculum] = useState<string | null>(null);

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
        </div>

        <div className="space-y-4">
          {curriculums.map((curriculum) => (
            <div
              key={curriculum.id}
              className="border rounded-lg p-4 hover:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-medium text-gray-900">
                      {curriculum.title}
                    </h3>
                    <span className="text-sm text-gray-500">
                      {AGE_GROUP_NAMES[curriculum.ageGroup as keyof typeof AGE_GROUP_NAMES]}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      curriculum.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {curriculum.isActive ? '활성' : '비활성'}
                    </span>
                  </div>
                  {curriculum.description && (
                    <p className="text-sm text-gray-600 mb-2">
                      {curriculum.description}
                    </p>
                  )}
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
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
                    onClick={() => handleToggleActive(curriculum.id, curriculum.isActive)}
                    className={`px-3 py-1 text-xs font-medium rounded ${
                      curriculum.isActive
                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                    }`}
                  >
                    {curriculum.isActive ? '비활성화' : '활성화'}
                  </button>
                  <button
                    onClick={() => setEditingCurriculum(curriculum.id)}
                    className="px-3 py-1 text-xs font-medium text-blue-800 bg-blue-100 rounded hover:bg-blue-200"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(curriculum.id)}
                    className="px-3 py-1 text-xs font-medium text-red-800 bg-red-100 rounded hover:bg-red-200"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 레슨 관리 컴포넌트
function LessonManagement({ curriculums }: { curriculums: Curriculum[] }) {
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

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className={`${TEXT_SECTION_TITLE} text-gray-900`}>
            전체 레슨 ({allLessons.length}개)
          </h2>
        </div>

        <div className="space-y-3">
          {allLessons.map((lesson) => (
            <div
              key={lesson.id}
              className="border rounded-lg p-3 hover:bg-gray-50 text-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium text-gray-900">
                      {lesson.curriculumTitle} - 레슨 {lesson.lessonNumber}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({AGE_GROUP_NAMES[lesson.curriculumAgeGroup as keyof typeof AGE_GROUP_NAMES]})
                    </span>
                  </div>
                  <p className="text-gray-600 mb-1">{lesson.title}</p>
                  <div className="flex items-center space-x-3 text-xs text-gray-500">
                    <span className={`px-2 py-0.5 rounded-full ${
                      lesson.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {lesson.isActive ? '활성' : '비활성'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full ${
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
                    onClick={() => handleTogglePublish(lesson.id, lesson.publishedAt)}
                    className={`px-3 py-1 text-xs font-medium rounded ${
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
        <h2 className={`${TEXT_SECTION_TITLE} text-gray-900 mb-6`}>
          새 교안 업로드
        </h2>

        {/* 커리큘럼 기본 정보 */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              커리큘럼 제목 *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="예: 2024년 청나잇 말씀 시리즈"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              대상 연령 *
            </label>
            <select
              required
              value={formData.ageGroup}
              onChange={(e) => setFormData({ ...formData, ageGroup: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Object.entries(AGE_GROUP_NAMES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              시작일
            </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              종료일
            </label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              정렬 순서
            </label>
            <input
              type="number"
              min="0"
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            커리큘럼 설명
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="커리큘럼에 대한 간단한 설명을 입력해주세요"
          />
        </div>

        {/* 레슨들 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">레슨 목록</h3>
            <button
              type="button"
              onClick={handleAddLesson}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 text-sm"
            >
              + 레슨 추가
            </button>
          </div>

          <div className="space-y-6">
            {lessons.map((lesson, index) => (
              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900">레슨 {index + 1}</h4>
                  {lessons.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLesson(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      삭제
                    </button>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      레슨 제목 *
                    </label>
                    <input
                      type="text"
                      required
                      value={lesson.title}
                      onChange={(e) => handleLessonChange(index, 'title', e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="예: 하나님의 사랑"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      성경 구절
                    </label>
                    <input
                      type="text"
                      value={lesson.bibleVerse}
                      onChange={(e) => handleLessonChange(index, 'bibleVerse', e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="예: 요한복음 3:16"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      레슨 설명
                    </label>
                    <input
                      type="text"
                      value={lesson.description}
                      onChange={(e) => handleLessonChange(index, 'description', e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="레슨에 대한 간단한 설명"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      핵심 포인트
                    </label>
                    <input
                      type="text"
                      value={lesson.keyPoint}
                      onChange={(e) => handleLessonChange(index, 'keyPoint', e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="이 레슨의 핵심 메시지"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      레슨 내용 (마크다운 지원)
                    </label>
                    <textarea
                      value={lesson.content}
                      onChange={(e) => handleLessonChange(index, 'content', e.target.value)}
                      rows={6}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 font-mono"
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
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
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

  useEffect(() => {
    fetchSubmissions();
  }, [filter]);

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
                          <label className="block text-sm font-medium text-gray-700 mb-1">
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
                          <label className="block text-sm font-medium text-gray-700 mb-1">
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
                          <label className="block text-sm font-medium text-gray-700 mb-1">
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