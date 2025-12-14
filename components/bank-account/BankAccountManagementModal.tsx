'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { SavedBankAccount } from '@/lib/schemas/bank-account-schema';
import {
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  BankAccountServiceError,
} from '@/lib/services/bank-account-service';
import {
  INPUT_BASE,
  BTN_PRIMARY,
  BTN_DANGER,
  BTN_OUTLINE,
  BTN_SM,
  BADGE_DEFAULT,
  LABEL_BASE,
  SPINNER,
} from '@/lib/constants/styles';

interface BankAccountManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: SavedBankAccount[];
  onAccountsChange: () => void;
}

export default function BankAccountManagementModal({
  isOpen,
  onClose,
  accounts,
  onAccountsChange,
}: BankAccountManagementModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 폼 상태
  const [formData, setFormData] = useState({
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    nickname: '',
    isDefault: false,
  });

  const resetForm = () => {
    setFormData({
      bankName: '',
      accountNumber: '',
      accountHolder: '',
      nickname: '',
      isDefault: false,
    });
    setEditingId(null);
    setShowAddForm(false);
    setError(null);
  };

  const handleAdd = async () => {
    if (!formData.bankName || !formData.accountNumber || !formData.accountHolder) {
      setError('은행명, 계좌번호, 예금주는 필수 입력입니다.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createBankAccount({
        bankName: formData.bankName,
        accountNumber: formData.accountNumber,
        accountHolder: formData.accountHolder,
        nickname: formData.nickname || null,
        isDefault: formData.isDefault,
      });
      resetForm();
      onAccountsChange();
    } catch (err) {
      if (err instanceof BankAccountServiceError) {
        setError(err.message);
      } else {
        setError('계좌 저장에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (account: SavedBankAccount) => {
    setFormData({
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountHolder: account.accountHolder,
      nickname: account.nickname || '',
      isDefault: account.isDefault,
    });
    setEditingId(account.id);
    setShowAddForm(false);
    setError(null);
  };

  const handleUpdate = async () => {
    if (!editingId) return;

    if (!formData.bankName || !formData.accountNumber || !formData.accountHolder) {
      setError('은행명, 계좌번호, 예금주는 필수 입력입니다.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await updateBankAccount(editingId, {
        bankName: formData.bankName,
        accountNumber: formData.accountNumber,
        accountHolder: formData.accountHolder,
        nickname: formData.nickname || null,
        isDefault: formData.isDefault,
      });
      resetForm();
      onAccountsChange();
    } catch (err) {
      if (err instanceof BankAccountServiceError) {
        setError(err.message);
      } else {
        setError('계좌 수정에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 계좌를 삭제하시겠습니까?')) return;

    setLoading(true);
    setError(null);

    try {
      await deleteBankAccount(id);
      if (editingId === id) {
        resetForm();
      }
      onAccountsChange();
    } catch (err) {
      if (err instanceof BankAccountServiceError) {
        setError(err.message);
      } else {
        setError('계좌 삭제에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      await updateBankAccount(id, { isDefault: true });
      onAccountsChange();
    } catch (err) {
      if (err instanceof BankAccountServiceError) {
        setError(err.message);
      } else {
        setError('기본 계좌 설정에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="저장된 계좌 관리" size="lg">
      <div className="space-y-4">
        {/* 에러 메시지 */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* 계좌 목록 */}
        <div className="space-y-2">
          {accounts.length === 0 ? (
            <p className="text-gray-500 text-center py-4">저장된 계좌가 없습니다.</p>
          ) : (
            accounts.map((account) => (
              <div
                key={account.id}
                className={`p-3 border rounded-lg flex items-center justify-between ${
                  editingId === account.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {account.nickname || account.accountHolder}
                    </span>
                    <span className="text-gray-500">-</span>
                    <span className="text-gray-700">{account.bankName}</span>
                    {account.isDefault && (
                      <span className={BADGE_DEFAULT}>기본</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {account.accountNumber} ({account.accountHolder})
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!account.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(account.id)}
                      disabled={loading}
                      className={`${BTN_OUTLINE} ${BTN_SM}`}
                    >
                      기본 설정
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleEdit(account)}
                    disabled={loading}
                    className={`${BTN_OUTLINE} ${BTN_SM}`}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(account.id)}
                    disabled={loading}
                    className={`${BTN_DANGER} ${BTN_SM}`}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 구분선 */}
        <hr className="border-gray-200" />

        {/* 추가/수정 폼 */}
        {(showAddForm || editingId) ? (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900">
              {editingId ? '계좌 수정' : '새 계좌 추가'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_BASE}>
                  은행명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={(e) =>
                    setFormData({ ...formData, bankName: e.target.value })
                  }
                  placeholder="예: 국민은행"
                  className={INPUT_BASE}
                  disabled={loading}
                />
              </div>

              <div>
                <label className={LABEL_BASE}>
                  계좌번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.accountNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, accountNumber: e.target.value })
                  }
                  placeholder="숫자와 하이픈만 입력"
                  className={INPUT_BASE}
                  disabled={loading}
                />
              </div>

              <div>
                <label className={LABEL_BASE}>
                  예금주 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.accountHolder}
                  onChange={(e) =>
                    setFormData({ ...formData, accountHolder: e.target.value })
                  }
                  placeholder="예금주 이름"
                  className={INPUT_BASE}
                  disabled={loading}
                />
              </div>

              <div>
                <label className={LABEL_BASE}>별명 (선택)</label>
                <input
                  type="text"
                  value={formData.nickname}
                  onChange={(e) =>
                    setFormData({ ...formData, nickname: e.target.value })
                  }
                  placeholder="예: 개인 급여계좌"
                  className={INPUT_BASE}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) =>
                  setFormData({ ...formData, isDefault: e.target.checked })
                }
                disabled={loading}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="isDefault" className="text-sm text-gray-700">
                기본 계좌로 설정
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                disabled={loading}
                className={`${BTN_OUTLINE} ${BTN_SM}`}
              >
                취소
              </button>
              <button
                type="button"
                onClick={editingId ? handleUpdate : handleAdd}
                disabled={loading}
                className={`${BTN_PRIMARY} ${BTN_SM}`}
              >
                {loading && <div className={SPINNER}></div>}
                {editingId ? '수정' : '추가'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className={`${BTN_PRIMARY} w-full`}
          >
            + 새 계좌 추가
          </button>
        )}
      </div>
    </Modal>
  );
}
