'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BudgetSelector from './BudgetSelector';

interface ExpenseItem {
  budgetDetail: string;
  description: string;
  unitPrice: number;
  quantity: number;
  amount: number;
}

interface ExpenseFormData {
  committee?: string;
  department?: string;
  budgetCategory?: string;
  budgetSubcategory?: string;
  expenseDate?: string;
  requestDate: string;
  requestTeam: string;
  applicantName: string;
  applicantTitle?: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  items: ExpenseItem[];
}

interface ExpenseFormProps {
  expenseId?: string;
  initialData?: any;
}

export default function ExpenseForm({ expenseId, initialData }: ExpenseFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchLoading, setFetchLoading] = useState(!!expenseId);

  const [formData, setFormData] = useState<ExpenseFormData>({
    requestDate: new Date().toISOString().split('T')[0],
    requestTeam: '출납팀',
    applicantName: '',
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    items: [
      {
        budgetDetail: '',
        description: '',
        unitPrice: 0,
        quantity: 1,
        amount: 0,
      },
    ],
  });

  // 수정 모드일 때 데이터 로드
  useEffect(() => {
    if (expenseId && !initialData) {
      fetchExpenseData();
    } else if (initialData) {
      loadInitialData(initialData);
    }
  }, [expenseId, initialData]);

  const fetchExpenseData = async () => {
    try {
      setFetchLoading(true);
      const response = await fetch(`/api/expenses/${expenseId}`);
      if (!response.ok) throw new Error('데이터를 불러오는데 실패했습니다.');
      const data = await response.json();
      loadInitialData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setFetchLoading(false);
    }
  };

  const loadInitialData = (data: any) => {
    setFormData({
      committee: data.committee,
      department: data.department,
      budgetCategory: data.budgetCategory,
      budgetSubcategory: data.budgetSubcategory,
      expenseDate: data.expenseDate ? new Date(data.expenseDate).toISOString().split('T')[0] : '',
      requestDate: new Date(data.requestDate).toISOString().split('T')[0],
      requestTeam: data.requestTeam,
      applicantName: data.applicantName,
      applicantTitle: data.applicantTitle || '',
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      accountHolder: data.accountHolder,
      items: data.items.map((item: any) => ({
        budgetDetail: item.budgetDetail,
        description: item.description,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        amount: item.amount,
      })),
    });
  };

  // 금액 계산 함수 (단가 × 수량 ÷ 10, 내림)
  const calculateAmount = (unitPrice: number, quantity: number): number => {
    return Math.floor((unitPrice * quantity) / 10) * 10;
  };

  const handleBudgetChange = (budget: {
    committee?: string;
    department?: string;
    category?: string;
    subcategory?: string;
    detail?: string;
  }) => {
    const newFormData = {
      ...formData,
      committee: budget.committee,
      department: budget.department,
      budgetCategory: budget.category,
      budgetSubcategory: budget.subcategory,
    };

    // 예산(세목)이 선택되면 첫 번째 항목에 자동 입력
    if (budget.detail && formData.items.length > 0 && !formData.items[0].budgetDetail) {
      newFormData.items = [...formData.items];
      newFormData.items[0] = {
        ...newFormData.items[0],
        budgetDetail: budget.detail,
      };
    }

    setFormData(newFormData);
  };

  const handleInputChange = (field: keyof ExpenseFormData, value: any) => {
    setFormData({
      ...formData,
      [field]: value,
    });
  };

  const handleItemChange = (index: number, field: keyof ExpenseItem, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = {
      ...newItems[index],
      [field]: value,
    };

    // 단가나 수량이 변경되면 금액 자동 계산
    if (field === 'unitPrice' || field === 'quantity') {
      newItems[index].amount = calculateAmount(
        newItems[index].unitPrice,
        newItems[index].quantity
      );
    }

    setFormData({
      ...formData,
      items: newItems,
    });
  };

  const addItem = () => {
    if (formData.items.length >= 10) {
      alert('최대 10개까지 항목을 추가할 수 있습니다.');
      return;
    }

    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          budgetDetail: '',
          description: '',
          unitPrice: 0,
          quantity: 1,
          amount: 0,
        },
      ],
    });
  };

  const removeItem = (index: number) => {
    if (formData.items.length === 1) {
      alert('최소 1개의 항목이 필요합니다.');
      return;
    }

    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      items: newItems,
    });
  };

  const validateForm = (): boolean => {
    if (!formData.committee || !formData.department || !formData.budgetCategory || !formData.budgetSubcategory) {
      setError('예산 항목을 모두 선택해주세요.');
      return false;
    }

    if (!formData.applicantName.trim()) {
      setError('청구인 이름을 입력해주세요.');
      return false;
    }

    if (!formData.bankName.trim() || !formData.accountNumber.trim() || !formData.accountHolder.trim()) {
      setError('은행 정보를 모두 입력해주세요.');
      return false;
    }

    if (formData.items.length === 0) {
      setError('최소 1개의 세부 항목이 필요합니다.');
      return false;
    }

    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i];
      if (!item.budgetDetail.trim() || !item.description.trim()) {
        setError(`${i + 1}번째 항목의 예산(세목)과 적요를 입력해주세요.`);
        return false;
      }
      if (item.unitPrice <= 0 || item.quantity <= 0) {
        setError(`${i + 1}번째 항목의 단가와 수량은 0보다 커야 합니다.`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      const url = expenseId ? `/api/expenses/${expenseId}` : '/api/expenses';
      const method = expenseId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          expenseDate: formData.expenseDate || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '저장에 실패했습니다.');
      }

      const result = await response.json();
      alert(expenseId ? '지출결의서가 성공적으로 수정되었습니다.' : '지출결의서가 성공적으로 등록되었습니다.');
      router.push(`/expenses/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = formData.items.reduce((sum, item) => sum + item.amount, 0);

  const inputClasses = 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none';

  // 수정 모드 데이터 로딩 중
  if (fetchLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* 예산 선택 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">예산 정보</h2>
        <BudgetSelector
          value={{
            committee: formData.committee,
            department: formData.department,
            category: formData.budgetCategory,
            subcategory: formData.budgetSubcategory,
          }}
          onChange={handleBudgetChange}
          disabled={loading}
        />
      </div>

      {/* 지출일자 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">지출 정보</h2>
        <div>
          <label htmlFor="expenseDate" className="block text-sm font-medium text-gray-700 mb-2">
            지출일자 (선택사항)
          </label>
          <input
            type="date"
            id="expenseDate"
            value={formData.expenseDate || ''}
            onChange={(e) => handleInputChange('expenseDate', e.target.value)}
            disabled={loading}
            className={inputClasses}
          />
          <p className="mt-1 text-xs text-gray-500">재정팀에서 입력하는 항목입니다.</p>
        </div>
      </div>

      {/* 세부 항목 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">세부 항목</h2>
          <button
            type="button"
            onClick={addItem}
            disabled={loading || formData.items.length >= 10}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            + 항목 추가
          </button>
        </div>

        <div className="space-y-4">
          {formData.items.map((item, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 relative">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-medium text-gray-900">항목 {index + 1}</h3>
                {formData.items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    disabled={loading}
                    className="text-red-500 hover:text-red-700 text-sm font-medium"
                  >
                    삭제
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    예산(세목) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={item.budgetDetail}
                    onChange={(e) => handleItemChange(index, 'budgetDetail', e.target.value)}
                    disabled={loading}
                    placeholder="예: 교육자료비"
                    className={inputClasses}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    적요 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                    disabled={loading}
                    placeholder="상세 설명"
                    className={inputClasses}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    단가 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(index, 'unitPrice', Number(e.target.value))}
                    disabled={loading}
                    min="0"
                    className={inputClasses}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    인원(수량) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                    disabled={loading}
                    min="1"
                    className={inputClasses}
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    금액 (자동 계산)
                  </label>
                  <div className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-semibold">
                    {item.amount.toLocaleString('ko-KR')}원
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 총액 */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">총 청구금액</span>
            <span className="text-2xl font-bold text-blue-500">
              {totalAmount.toLocaleString('ko-KR')}원
            </span>
          </div>
        </div>
      </div>

      {/* 신청 정보 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">신청 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="requestDate" className="block text-sm font-medium text-gray-700 mb-2">
              청구 일자 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="requestDate"
              value={formData.requestDate}
              onChange={(e) => handleInputChange('requestDate', e.target.value)}
              disabled={loading}
              className={inputClasses}
              required
            />
          </div>

          <div>
            <label htmlFor="requestTeam" className="block text-sm font-medium text-gray-700 mb-2">
              청구팀
            </label>
            <input
              type="text"
              id="requestTeam"
              value={formData.requestTeam}
              onChange={(e) => handleInputChange('requestTeam', e.target.value)}
              disabled={loading}
              className={inputClasses}
            />
          </div>

          <div>
            <label htmlFor="applicantName" className="block text-sm font-medium text-gray-700 mb-2">
              청구인 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="applicantName"
              value={formData.applicantName}
              onChange={(e) => handleInputChange('applicantName', e.target.value)}
              disabled={loading}
              placeholder="이름"
              className={inputClasses}
              required
            />
          </div>

          <div>
            <label htmlFor="applicantTitle" className="block text-sm font-medium text-gray-700 mb-2">
              직책 (선택사항)
            </label>
            <input
              type="text"
              id="applicantTitle"
              value={formData.applicantTitle || ''}
              onChange={(e) => handleInputChange('applicantTitle', e.target.value)}
              disabled={loading}
              placeholder="직책"
              className={inputClasses}
            />
          </div>
        </div>
      </div>

      {/* 은행 정보 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">은행 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="bankName" className="block text-sm font-medium text-gray-700 mb-2">
              은행명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="bankName"
              value={formData.bankName}
              onChange={(e) => handleInputChange('bankName', e.target.value)}
              disabled={loading}
              placeholder="예: 국민은행"
              className={inputClasses}
              required
            />
          </div>

          <div>
            <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700 mb-2">
              계좌번호 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="accountNumber"
              value={formData.accountNumber}
              onChange={(e) => handleInputChange('accountNumber', e.target.value)}
              disabled={loading}
              placeholder="숫자만 입력"
              className={inputClasses}
              required
            />
          </div>

          <div>
            <label htmlFor="accountHolder" className="block text-sm font-medium text-gray-700 mb-2">
              예금주 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="accountHolder"
              value={formData.accountHolder}
              onChange={(e) => handleInputChange('accountHolder', e.target.value)}
              disabled={loading}
              placeholder="예금주 이름"
              className={inputClasses}
              required
            />
          </div>
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={loading}
          className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {loading && (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          )}
          {loading ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  );
}
