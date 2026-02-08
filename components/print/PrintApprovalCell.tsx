'use client';

import React from 'react';

interface PrintApprovalCellProps {
  title: string;              // 헤더 텍스트 (예: "사역팀(부)장", "회계", "재정팀장")
  approverName?: string;      // 결재자 이름
  status?: string;            // 'APPROVED' | 'REJECTED' | 'PENDING'
  signatureData?: string;     // 서명 이미지 데이터
  isAutoApproved?: boolean;   // 전결 여부
  autoApprovalText?: string;  // 전결 표시 텍스트
  className?: string;         // 위치/스타일 커스터마이징
}

function formatNameForPrint(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  return trimmed.split('').join(' ');
}

export default function PrintApprovalCell({
  title,
  approverName = '',
  status,
  signatureData,
  isAutoApproved = false,
  autoApprovalText,
  className
}: PrintApprovalCellProps) {
  return (
    <div className={`approval-cell ${className || ''}`}>
      <table className="approval-cell-table">
        <tbody>
          <tr>
            <td className="cell-header">{title}</td>
          </tr>
          <tr>
            <td className="cell-sign">
              {status === 'APPROVED' && isAutoApproved ? (
                <span className="auto-approved-mark">{autoApprovalText || '전결'}</span>
              ) : status === 'APPROVED' && signatureData ? (
                <img src={signatureData} alt="서명" className="signature-image" />
              ) : status === 'APPROVED' ? (
                <span className="approved-mark">승인</span>
              ) : status === 'REJECTED' ? (
                <span className="rejected-mark">반려</span>
              ) : (
                <span className="pending-mark"></span>
              )}
            </td>
          </tr>
          <tr>
            <td className="cell-name">{formatNameForPrint(approverName)}</td>
          </tr>
        </tbody>
      </table>

      <style jsx>{`
        .approval-cell {
          display: flex;
          flex: 1;
        }

        .approval-cell-table {
          border-collapse: collapse;
          width: 100%;
          height: 100%;
        }

        .cell-header {
          background-color: #f8f8f8;
          font-size: 9pt;
          font-weight: bold;
          text-align: center;
          padding: 6px 10px;
          border-bottom: 1px solid #000;
          min-width: 60px;
          white-space: nowrap;
        }

        .cell-sign {
          height: 45px;
          text-align: center;
          vertical-align: middle;
          border-bottom: 1px solid #000;
          padding: 4px;
          min-width: 60px;
        }

        .signature-image {
          max-width: 45px;
          max-height: 38px;
          object-fit: contain;
        }

        .approved-mark {
          color: #10B981;
          font-size: 10pt;
          font-weight: bold;
        }

        .auto-approved-mark {
          color: #2563EB;
          font-size: 9pt;
          font-weight: bold;
          white-space: nowrap;
        }

        .rejected-mark {
          color: #EF4444;
          font-size: 10pt;
          font-weight: bold;
        }

        .pending-mark {
          display: block;
          height: 38px;
        }

        .cell-name {
          font-size: 9pt;
          text-align: center;
          padding: 6px;
          letter-spacing: 3px;
          min-width: 60px;
        }

        @media print {
          .cell-header {
            background-color: #f8f8f8 !important;
          }

          .approved-mark {
            color: #10B981 !important;
          }

          .rejected-mark {
            color: #EF4444 !important;
          }

          .auto-approved-mark {
            color: #2563EB !important;
          }
        }
      `}</style>
    </div>
  );
}
