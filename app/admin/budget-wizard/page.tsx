'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check, Plus, X } from 'lucide-react';
import {
  BTN_PRIMARY,
  BTN_OUTLINE,
  BTN_SM,
  INPUT_BASE,
  SELECT_BASE,
  SECTION_CARD,
  SPINNER_LG,
  FLEX_CENTER,
} from '@/lib/constants/styles';
import { useOrgTerms } from '@/lib/contexts/TenantContext';
import type { OrgTerms } from '@/lib/org-terms';
import { apiBase } from '@/lib/api/api-base';

interface User {
  id: string;
  username: string;
}

interface Committee {
  id: string;
  name: string;
  isActive: boolean;
  leaderId: string | null;
  leader: User | null;
}

interface Department {
  id: string;
  name: string;
  committeeId: string;
  isActive: boolean;
  leaderId: string | null;
  leaderName: string | null;
}

interface BudgetCategory {
  id: string;
  name: string;
}

interface BudgetSubcategory {
  id: string;
  name: string;
  categoryId: string;
}

interface BudgetDetailInput {
  name: string;
  description: string;
  accountCode: string;
  managerId: string;
  budgetAmount: number;
}

const getSteps = (terms: OrgTerms) => [
  { id: 1, title: `${terms.committee} 선택`, description: `${terms.committee}를 선택하거나 신규 등록합니다` },
  { id: 2, title: `${terms.department} 선택`, description: `${terms.department}을(를) 선택하거나 신규 등록합니다` },
  { id: 3, title: '예산(항) 선택', description: '예산 항목을 선택하거나 신규 등록합니다' },
  { id: 4, title: '예산(목) 선택', description: '예산 목을 선택하거나 신규 등록합니다' },
  { id: 5, title: '예산(세목) 등록', description: '세목 상세 정보를 입력합니다' },
  { id: 6, title: '완료', description: '등록 결과를 확인합니다' },
];

export default function BudgetWizardPage() {
  const terms = useOrgTerms();
  const STEPS = getSteps(terms);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 데이터
  const [users, setUsers] = useState<User[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [subcategories, setSubcategories] = useState<BudgetSubcategory[]>([]);

  // 선택값
  const [selectedCommittee, setSelectedCommittee] = useState<Committee | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<BudgetCategory | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<BudgetSubcategory | null>(null);
  const [budgetDetails, setBudgetDetails] = useState<BudgetDetailInput[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // 신규 등록 모드
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLeaderId, setNewLeaderId] = useState('');

  // 완료 결과
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    createdCount: number;
  } | null>(null);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [usersRes, committeesRes, categoriesRes] = await Promise.all([
        fetch('/api/users?active=true'),
        fetch(`${apiBase('budget-master')}/committees`),
        fetch(`${apiBase('budget-master')}/budget-categories`),
      ]);

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      }
      if (committeesRes.ok) {
        const data = await committeesRes.json();
        setCommittees(data.committees || []);
      }
      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchDepartments = async (committeeId: string) => {
    try {
      const res = await fetch(`${apiBase('budget-master')}/departments?committeeId=${committeeId}`);
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.departments || []);
      }
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const fetchSubcategories = async (categoryId: string) => {
    try {
      const res = await fetch(`${apiBase('budget-master')}/budget-subcategories?categoryId=${categoryId}`);
      if (res.ok) {
        const data = await res.json();
        setSubcategories(data.subcategories || []);
      }
    } catch (error) {
      console.error('Error loading subcategories:', error);
    }
  };

  const handleSelectCommittee = (committee: Committee) => {
    setSelectedCommittee(committee);
    setSelectedDepartment(null);
    setDepartments([]);
    fetchDepartments(committee.id);
  };

  const handleSelectDepartment = (department: Department) => {
    setSelectedDepartment(department);
    // 세목 담당자 기본값 설정
    if (department.leaderId && budgetDetails.length === 0) {
      setBudgetDetails([{
        name: '',
        description: '',
        accountCode: '',
        managerId: department.leaderId,
        budgetAmount: 0,
      }]);
    }
  };

  const handleSelectCategory = (category: BudgetCategory) => {
    setSelectedCategory(category);
    setSelectedSubcategory(null);
    setSubcategories([]);
    fetchSubcategories(category.id);
  };

  const handleAddNew = async () => {
    if (!newName.trim()) return;
    setSaving(true);

    try {
      let endpoint = '';
      const body: Record<string, unknown> = { name: newName.trim() };
      const base = apiBase('budget-master');

      switch (currentStep) {
        case 1:
          endpoint = `${base}/committees`;
          if (newLeaderId) body.leaderId = newLeaderId;
          break;
        case 2:
          endpoint = `${base}/departments`;
          body.committeeId = selectedCommittee?.id;
          if (newLeaderId) body.leaderId = newLeaderId;
          break;
        case 3:
          endpoint = `${base}/budget-categories`;
          break;
        case 4:
          endpoint = `${base}/budget-subcategories`;
          body.categoryId = selectedCategory?.id;
          break;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '등록에 실패했습니다.');
      }

      const created = await res.json();

      // 목록 새로고침 및 선택
      switch (currentStep) {
        case 1:
          await fetchInitialData();
          setSelectedCommittee(created);
          await fetchDepartments(created.id);
          break;
        case 2:
          await fetchDepartments(selectedCommittee!.id);
          handleSelectDepartment(created);
          break;
        case 3:
          const catRes = await fetch(`${apiBase('budget-master')}/budget-categories`);
          if (catRes.ok) {
            const data = await catRes.json();
            setCategories(data.categories || []);
          }
          setSelectedCategory(created);
          await fetchSubcategories(created.id);
          break;
        case 4:
          await fetchSubcategories(selectedCategory!.id);
          setSelectedSubcategory(created);
          break;
      }

      setNewName('');
      setNewLeaderId('');
      setIsAddingNew(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : '오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddBudgetDetail = () => {
    setBudgetDetails([
      ...budgetDetails,
      {
        name: '',
        description: '',
        accountCode: '',
        managerId: selectedDepartment?.leaderId || '',
        budgetAmount: 0,
      },
    ]);
  };

  const handleRemoveBudgetDetail = (index: number) => {
    if (budgetDetails.length === 1) return;
    setBudgetDetails(budgetDetails.filter((_, i) => i !== index));
  };

  const handleBudgetDetailChange = (
    index: number,
    field: keyof BudgetDetailInput,
    value: string | number
  ) => {
    const updated = [...budgetDetails];
    updated[index] = { ...updated[index], [field]: value };
    setBudgetDetails(updated);
  };

  const handleSubmit = async () => {
    if (!selectedDepartment || !selectedSubcategory) return;
    if (budgetDetails.some((d) => !d.name.trim())) {
      alert('세목명을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/budget-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: selectedDepartment.id,
          subcategoryId: selectedSubcategory.id,
          details: budgetDetails,
          year: selectedYear,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '등록에 실패했습니다.');
      }

      const data = await res.json();
      setResult({
        success: true,
        message: '예산 세목이 성공적으로 등록되었습니다.',
        createdCount: data.createdCount || budgetDetails.length,
      });
      setCurrentStep(6);
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : '등록에 실패했습니다.',
        createdCount: 0,
      });
      setCurrentStep(6);
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!selectedCommittee;
      case 2:
        return !!selectedDepartment;
      case 3:
        return !!selectedCategory;
      case 4:
        return !!selectedSubcategory;
      case 5:
        return budgetDetails.length > 0 && budgetDetails.every((d) => d.name.trim());
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep === 5) {
      handleSubmit();
    } else {
      setCurrentStep(currentStep + 1);
      setIsAddingNew(false);
      setNewName('');
      setNewLeaderId('');
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
    setIsAddingNew(false);
    setNewName('');
    setNewLeaderId('');
  };

  const handleReset = () => {
    setCurrentStep(1);
    setSelectedCommittee(null);
    setSelectedDepartment(null);
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setBudgetDetails([]);
    setSelectedYear(new Date().getFullYear());
    setResult(null);
    setIsAddingNew(false);
  };

  if (loading) {
    return (
      <div className={`${FLEX_CENTER} py-20`}>
        <div className={SPINNER_LG}></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">예산 등록 마법사</h1>
        <p className="text-gray-600 mt-1">{terms.committee} → {terms.department} → 예산항목 순서로 등록합니다.</p>
      </div>

      {/* 스텝 인디케이터 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  currentStep > step.id
                    ? 'bg-green-500 border-green-500 text-white'
                    : currentStep === step.id
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {currentStep > step.id ? <Check className="w-5 h-5" /> : step.id}
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`w-12 h-1 mx-2 ${
                    currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 text-center">
          <h2 className="text-lg font-semibold text-gray-900">
            {STEPS[currentStep - 1].title}
          </h2>
          <p className="text-sm text-gray-500">{STEPS[currentStep - 1].description}</p>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className={SECTION_CARD}>
        {/* Step 1: 위원회 선택 */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {committees
                .filter((c) => c.isActive !== false)
                .map((committee) => (
                  <button
                    key={committee.id}
                    onClick={() => handleSelectCommittee(committee)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      selectedCommittee?.id === committee.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium">{committee.name}</div>
                    {committee.leader && (
                      <div className="text-sm text-gray-500">
                        위원장: {committee.leader.username}
                      </div>
                    )}
                  </button>
                ))}
            </div>

            {!isAddingNew ? (
              <button
                onClick={() => setIsAddingNew(true)}
                className={`${BTN_OUTLINE} flex items-center gap-2`}
              >
                <Plus className="w-4 h-4" />
                신규 {terms.committee} 등록
              </button>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={`${terms.committee}명`}
                  className={`${INPUT_BASE} flex-1`}
                  autoFocus
                />
                <select
                  value={newLeaderId}
                  onChange={(e) => setNewLeaderId(e.target.value)}
                  className={`${SELECT_BASE} w-32`}
                >
                  <option value="">위원장</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddNew}
                  disabled={saving || !newName.trim()}
                  className={`${BTN_SM} text-green-600 hover:bg-green-50 disabled:opacity-50`}
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setIsAddingNew(false);
                    setNewName('');
                    setNewLeaderId('');
                  }}
                  className={`${BTN_SM} text-gray-600 hover:bg-gray-100`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: 사역팀 선택 */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg text-sm">
              선택된 {terms.committee}: <span className="font-semibold">{selectedCommittee?.name}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {departments
                .filter((d) => d.isActive !== false)
                .map((dept) => (
                  <button
                    key={dept.id}
                    onClick={() => handleSelectDepartment(dept)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      selectedDepartment?.id === dept.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium">{dept.name}</div>
                    {dept.leaderName && (
                      <div className="text-sm text-gray-500">팀장: {dept.leaderName}</div>
                    )}
                  </button>
                ))}
            </div>

            {departments.length === 0 && (
              <p className="text-center text-gray-500 py-4">등록된 {terms.department}이(가) 없습니다.</p>
            )}

            {!isAddingNew ? (
              <button
                onClick={() => setIsAddingNew(true)}
                className={`${BTN_OUTLINE} flex items-center gap-2`}
              >
                <Plus className="w-4 h-4" />
                신규 {terms.department} 등록
              </button>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={`${terms.department}명`}
                  className={`${INPUT_BASE} flex-1`}
                  autoFocus
                />
                <select
                  value={newLeaderId}
                  onChange={(e) => setNewLeaderId(e.target.value)}
                  className={`${SELECT_BASE} w-32`}
                >
                  <option value="">팀장</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddNew}
                  disabled={saving || !newName.trim()}
                  className={`${BTN_SM} text-green-600 hover:bg-green-50 disabled:opacity-50`}
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setIsAddingNew(false);
                    setNewName('');
                    setNewLeaderId('');
                  }}
                  className={`${BTN_SM} text-gray-600 hover:bg-gray-100`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: 예산(항) 선택 */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleSelectCategory(category)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    selectedCategory?.id === category.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium">{category.name}</div>
                </button>
              ))}
            </div>

            {categories.length === 0 && (
              <p className="text-center text-gray-500 py-4">등록된 예산(항)이 없습니다.</p>
            )}

            {!isAddingNew ? (
              <button
                onClick={() => setIsAddingNew(true)}
                className={`${BTN_OUTLINE} flex items-center gap-2`}
              >
                <Plus className="w-4 h-4" />
                신규 예산(항) 등록
              </button>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="예산(항) 이름"
                  className={`${INPUT_BASE} flex-1`}
                  autoFocus
                />
                <button
                  onClick={handleAddNew}
                  disabled={saving || !newName.trim()}
                  className={`${BTN_SM} text-green-600 hover:bg-green-50 disabled:opacity-50`}
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setIsAddingNew(false);
                    setNewName('');
                  }}
                  className={`${BTN_SM} text-gray-600 hover:bg-gray-100`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 4: 예산(목) 선택 */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg text-sm">
              선택된 예산(항): <span className="font-semibold">{selectedCategory?.name}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {subcategories.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubcategory(sub)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    selectedSubcategory?.id === sub.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium">{sub.name}</div>
                </button>
              ))}
            </div>

            {subcategories.length === 0 && (
              <p className="text-center text-gray-500 py-4">등록된 예산(목)이 없습니다.</p>
            )}

            {!isAddingNew ? (
              <button
                onClick={() => setIsAddingNew(true)}
                className={`${BTN_OUTLINE} flex items-center gap-2`}
              >
                <Plus className="w-4 h-4" />
                신규 예산(목) 등록
              </button>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="예산(목) 이름"
                  className={`${INPUT_BASE} flex-1`}
                  autoFocus
                />
                <button
                  onClick={handleAddNew}
                  disabled={saving || !newName.trim()}
                  className={`${BTN_SM} text-green-600 hover:bg-green-50 disabled:opacity-50`}
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setIsAddingNew(false);
                    setNewName('');
                  }}
                  className={`${BTN_SM} text-gray-600 hover:bg-gray-100`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 5: 예산(세목) 등록 */}
        {currentStep === 5 && (
          <div className="space-y-6">
            {/* 연도 선택 */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-blue-800">적용 연도:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className={`${SELECT_BASE} w-32`}
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                    <option key={year} value={year}>
                      {year}년
                    </option>
                  ))}
                </select>
                <span className="text-xs text-blue-600">
                  담당자/예산금액이 이 연도에 적용됩니다
                </span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg text-sm space-y-1">
              <div>
                {terms.committee}: <span className="font-semibold">{selectedCommittee?.name}</span> &gt;
                {terms.department}: <span className="font-semibold">{selectedDepartment?.name}</span>
              </div>
              <div>
                예산(항): <span className="font-semibold">{selectedCategory?.name}</span> &gt;
                예산(목): <span className="font-semibold">{selectedSubcategory?.name}</span>
              </div>
              {selectedDepartment?.leaderName && (
                <div className="text-blue-600">
                  담당자 기본값: {selectedDepartment.leaderName} (팀장)
                </div>
              )}
            </div>

            {budgetDetails.map((detail, index) => (
              <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">세목 #{index + 1}</span>
                  {budgetDetails.length > 1 && (
                    <button
                      onClick={() => handleRemoveBudgetDetail(index)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      삭제
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      세목명 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={detail.name}
                      onChange={(e) => handleBudgetDetailChange(index, 'name', e.target.value)}
                      placeholder="예: 회의비_재정팀"
                      className={INPUT_BASE}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      계정코드
                    </label>
                    <input
                      type="text"
                      value={detail.accountCode}
                      onChange={(e) => handleBudgetDetailChange(index, 'accountCode', e.target.value)}
                      placeholder="예: 110.1"
                      className={INPUT_BASE}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      담당자 (1차 결재자)
                    </label>
                    <select
                      value={detail.managerId}
                      onChange={(e) => handleBudgetDetailChange(index, 'managerId', e.target.value)}
                      className={SELECT_BASE}
                    >
                      <option value="">선택안함</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.username}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      예산금액
                    </label>
                    <input
                      type="number"
                      value={detail.budgetAmount || ''}
                      onChange={(e) =>
                        handleBudgetDetailChange(index, 'budgetAmount', parseInt(e.target.value) || 0)
                      }
                      placeholder="0"
                      className={INPUT_BASE}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      설명
                    </label>
                    <input
                      type="text"
                      value={detail.description}
                      onChange={(e) => handleBudgetDetailChange(index, 'description', e.target.value)}
                      placeholder="항목 설명"
                      className={INPUT_BASE}
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={handleAddBudgetDetail}
              className={`${BTN_OUTLINE} flex items-center gap-2`}
            >
              <Plus className="w-4 h-4" />
              세목 추가
            </button>
          </div>
        )}

        {/* Step 6: 완료 */}
        {currentStep === 6 && result && (
          <div className="text-center py-8">
            <div
              className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                result.success ? 'bg-green-100' : 'bg-red-100'
              }`}
            >
              {result.success ? (
                <Check className="w-8 h-8 text-green-600" />
              ) : (
                <X className="w-8 h-8 text-red-600" />
              )}
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {result.success ? '등록 완료!' : '등록 실패'}
            </h3>
            <p className="text-gray-600 mb-6">{result.message}</p>
            {result.success && (
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-left max-w-md mx-auto mb-6">
                <div className="space-y-1">
                  <div className="text-blue-600 font-semibold">적용 연도: {selectedYear}년</div>
                  <div>{terms.committee}: {selectedCommittee?.name}</div>
                  <div>{terms.department}: {selectedDepartment?.name}</div>
                  <div>예산(항): {selectedCategory?.name}</div>
                  <div>예산(목): {selectedSubcategory?.name}</div>
                  <div>등록된 세목: {result.createdCount}개</div>
                </div>
              </div>
            )}
            <div className="flex justify-center gap-3">
              <button onClick={handleReset} className={BTN_OUTLINE}>
                새로 등록
              </button>
              <a href="/admin/budget-managers" className={BTN_PRIMARY}>
                담당자 관리로 이동
              </a>
            </div>
          </div>
        )}
      </div>

      {/* 네비게이션 버튼 */}
      {currentStep < 6 && (
        <div className="flex justify-between mt-6">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className={`${BTN_OUTLINE} flex items-center gap-2 disabled:opacity-50`}
          >
            <ChevronLeft className="w-4 h-4" />
            이전
          </button>
          <button
            onClick={handleNext}
            disabled={!canProceed() || saving}
            className={`${BTN_PRIMARY} flex items-center gap-2 disabled:opacity-50`}
          >
            {saving ? '저장 중...' : currentStep === 5 ? '등록 완료' : '다음'}
            {!saving && currentStep < 5 && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  );
}
