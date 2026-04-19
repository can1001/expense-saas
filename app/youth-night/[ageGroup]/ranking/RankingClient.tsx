'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: string;
  username: string;
  userid: string;
}

interface PointBreakdown {
  [key: string]: {
    points: number;
    count: number;
  };
}

interface RankingData {
  rank: number;
  user: User | null;
  totalPoints: number;
  totalActivities: number;
  pointBreakdown: PointBreakdown;
  stats: {
    attendance: number;
    quiz: {
      totalResponses: number;
      correctAnswers: number;
      accuracy: number;
    };
    recitation: {
      approved: number;
      total: number;
    };
  };
}

interface Curriculum {
  id: string;
  title: string;
}

interface RankingClientProps {
  user: User;
  ageGroup: string;
  urlAgeGroup: string;
  curriculums: Curriculum[];
}

const AGE_GROUP_NAMES = {
  KIDS: '키즈',
  ELEMENTARY: '초등부',
  MIDDLE: '중등부',
  HIGH: '고등부',
  YOUNG_ADULT: '청년',
};

const POINT_TYPE_NAMES = {
  ATTENDANCE: '출석',
  QUIZ_PERFECT: '퀴즈 만점',
  QUIZ_GOOD: '퀴즈 우수',
  LESSON_COMPLETE: '레슨 완료',
  RECITATION: '암송',
};

export default function RankingClient({ user, ageGroup, urlAgeGroup, curriculums }: RankingClientProps) {
  const [rankings, setRankings] = useState<RankingData[]>([]);
  const [currentUserRank, setCurrentUserRank] = useState<RankingData | null>(null);
  const [selectedCurriculum, setSelectedCurriculum] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    fetchRankings();
  }, [selectedCurriculum]);

  const fetchRankings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        ageGroup: ageGroup,
        limit: '20',
      });

      if (selectedCurriculum) {
        params.append('curriculumId', selectedCurriculum);
      }

      const response = await fetch(`/api/youth-night/ranking?${params}`);
      if (!response.ok) {
        throw new Error('랭킹 데이터를 불러오는 데 실패했습니다');
      }

      const data = await response.json();
      setRankings(data.rankings);
      setCurrentUserRank(data.currentUserRank);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return '🏆';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return rank.toString();
    }
  };

  const getPointTypeColor = (pointType: string) => {
    switch (pointType) {
      case 'ATTENDANCE':
        return 'bg-blue-100 text-blue-800';
      case 'QUIZ_PERFECT':
        return 'bg-purple-100 text-purple-800';
      case 'QUIZ_GOOD':
        return 'bg-indigo-100 text-indigo-800';
      case 'LESSON_COMPLETE':
        return 'bg-green-100 text-green-800';
      case 'RECITATION':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-6"></div>
            <div className="space-y-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-20 bg-white rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchRankings}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => router.back()}
                className="mb-2 text-gray-600 hover:text-gray-800"
              >
                ← 뒤로가기
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                🏆 {AGE_GROUP_NAMES[ageGroup as keyof typeof AGE_GROUP_NAMES]} 랭킹
              </h1>
            </div>
            <Link
              href={`/youth-night/${urlAgeGroup}`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              학습하러 가기
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {/* 필터 */}
        <div className="mb-6">
          <select
            value={selectedCurriculum}
            onChange={(e) => setSelectedCurriculum(e.target.value)}
            className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">전체 커리큘럼</option>
            {curriculums.map((curriculum) => (
              <option key={curriculum.id} value={curriculum.id}>
                {curriculum.title}
              </option>
            ))}
          </select>
        </div>

        {/* 내 랭킹 */}
        {currentUserRank && (
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-blue-900 mb-3">내 순위</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="text-2xl font-bold text-blue-600">
                  {getRankIcon(currentUserRank.rank)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{currentUserRank.user?.username}</p>
                  <p className="text-sm text-gray-600">{currentUserRank.rank}위</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-600">
                  {currentUserRank.totalPoints.toLocaleString()}점
                </p>
                <p className="text-sm text-gray-600">
                  총 {currentUserRank.totalActivities}개 활동
                </p>
              </div>
            </div>

            {/* 포인트 분석 */}
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(currentUserRank.pointBreakdown).map(([type, data]) => (
                <span
                  key={type}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${getPointTypeColor(type)}`}
                >
                  {POINT_TYPE_NAMES[type as keyof typeof POINT_TYPE_NAMES] || type}: {data.points}점
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 랭킹 리스트 */}
        <div className="space-y-3">
          {rankings.length > 0 ? (
            rankings.map((ranking) => (
              <div
                key={ranking.user?.id}
                className={`bg-white rounded-lg shadow-sm border p-4 ${
                  ranking.user?.id === user.id ? 'ring-2 ring-blue-300 bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-xl font-bold text-gray-700 w-12 text-center">
                      {getRankIcon(ranking.rank)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {ranking.user?.username}
                        {ranking.user?.id === user.id && (
                          <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            나
                          </span>
                        )}
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>출석 {ranking.stats.attendance}회</span>
                        <span>퀴즈 정확도 {ranking.stats.quiz.accuracy}%</span>
                        <span>암송 {ranking.stats.recitation.approved}회</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900">
                      {ranking.totalPoints.toLocaleString()}점
                    </p>
                    <p className="text-sm text-gray-600">
                      총 {ranking.totalActivities}개 활동
                    </p>
                  </div>
                </div>

                {/* 포인트 세부 분석 */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {Object.entries(ranking.pointBreakdown).map(([type, data]) => (
                    <span
                      key={type}
                      className={`px-2 py-1 rounded text-xs ${getPointTypeColor(type)}`}
                    >
                      {POINT_TYPE_NAMES[type as keyof typeof POINT_TYPE_NAMES] || type}: {data.points}점
                    </span>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
              <p className="text-gray-500">아직 랭킹 데이터가 없습니다.</p>
              <p className="text-sm text-gray-400 mt-2">
                학습에 참여하여 포인트를 획득해보세요!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}