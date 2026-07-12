'use client';

import React from 'react';
import { ApprovalLine } from './types';
import { useOrgTerms } from '@/lib/contexts/TenantContext';

interface PrintApprovalBoxProps {
  approvalLine?: ApprovalLine | null;
  className?: string;
}

function formatNameForPrint(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  return trimmed.split('').join(' ');
}

export default function PrintApprovalBox({ approvalLine, className }: PrintApprovalBoxProps) {
  const terms = useOrgTerms();
  const steps = approvalLine?.steps || [];
  const hasApprovalLine = steps.length > 0;

  return (
    <div className={className}>
      <table className="approval-table">
        <thead>
          <tr>
            {hasApprovalLine ? (
              steps.map((step) => {
                // 1차 결재 단계는 항상 사역팀(부)장으로 표시
                const displayName = step.stepNumber === 1
                  ? `${terms.departmentFull}장`
                  : step.stepName;
                return (
                  <th key={`h-${step.id}`} className="approval-header">
                    {displayName}
                  </th>
                );
              })
            ) : (
              <>
                <th className="approval-header">{`${terms.departmentFull}장`}</th>
                <th className="approval-header">회계</th>
                <th className="approval-header">재정팀장</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          <tr>
            {hasApprovalLine ? (
              steps.map((step) => {
                const isAutoApproved = step.stepName.includes('전결');
                return (
                  <td key={`s-${step.id}`} className="approval-sign-cell">
                    {step.status === 'APPROVED' && isAutoApproved ? (
                      <span className="auto-approved-mark">{step.stepName}</span>
                    ) : step.status === 'APPROVED' && step.signatureData ? (
                      <img src={step.signatureData} alt="서명" className="signature-image" />
                    ) : step.status === 'APPROVED' ? (
                      <span className="approved-mark">승인</span>
                    ) : step.status === 'REJECTED' ? (
                      <span className="rejected-mark">반려</span>
                    ) : (
                      <span className="pending-mark"></span>
                    )}
                  </td>
                );
              })
            ) : (
              <>
                <td className="approval-sign-cell"></td>
                <td className="approval-sign-cell"></td>
                <td className="approval-sign-cell"></td>
              </>
            )}
          </tr>
          <tr>
            {hasApprovalLine ? (
              steps.map((step) => (
                <td key={`n-${step.id}`} className="approval-name-cell">
                  {formatNameForPrint(step.approverName)}
                </td>
              ))
            ) : (
              <>
                <td className="approval-name-cell"></td>
                <td className="approval-name-cell"></td>
                <td className="approval-name-cell"></td>
              </>
            )}
          </tr>
        </tbody>
      </table>

      <style jsx>{`
        .approval-table {
          width: 100%;
          height: 100%;
          border-collapse: collapse;
        }

        .approval-header {
          background-color: #f8f8f8;
          font-size: 9pt;
          font-weight: bold;
          text-align: center;
          padding: 6px 10px;
          border-bottom: 1px solid #000;
          border-right: 1px solid #000;
          min-width: 55px;
        }

        .approval-header:last-child {
          border-right: none;
        }

        .approval-sign-cell {
          height: 50px;
          text-align: center;
          vertical-align: middle;
          border-bottom: 1px solid #000;
          border-right: 1px solid #000;
          padding: 4px;
        }

        .approval-sign-cell:last-child {
          border-right: none;
        }

        .signature-image {
          max-width: 45px;
          max-height: 40px;
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
          height: 40px;
        }

        .approval-name-cell {
          font-size: 9pt;
          text-align: center;
          padding: 6px;
          border-right: 1px solid #000;
          letter-spacing: 3px;
        }

        .approval-name-cell:last-child {
          border-right: none;
        }

        @media print {
          .approval-header {
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
