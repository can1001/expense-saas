/**
 * 기타 자산/부채 현황 테이블
 */

import type { Asset, Liability } from '@/lib/data/financial-reports/types';
import { formatAmount } from './utils';

interface AssetLiabilityTableProps {
  assets: Asset[];
  liabilities: Liability[];
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR');
}

export function AssetLiabilityTable({ assets, liabilities }: AssetLiabilityTableProps) {
  const totalAssets = assets.reduce((sum, a) => sum + a.amount, 0);
  const totalLiability = {
    previousBalance: liabilities.reduce((sum, l) => sum + l.previousBalance, 0),
    increase: liabilities.reduce((sum, l) => sum + l.increase, 0),
    decrease: liabilities.reduce((sum, l) => sum + l.decrease, 0),
    currentBalance: liabilities.reduce((sum, l) => sum + l.currentBalance, 0),
  };

  if (assets.length === 0 && liabilities.length === 0) {
    return null;
  }

  return (
    <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">V. 기타 자산 / 부채 현황</h2>

      {/* 기타 자산 */}
      {assets.length > 0 && (
        <>
          <h3 className="text-lg font-medium text-gray-800 mb-3">1. 기타 자산</h3>
          <p className="text-right text-sm text-gray-500 mb-2">(단위: 원)</p>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-brand-600 text-white">
                  <th className="px-4 py-3 text-left font-semibold">자산 종류</th>
                  <th className="px-4 py-3 text-right font-semibold">금액</th>
                  <th className="px-4 py-3 text-left font-semibold">만기일자</th>
                  <th className="px-4 py-3 text-left font-semibold">소유자</th>
                  <th className="px-4 py-3 text-left font-semibold">비고</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{asset.assetType}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-600">
                      {formatAmount(asset.amount)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(asset.maturityDate)}</td>
                    <td className="px-4 py-3 text-gray-600">{asset.owner || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{asset.note || '-'}</td>
                  </tr>
                ))}
                <tr className="bg-green-50 font-bold">
                  <td className="px-4 py-3 text-gray-900">합계</td>
                  <td className="px-4 py-3 text-right text-green-700">
                    {formatAmount(totalAssets)}
                  </td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 기타 부채 */}
      {liabilities.length > 0 && (
        <>
          <h3 className="text-lg font-medium text-gray-800 mb-3">2. 기타 부채</h3>
          <p className="text-right text-sm text-gray-500 mb-2">(단위: 원)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-brand-600 text-white">
                  <th className="px-3 py-3 text-left font-semibold">항목</th>
                  <th className="px-3 py-3 text-right font-semibold">전기이월</th>
                  <th className="px-3 py-3 text-right font-semibold">증가</th>
                  <th className="px-3 py-3 text-right font-semibold">감소</th>
                  <th className="px-3 py-3 text-right font-semibold">차기이월</th>
                  <th className="px-3 py-3 text-left font-semibold">만기일자</th>
                  <th className="px-3 py-3 text-left font-semibold">채무자</th>
                  <th className="px-3 py-3 text-right font-semibold">금리</th>
                </tr>
              </thead>
              <tbody>
                {liabilities.map((liability) => (
                  <tr key={liability.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-3 text-gray-900">{liability.itemName}</td>
                    <td className="px-3 py-3 text-right text-gray-900">
                      {formatAmount(liability.previousBalance)}
                    </td>
                    <td className="px-3 py-3 text-right text-red-600">
                      {formatAmount(liability.increase)}
                    </td>
                    <td className="px-3 py-3 text-right text-green-600">
                      {formatAmount(liability.decrease)}
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-red-600">
                      {formatAmount(liability.currentBalance)}
                    </td>
                    <td className="px-3 py-3 text-gray-600">{formatDate(liability.maturityDate)}</td>
                    <td className="px-3 py-3 text-gray-600">{liability.debtor || '-'}</td>
                    <td className="px-3 py-3 text-right text-gray-600">
                      {liability.interestRate ? `${liability.interestRate.toFixed(2)}%` : '-'}
                    </td>
                  </tr>
                ))}
                <tr className="bg-red-50 font-bold">
                  <td className="px-3 py-3 text-gray-900">합계</td>
                  <td className="px-3 py-3 text-right text-gray-900">
                    {formatAmount(totalLiability.previousBalance)}
                  </td>
                  <td className="px-3 py-3 text-right text-red-600">
                    {formatAmount(totalLiability.increase)}
                  </td>
                  <td className="px-3 py-3 text-right text-green-600">
                    {formatAmount(totalLiability.decrease)}
                  </td>
                  <td className="px-3 py-3 text-right text-red-700">
                    {formatAmount(totalLiability.currentBalance)}
                  </td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
