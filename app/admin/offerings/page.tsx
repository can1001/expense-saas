'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { HandCoins, Search, Upload, Calendar, Download, Trash2, Plus, Edit2, X, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { OfferingType } from '@prisma/client';
import {
  SECTION_CARD,
  BTN_PRIMARY,
  BTN_OUTLINE,
  BTN_DANGER,
  BTN_SM,
  INPUT_BASE,
  SELECT_BASE,
  TABLE_BASE,
  TABLE_HEADER,
  TABLE_HEADER_CELL,
  TABLE_BODY,
  TABLE_CELL,
  TABLE_CELL_RIGHT,
  TAB_CONTAINER,
  TAB_ACTIVE,
  TAB_INACTIVE,
  SPINNER_LG,
  FLEX_CENTER,
} from '@/lib/constants/styles';
import {
  OFFERING_TYPE_LABELS,
  OFFERING_TYPE_COLORS,
  OFFERING_TYPES,
  formatCurrency,
  getTodayString,
  getWeekLabel,
} from '@/lib/constants/offering-types';

interface Offering {
  id: string;
  date: string;
  name: string;
  type: OfferingType;
  amount: number;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
}

interface OfferingSummary {
  totalAmount: number;
  count: number;
  uniqueDonors: number;
  byType: Record<string, { count: number; amount: number }>;
}

interface BatchGroup {
  date: string;
  count: number;
  totalAmount: number;
  byType: Record<string, { count: number; amount: number }>;
  offerings: Offering[];
}

interface UploadItem {
  date: string;
  name: string;
  type: string;
  amount: number;
  memo: string;
}

type TabType = 'list' | 'upload' | 'batch';

// CSV 파싱 함수
function parseCSV(text: string): string[][] {
  const lines = text.trim().split('\n');
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
}

function mapCSVToOfferings(rows: string[][]): UploadItem[] {
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const dateIdx = headers.findIndex(h => h === '날짜' || h === 'date');
  const nameIdx = headers.findIndex(h => h === '이름' || h === 'name' || h === '성명');
  const typeIdx = headers.findIndex(h => h === '헌금종류' || h === 'type' || h === '구분');
  const amountIdx = headers.findIndex(h => h === '금액' || h === 'amount');
  const memoIdx = headers.findIndex(h => h === '메모' || h === 'memo' || h === '비고');

  return rows.slice(1)
    .filter(row => row.length >= 4)
    .map(row => ({
      date: row[dateIdx] || getTodayString(),
      name: row[nameIdx] || '',
      type: row[typeIdx] || '기타',
      amount: parseInt((row[amountIdx] || '0').replace(/[^0-9]/g, '')) || 0,
      memo: row[memoIdx] || '',
    }))
    .filter(item => item.name && item.amount > 0);
}

export default function OfferingsPage() {
  const [tab, setTab] = useState<TabType>('list');
  const [loading, setLoading] = useState(true);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [summary, setSummary] = useState<OfferingSummary | null>(null);
  const [months, setMonths] = useState<string[]>([]);

  // 필터
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('전체');
  const [filterMonth, setFilterMonth] = useState('전체');

  // 폼
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: getTodayString(),
    name: '',
    type: 'TITHE' as OfferingType,
    amount: '',
    memo: '',
  });

  // 업로드
  const [uploadItems, setUploadItems] = useState<UploadItem[] | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 배치
  const [batches, setBatches] = useState<BatchGroup[]>([]);
  const [batchSummary, setBatchSummary] = useState<{ totalBatches: number; totalOfferings: number; totalAmount: number; avgPerBatch: number } | null>(null);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  // 데이터 불러오기
  const fetchOfferings = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterType !== '전체') params.set('type', filterType);
      if (filterMonth !== '전체') params.set('month', filterMonth);
      params.set('limit', '100');

      const res = await fetch(`/api/admin/offerings?${params}`);
      const data = await res.json();

      if (res.ok) {
        setOfferings(data.offerings);
        setSummary(data.summary);
        setMonths(data.months || []);
      }
    } catch (error) {
      console.error('Failed to fetch offerings:', error);
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterMonth]);

  const fetchBatches = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterMonth !== '전체') params.set('month', filterMonth);

      const res = await fetch(`/api/admin/offerings/batch?${params}`);
      const data = await res.json();

      if (res.ok) {
        setBatches(data.batches);
        setBatchSummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch batches:', error);
    }
  }, [filterMonth]);

  useEffect(() => {
    if (tab === 'list') {
      fetchOfferings();
    } else if (tab === 'batch') {
      fetchBatches();
    }
  }, [tab, fetchOfferings, fetchBatches]);

  // 헌금 추가/수정
  const handleSubmit = async () => {
    if (!form.name || !form.amount) {
      alert('이름과 금액은 필수입니다.');
      return;
    }

    try {
      const url = editingId
        ? `/api/admin/offerings/${editingId}`
        : '/api/admin/offerings';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: parseInt(form.amount),
        }),
      });

      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
        setForm({
          date: getTodayString(),
          name: '',
          type: 'TITHE',
          amount: '',
          memo: '',
        });
        fetchOfferings();
      } else {
        const data = await res.json();
        alert(data.error || '오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Submit error:', error);
      alert('오류가 발생했습니다.');
    }
  };

  // 헌금 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('이 헌금을 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/admin/offerings/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchOfferings();
      } else {
        const data = await res.json();
        alert(data.error || '삭제 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // 수정 모드 진입
  const handleEdit = (offering: Offering) => {
    setEditingId(offering.id);
    setForm({
      date: offering.date,
      name: offering.name,
      type: offering.type,
      amount: offering.amount.toString(),
      memo: offering.memo || '',
    });
    setShowForm(true);
  };

  // 파일 업로드 처리
  const handleFileUpload = (file: File) => {
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = parseCSV(text);
        const items = mapCSVToOfferings(rows);

        if (items.length === 0) {
          setUploadError('유효한 데이터가 없습니다. CSV 형식을 확인해주세요.');
          return;
        }

        setUploadItems(items);
      } catch {
        setUploadError('파일 파싱 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // 업로드 확정
  const confirmUpload = async () => {
    if (!uploadItems) return;

    try {
      const res = await fetch('/api/admin/offerings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerings: uploadItems }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`${data.count}건의 헌금이 등록되었습니다.`);
        setUploadItems(null);
        setTab('list');
        fetchOfferings();
      } else {
        const data = await res.json();
        alert(data.error || '등록 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('등록 중 오류가 발생했습니다.');
    }
  };

  // 배치 삭제
  const handleBatchDelete = async (date: string) => {
    const batch = batches.find(b => b.date === date);
    if (!batch) return;

    if (!confirm(`${date} 헌금 ${batch.count}건을 모두 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch('/api/admin/offerings/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      });

      if (res.ok) {
        fetchBatches();
      } else {
        const data = await res.json();
        alert(data.error || '삭제 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Batch delete error:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // CSV 내보내기
  const exportCSV = () => {
    const header = '날짜,이름,헌금종류,금액,메모';
    const rows = offerings.map(o =>
      `${o.date},${o.name},${OFFERING_TYPE_LABELS[o.type]},${o.amount},${o.memo || ''}`
    );
    const csv = [header, ...rows].join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `헌금내역_${getTodayString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 템플릿 다운로드
  const downloadTemplate = () => {
    window.location.href = '/api/admin/offerings/template';
  };

  // 초기화
  const handleReset = async () => {
    if (!confirm('모든 헌금 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

    // 모든 배치 삭제
    for (const batch of batches) {
      try {
        await fetch('/api/admin/offerings/batch', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: batch.date }),
        });
      } catch {
        // continue
      }
    }

    fetchOfferings();
    fetchBatches();
    alert('모든 데이터가 삭제되었습니다.');
  };

  const tabs = [
    { id: 'list' as TabType, label: '헌금 내역', icon: FileText },
    { id: 'upload' as TabType, label: '업로드', icon: Upload },
    { id: 'batch' as TabType, label: '주간 관리', icon: Calendar },
  ];

  return (
    <div className="max-w-6xl space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <HandCoins className="w-8 h-8 text-teal-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">헌금 관리</h1>
            <p className="text-sm text-gray-500">수입 · 업로드 · 주간 관리</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className={BTN_OUTLINE} onClick={exportCSV}>
            <Download className="w-4 h-4" />
            내보내기
          </button>
          <button className={`${BTN_DANGER} ${BTN_SM}`} onClick={handleReset}>
            <Trash2 className="w-4 h-4" />
            초기화
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={SECTION_CARD}>
            <p className="text-sm text-gray-500 mb-1">총 헌금액</p>
            <p className="text-2xl font-bold text-teal-600">{formatCurrency(summary.totalAmount)}</p>
          </div>
          <div className={SECTION_CARD}>
            <p className="text-sm text-gray-500 mb-1">건수</p>
            <p className="text-2xl font-bold text-yellow-600">{summary.count}건</p>
          </div>
          <div className={SECTION_CARD}>
            <p className="text-sm text-gray-500 mb-1">헌금자 수</p>
            <p className="text-2xl font-bold text-purple-600">{summary.uniqueDonors}명</p>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div className={TAB_CONTAINER}>
        {tabs.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? TAB_ACTIVE : TAB_INACTIVE}
            onClick={() => setTab(t.id)}
          >
            <t.icon className="w-4 h-4 mr-1" />
            {t.label}
          </button>
        ))}
      </div>

      {/* 헌금 내역 탭 */}
      {tab === 'list' && (
        <div className="space-y-4">
          {/* 필터 */}
          <div className={SECTION_CARD}>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">검색</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    className={`${INPUT_BASE} pl-10`}
                    placeholder="이름 또는 메모..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="w-40">
                <label className="block text-sm font-medium text-gray-700 mb-1">헌금종류</label>
                <select
                  className={SELECT_BASE}
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="전체">전체</option>
                  {OFFERING_TYPES.map((type) => (
                    <option key={type} value={type}>{OFFERING_TYPE_LABELS[type]}</option>
                  ))}
                </select>
              </div>
              <div className="w-40">
                <label className="block text-sm font-medium text-gray-700 mb-1">월</label>
                <select
                  className={SELECT_BASE}
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                >
                  <option value="전체">전체</option>
                  {months.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <button
                className={BTN_PRIMARY}
                onClick={() => {
                  setShowForm(true);
                  setEditingId(null);
                  setForm({
                    date: getTodayString(),
                    name: '',
                    type: 'TITHE',
                    amount: '',
                    memo: '',
                  });
                }}
              >
                <Plus className="w-4 h-4" />
                헌금 추가
              </button>
            </div>
          </div>

          {/* 타입별 요약 */}
          {summary && Object.keys(summary.byType).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(summary.byType)
                .sort((a, b) => b[1].amount - a[1].amount)
                .map(([type, data]) => {
                  const colors = OFFERING_TYPE_COLORS[type as OfferingType];
                  return (
                    <span
                      key={type}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${colors?.bg || 'bg-gray-100'} ${colors?.text || 'text-gray-800'}`}
                    >
                      {OFFERING_TYPE_LABELS[type as OfferingType]} {formatCurrency(data.amount)}
                    </span>
                  );
                })}
            </div>
          )}

          {/* 추가/수정 폼 */}
          {showForm && (
            <div className={`${SECTION_CARD} border-2 border-teal-500`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingId ? '헌금 수정' : '새 헌금 등록'}
                </h3>
                <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                  <input
                    type="date"
                    className={INPUT_BASE}
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                  <input
                    type="text"
                    className={INPUT_BASE}
                    placeholder="헌금자 이름"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">헌금종류</label>
                  <select
                    className={SELECT_BASE}
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as OfferingType })}
                  >
                    {OFFERING_TYPES.map((type) => (
                      <option key={type} value={type}>{OFFERING_TYPE_LABELS[type]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">금액</label>
                  <input
                    type="number"
                    className={INPUT_BASE}
                    placeholder="0"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
                  <input
                    type="text"
                    className={INPUT_BASE}
                    placeholder="비고 (선택)"
                    value={form.memo}
                    onChange={(e) => setForm({ ...form, memo: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button className={BTN_OUTLINE} onClick={() => { setShowForm(false); setEditingId(null); }}>
                  취소
                </button>
                <button className={BTN_PRIMARY} onClick={handleSubmit}>
                  {editingId ? '수정 완료' : '등록'}
                </button>
              </div>
            </div>
          )}

          {/* 테이블 */}
          {loading ? (
            <div className={`${FLEX_CENTER} py-12`}>
              <div className={SPINNER_LG} />
            </div>
          ) : offerings.length === 0 ? (
            <div className={`${SECTION_CARD} text-center py-12`}>
              <p className="text-4xl mb-2">📭</p>
              <p className="text-gray-600">헌금 데이터가 없습니다</p>
              <p className="text-sm text-gray-400">CSV 업로드 또는 직접 추가해주세요</p>
            </div>
          ) : (
            <div className={`${SECTION_CARD} p-0 overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className={TABLE_BASE}>
                  <thead className={TABLE_HEADER}>
                    <tr>
                      <th className={TABLE_HEADER_CELL}>날짜</th>
                      <th className={TABLE_HEADER_CELL}>이름</th>
                      <th className={TABLE_HEADER_CELL}>구분</th>
                      <th className={`${TABLE_HEADER_CELL} text-right`}>금액</th>
                      <th className={TABLE_HEADER_CELL}>메모</th>
                      <th className={TABLE_HEADER_CELL}>관리</th>
                    </tr>
                  </thead>
                  <tbody className={TABLE_BODY}>
                    {offerings.map((o) => {
                      const colors = OFFERING_TYPE_COLORS[o.type];
                      return (
                        <tr key={o.id} className="hover:bg-gray-50">
                          <td className={`${TABLE_CELL} text-gray-500 text-sm`}>{o.date}</td>
                          <td className={`${TABLE_CELL} font-medium`}>{o.name}</td>
                          <td className={TABLE_CELL}>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors?.bg || 'bg-gray-100'} ${colors?.text || 'text-gray-800'}`}>
                              {OFFERING_TYPE_LABELS[o.type]}
                            </span>
                          </td>
                          <td className={`${TABLE_CELL_RIGHT} font-bold text-teal-600`}>
                            {formatCurrency(o.amount)}
                          </td>
                          <td className={`${TABLE_CELL} text-gray-500 text-sm max-w-[150px] truncate`}>
                            {o.memo}
                          </td>
                          <td className={TABLE_CELL}>
                            <div className="flex gap-1">
                              <button
                                className="text-gray-400 hover:text-blue-600 p-1"
                                onClick={() => handleEdit(o)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                className="text-gray-400 hover:text-red-600 p-1"
                                onClick={() => handleDelete(o.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {offerings.length >= 100 && (
                <p className="text-center py-3 text-sm text-gray-500 border-t">
                  최근 100건만 표시됩니다
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 업로드 탭 */}
      {tab === 'upload' && (
        <div className="space-y-4">
          {/* 가이드 */}
          <div className={SECTION_CARD}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 업로드 가이드</h3>
            <div className="bg-gray-50 rounded-lg p-4 mb-4 border">
              <p className="text-sm font-medium text-gray-700 mb-2">CSV 파일 형식</p>
              <code className="block text-xs text-teal-600 whitespace-pre-wrap font-mono leading-relaxed">
{`날짜,이름,헌금종류,금액,메모
2024-03-31,홍길동,십일조,500000,
2024-03-31,김철수,감사헌금,100000,감사합니다`}
              </code>
            </div>
            <button className={BTN_PRIMARY} onClick={downloadTemplate}>
              <Download className="w-4 h-4" />
              템플릿 다운로드
            </button>
            <div className="mt-4 text-sm text-gray-600 space-y-1">
              <p className="font-medium text-gray-700">지원 컬럼명</p>
              <p>• 날짜: <span className="text-teal-600">날짜, date</span> (YYYY-MM-DD)</p>
              <p>• 이름: <span className="text-teal-600">이름, name, 성명</span></p>
              <p>• 종류: <span className="text-teal-600">헌금종류, type, 구분</span></p>
              <p>• 금액: <span className="text-teal-600">금액, amount</span></p>
              <p>• 메모: <span className="text-teal-600">메모, memo, 비고</span> (선택)</p>
            </div>
          </div>

          {/* 업로드 영역 */}
          <div className={SECTION_CARD}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragOver ? 'border-teal-500 bg-teal-50' : 'border-gray-300 hover:border-gray-400'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-1">CSV 파일 업로드</p>
              <p className="text-sm text-gray-500">클릭하거나 파일을 드래그하세요</p>
            </div>

            {/* 업로드 미리보기 */}
            {uploadError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 font-medium">❌ {uploadError}</p>
                <button className={`${BTN_OUTLINE} ${BTN_SM} mt-2`} onClick={() => setUploadError(null)}>
                  닫기
                </button>
              </div>
            )}

            {uploadItems && (
              <div className="mt-4 p-4 bg-teal-50 border border-teal-200 rounded-lg">
                <p className="text-teal-700 font-medium mb-4">
                  ✅ {uploadItems.length}건의 헌금 데이터를 확인했습니다.
                </p>
                <div className="max-h-64 overflow-auto mb-4">
                  <table className={TABLE_BASE}>
                    <thead className={TABLE_HEADER}>
                      <tr>
                        <th className={TABLE_HEADER_CELL}>날짜</th>
                        <th className={TABLE_HEADER_CELL}>이름</th>
                        <th className={TABLE_HEADER_CELL}>구분</th>
                        <th className={`${TABLE_HEADER_CELL} text-right`}>금액</th>
                      </tr>
                    </thead>
                    <tbody className={TABLE_BODY}>
                      {uploadItems.slice(0, 20).map((item, i) => (
                        <tr key={i}>
                          <td className={`${TABLE_CELL} text-sm text-gray-500`}>{item.date}</td>
                          <td className={TABLE_CELL}>{item.name}</td>
                          <td className={TABLE_CELL}>{item.type}</td>
                          <td className={`${TABLE_CELL_RIGHT} text-teal-600 font-medium`}>
                            {formatCurrency(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {uploadItems.length > 20 && (
                    <p className="text-center text-sm text-gray-500 py-2">
                      외 {uploadItems.length - 20}건 더...
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <button className={BTN_OUTLINE} onClick={() => setUploadItems(null)}>취소</button>
                  <button className={BTN_PRIMARY} onClick={confirmUpload}>
                    {uploadItems.length}건 등록하기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 주간 관리 탭 */}
      {tab === 'batch' && (
        <div className="space-y-4">
          <div className={SECTION_CARD}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">📅 주간별 헌금 현황</h3>
                <p className="text-sm text-gray-500">날짜별로 그룹화된 헌금 배치를 관리합니다</p>
              </div>
              <div className="w-40">
                <select
                  className={SELECT_BASE}
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                >
                  <option value="전체">전체</option>
                  {months.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {batches.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-2">📭</p>
                <p className="text-gray-600">등록된 헌금이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {batches.map((batch) => (
                  <div key={batch.date} className="bg-gray-50 rounded-lg border">
                    <div
                      className="p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => setExpandedBatch(expandedBatch === batch.date ? null : batch.date)}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          {expandedBatch === batch.date ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                          <div>
                            <span className="font-medium text-gray-900">{batch.date}</span>
                            <span className="text-sm text-gray-500 ml-2">{getWeekLabel(batch.date)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded-full text-xs font-medium">
                            {batch.count}건
                          </span>
                          <span className="font-bold text-teal-600">{formatCurrency(batch.totalAmount)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.entries(batch.byType).map(([type, data]) => {
                          const colors = OFFERING_TYPE_COLORS[type as OfferingType];
                          return (
                            <span
                              key={type}
                              className={`px-2 py-0.5 rounded-full text-xs ${colors?.bg || 'bg-gray-100'} ${colors?.text || 'text-gray-600'}`}
                            >
                              {OFFERING_TYPE_LABELS[type as OfferingType]} {formatCurrency(data.amount)}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {expandedBatch === batch.date && (
                      <div className="border-t bg-white p-4">
                        <table className={`${TABLE_BASE} mb-4`}>
                          <thead className={TABLE_HEADER}>
                            <tr>
                              <th className={TABLE_HEADER_CELL}>이름</th>
                              <th className={TABLE_HEADER_CELL}>구분</th>
                              <th className={`${TABLE_HEADER_CELL} text-right`}>금액</th>
                              <th className={TABLE_HEADER_CELL}>메모</th>
                            </tr>
                          </thead>
                          <tbody className={TABLE_BODY}>
                            {batch.offerings.map((o) => {
                              const colors = OFFERING_TYPE_COLORS[o.type];
                              return (
                                <tr key={o.id}>
                                  <td className={`${TABLE_CELL} font-medium`}>{o.name}</td>
                                  <td className={TABLE_CELL}>
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${colors?.bg || 'bg-gray-100'} ${colors?.text || 'text-gray-600'}`}>
                                      {OFFERING_TYPE_LABELS[o.type]}
                                    </span>
                                  </td>
                                  <td className={`${TABLE_CELL_RIGHT} text-teal-600 font-medium`}>
                                    {formatCurrency(o.amount)}
                                  </td>
                                  <td className={`${TABLE_CELL} text-gray-500 text-sm`}>{o.memo}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <div className="flex justify-end">
                          <button
                            className={`${BTN_DANGER} ${BTN_SM}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBatchDelete(batch.date);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                            배치 삭제
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 배치 요약 */}
          {batchSummary && batches.length > 0 && (
            <div className={SECTION_CARD}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 전체 요약</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 border">
                  <p className="text-sm text-gray-500 mb-1">총 배치 수</p>
                  <p className="text-xl font-bold text-yellow-600">{batchSummary.totalBatches}회</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border">
                  <p className="text-sm text-gray-500 mb-1">총 건수</p>
                  <p className="text-xl font-bold text-blue-600">{batchSummary.totalOfferings}건</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border">
                  <p className="text-sm text-gray-500 mb-1">총 금액</p>
                  <p className="text-xl font-bold text-teal-600">{formatCurrency(batchSummary.totalAmount)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border">
                  <p className="text-sm text-gray-500 mb-1">평균 헌금액/회</p>
                  <p className="text-xl font-bold text-purple-600">{formatCurrency(batchSummary.avgPerBatch)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
