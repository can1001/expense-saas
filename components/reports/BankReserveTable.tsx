/**
 * 입출금 통장 및 적립금 현황 테이블
 */

import type { BankAccount, Reserve } from '@/lib/data/financial-reports/types';
import { formatAmount } from './utils';

interface BankReserveTableProps {
  bankAccounts: BankAccount[];
  reserves: Reserve[];
}

export function BankReserveTable({ bankAccounts, reserves }: BankReserveTableProps) {
  const totalBankBalance = bankAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalReserve = {
    previousBalance: reserves.reduce((sum, r) => sum + r.previousBalance, 0),
    increase: reserves.reduce((sum, r) => sum + r.increase, 0),
    decrease: reserves.reduce((sum, r) => sum + r.decrease, 0),
    currentBalance: reserves.reduce((sum, r) => sum + r.currentBalance, 0),
  };

  return (
    <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">IV. 입출금 통장 및 적립금 현황</h2>

      {/* 입출금 통장 */}
      {bankAccounts.length > 0 && (
        <>
          <h3 className="text-lg font-medium text-gray-800 mb-3">1. 입출금 통장</h3>
          <p className="text-right text-sm text-gray-500 mb-2">(단위: 원)</p>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="px-4 py-3 text-left font-semibold">예금 종류</th>
                  <th className="px-4 py-3 text-right font-semibold">예금 잔액</th>
                  <th className="px-4 py-3 text-left font-semibold">계좌번호</th>
                  <th className="px-4 py-3 text-left font-semibold">비고</th>
                </tr>
              </thead>
              <tbody>
                {bankAccounts.map((account) => (
                  <tr key={account.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{account.accountType}</td>
                    <td className="px-4 py-3 text-right font-medium text-blue-600">
                      {formatAmount(account.balance)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{account.accountNumber || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{account.note || '-'}</td>
                  </tr>
                ))}
                <tr className="bg-blue-50 font-bold">
                  <td className="px-4 py-3 text-gray-900">합계</td>
                  <td className="px-4 py-3 text-right text-blue-700">
                    {formatAmount(totalBankBalance)}
                  </td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 적립금 */}
      {reserves.length > 0 && (
        <>
          <h3 className="text-lg font-medium text-gray-800 mb-3">2. 적립금</h3>
          <p className="text-right text-sm text-gray-500 mb-2">(단위: 원)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="px-4 py-3 text-left font-semibold">항목</th>
                  <th className="px-4 py-3 text-right font-semibold">전기이월</th>
                  <th className="px-4 py-3 text-right font-semibold">증가</th>
                  <th className="px-4 py-3 text-right font-semibold">감소</th>
                  <th className="px-4 py-3 text-right font-semibold">차기이월</th>
                  <th className="px-4 py-3 text-left font-semibold">비고</th>
                </tr>
              </thead>
              <tbody>
                {reserves.map((reserve) => (
                  <tr key={reserve.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{reserve.itemName}</td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatAmount(reserve.previousBalance)}
                    </td>
                    <td className="px-4 py-3 text-right text-green-600">
                      {formatAmount(reserve.increase)}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600">
                      {formatAmount(reserve.decrease)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-blue-600">
                      {formatAmount(reserve.currentBalance)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{reserve.note || '-'}</td>
                  </tr>
                ))}
                <tr className="bg-blue-50 font-bold">
                  <td className="px-4 py-3 text-gray-900">합계</td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {formatAmount(totalReserve.previousBalance)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-600">
                    {formatAmount(totalReserve.increase)}
                  </td>
                  <td className="px-4 py-3 text-right text-red-600">
                    {formatAmount(totalReserve.decrease)}
                  </td>
                  <td className="px-4 py-3 text-right text-blue-700">
                    {formatAmount(totalReserve.currentBalance)}
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
