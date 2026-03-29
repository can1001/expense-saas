'use client';

import { useState, useEffect, useCallback } from 'react';
import { UseFormRegister, UseFormSetValue, FieldErrors } from 'react-hook-form';
import { SavedBankAccount } from '@/lib/schemas/bank-account-schema';
import { getSavedBankAccounts } from '@/lib/services/bank-account-service';
import BankAccountManagementModal from '@/components/bank-account/BankAccountManagementModal';
import { maskAccountNumber } from '@/lib/utils';
import {
  SECTION_CARD,
  SECTION_TITLE,
  TAB_CONTAINER,
  TAB_ACTIVE,
  TAB_INACTIVE,
  SELECT_BASE,
  INPUT_BASE,
  LABEL_BASE,
  LABEL_REQUIRED,
  ERROR_MESSAGE,
  BTN_OUTLINE,
  BTN_SM,
  SPINNER_BLUE,
} from '@/lib/constants/styles';

interface BankAccountSelectorProps {
  register: UseFormRegister<any>;
  setValue: UseFormSetValue<any>;
  errors: FieldErrors<any>;
  disabled?: boolean;
  defaultBankName?: string;
  defaultAccountNumber?: string;
  defaultAccountHolder?: string;
}

type Mode = 'saved' | 'direct';

export default function BankAccountSelector({
  register,
  setValue,
  errors,
  disabled = false,
  defaultBankName,
  defaultAccountNumber,
}: BankAccountSelectorProps) {
  const [mode, setMode] = useState<Mode>('saved');
  const [accounts, setAccounts] = useState<SavedBankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 계좌 목록 불러오기
  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSavedBankAccounts();
      setAccounts(data);

      // 기본 계좌가 있고 폼에 값이 없으면 자동 선택
      const defaultAccount = data.find((acc) => acc.isDefault);
      if (defaultAccount && !defaultBankName && !defaultAccountNumber) {
        setSelectedAccountId(defaultAccount.id);
        setValue('bankName', defaultAccount.bankName);
        setValue('accountNumber', defaultAccount.accountNumber);
        setValue('accountHolder', defaultAccount.accountHolder);
      } else if (defaultAccountNumber) {
        // 기존 값이 있으면 해당 계좌 선택
        const matchingAccount = data.find(
          (acc) => acc.accountNumber === defaultAccountNumber
        );
        if (matchingAccount) {
          setSelectedAccountId(matchingAccount.id);
        } else {
          // 저장된 계좌에 없으면 직접 입력 모드로
          setMode('direct');
        }
      }
    } catch (error) {
      console.error('계좌 목록 조회 실패:', error);
      // API 오류 시 직접 입력 모드로 전환
      setMode('direct');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [setValue, defaultBankName, defaultAccountNumber]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // 저장된 계좌 선택
  const handleAccountSelect = (accountId: string) => {
    setSelectedAccountId(accountId);

    if (accountId === '') {
      setValue('bankName', '');
      setValue('accountNumber', '');
      setValue('accountHolder', '');
      return;
    }

    const account = accounts.find((acc) => acc.id === accountId);
    if (account) {
      setValue('bankName', account.bankName);
      setValue('accountNumber', account.accountNumber);
      setValue('accountHolder', account.accountHolder);
    }
  };

  // 모드 전환
  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    if (newMode === 'direct') {
      // 직접 입력 모드로 전환 시 선택 해제
      setSelectedAccountId('');
    } else if (newMode === 'saved' && accounts.length > 0) {
      // 저장된 계좌 모드로 전환 시 기본 계좌 선택
      const defaultAccount = accounts.find((acc) => acc.isDefault);
      if (defaultAccount) {
        handleAccountSelect(defaultAccount.id);
      }
    }
  };

  // 계좌 관리 모달에서 변경 시
  const handleAccountsChange = () => {
    fetchAccounts();
  };

  // 드롭다운에 표시할 계좌 이름 (계좌번호 마스킹 처리)
  const getAccountDisplayName = (account: SavedBankAccount) => {
    const name = account.nickname || account.accountHolder;
    return `${name} - ${account.bankName} (${maskAccountNumber(account.accountNumber)})`;
  };

  return (
    <div className={SECTION_CARD}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={SECTION_TITLE}>은행 정보</h2>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          disabled={disabled}
          className={`${BTN_OUTLINE} ${BTN_SM}`}
        >
          계좌 관리
        </button>
      </div>

      {/* 탭 */}
      <div className={TAB_CONTAINER}>
        <button
          type="button"
          onClick={() => handleModeChange('saved')}
          className={mode === 'saved' ? TAB_ACTIVE : TAB_INACTIVE}
          disabled={disabled}
        >
          저장된 계좌
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('direct')}
          className={mode === 'direct' ? TAB_ACTIVE : TAB_INACTIVE}
          disabled={disabled}
        >
          직접 입력
        </button>
      </div>

      {/* 저장된 계좌 모드 */}
      {mode === 'saved' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 py-4">
              <div className={SPINNER_BLUE}></div>
              <span className="text-gray-500">계좌 목록 불러오는 중...</span>
            </div>
          ) : accounts.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-gray-500 mb-2">저장된 계좌가 없습니다.</p>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className={`${BTN_OUTLINE} ${BTN_SM}`}
              >
                계좌 추가하기
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>
                  계좌 선택
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => handleAccountSelect(e.target.value)}
                  disabled={disabled}
                  className={SELECT_BASE}
                >
                  <option value="">-- 계좌를 선택하세요 --</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {getAccountDisplayName(account)}
                      {account.isDefault ? ' [기본]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* 선택된 계좌 정보 표시 (계좌번호 마스킹) */}
              {selectedAccountId && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <span className="text-sm text-gray-500">은행명</span>
                    <p className="font-medium text-gray-900">
                      {accounts.find((acc) => acc.id === selectedAccountId)?.bankName}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">계좌번호</span>
                    <p className="font-medium text-gray-900">
                      {maskAccountNumber(accounts.find((acc) => acc.id === selectedAccountId)?.accountNumber)}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">예금주</span>
                    <p className="font-medium text-gray-900">
                      {accounts.find((acc) => acc.id === selectedAccountId)?.accountHolder}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Hidden inputs for form submission */}
          <input type="hidden" {...register('bankName')} />
          <input type="hidden" {...register('accountNumber')} />
          <input type="hidden" {...register('accountHolder')} />
        </div>
      )}

      {/* 직접 입력 모드 */}
      {mode === 'direct' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>은행명</label>
            <input
              type="text"
              {...register('bankName')}
              disabled={disabled}
              placeholder="예: 국민은행"
              className={`${INPUT_BASE} ${errors.bankName ? 'border-red-500' : ''}`}
            />
            {errors.bankName && 'message' in errors.bankName && (
              <p className={ERROR_MESSAGE}>{errors.bankName.message as string}</p>
            )}
          </div>

          <div>
            <label className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>계좌번호</label>
            <input
              type="text"
              {...register('accountNumber')}
              disabled={disabled}
              placeholder="숫자만 입력"
              className={`${INPUT_BASE} ${errors.accountNumber ? 'border-red-500' : ''}`}
            />
            {errors.accountNumber && 'message' in errors.accountNumber && (
              <p className={ERROR_MESSAGE}>{errors.accountNumber.message as string}</p>
            )}
          </div>

          <div>
            <label className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>예금주</label>
            <input
              type="text"
              {...register('accountHolder')}
              disabled={disabled}
              placeholder="예금주 이름"
              className={`${INPUT_BASE} ${errors.accountHolder ? 'border-red-500' : ''}`}
            />
            {errors.accountHolder && 'message' in errors.accountHolder && (
              <p className={ERROR_MESSAGE}>{errors.accountHolder.message as string}</p>
            )}
          </div>
        </div>
      )}

      {/* 계좌 관리 모달 */}
      <BankAccountManagementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        accounts={accounts}
        onAccountsChange={handleAccountsChange}
      />
    </div>
  );
}
