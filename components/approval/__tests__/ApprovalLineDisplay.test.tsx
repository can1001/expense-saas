import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ApprovalLineDisplay from '../ApprovalLineDisplay';

const baseLine = {
  id: 'line-1',
  currentStep: 2,
  totalSteps: 3,
  isUrgent: false,
  createdAt: new Date('2026-07-01T00:00:00Z'),
  updatedAt: new Date('2026-07-01T00:00:00Z'),
  steps: [
    {
      id: 'step-1',
      stepNumber: 1,
      stepName: '팀장 승인',
      approverName: '김팀장',
      status: 'APPROVED',
      approvedAt: new Date('2026-07-01T01:00:00Z'),
      isRequired: true,
    },
    {
      id: 'step-2',
      stepNumber: 2,
      stepName: '회계 확인',
      approverName: '이회계',
      status: 'PENDING',
      comment: '영수증 확인 필요',
      isRequired: true,
    },
    {
      id: 'step-3',
      stepNumber: 3,
      stepName: '재정팀장 승인',
      approverName: '박재정',
      status: 'PENDING',
      isRequired: true,
    },
  ],
};

describe('ApprovalLineDisplay', () => {
  it('결재선이 없으면 안내 메시지를 표시한다', () => {
    render(<ApprovalLineDisplay approvalLine={null} expenseStatus="DRAFT" />);
    expect(screen.getByText(/결재선이 생성되지 않았습니다/)).toBeInTheDocument();
  });

  it('완료 단계는 브랜드 컬러 체크 노드로 표시된다', () => {
    render(<ApprovalLineDisplay approvalLine={baseLine} expenseStatus="PENDING" />);
    const approvedPill = screen.getByText('승인');
    expect(approvedPill.className).toContain('bg-status-approved-bg');
    // 체크 아이콘을 감싸는 노드는 bg-brand-500
    const node = approvedPill.closest('.p-4')?.querySelector('.bg-brand-500');
    expect(node).toBeInTheDocument();
  });

  it('대기 단계는 status-pending-bar 3px 링으로 표시된다', () => {
    render(<ApprovalLineDisplay approvalLine={baseLine} expenseStatus="PENDING" />);
    const pendingPills = screen.getAllByText('대기');
    expect(pendingPills.length).toBe(2);
    const ringNode = pendingPills[0].closest('.p-4')?.querySelector('.ring-status-pending-bar');
    expect(ringNode).toBeInTheDocument();
    expect(ringNode?.className).toContain('ring-[3px]');
  });

  it('반려 단계는 status-rejected 토큰으로 표시된다', () => {
    const rejectedLine = {
      ...baseLine,
      steps: [
        {
          ...baseLine.steps[0],
          status: 'REJECTED',
          rejectedAt: new Date('2026-07-01T02:00:00Z'),
        },
        ...baseLine.steps.slice(1),
      ],
    };
    render(<ApprovalLineDisplay approvalLine={rejectedLine} expenseStatus="REJECTED" />);
    const rejectedPill = screen.getByText('반려');
    expect(rejectedPill.className).toContain('bg-status-rejected-bg');
    const node = rejectedPill.closest('.p-4')?.querySelector('.bg-status-rejected');
    expect(node).toBeInTheDocument();
  });

  it('승인 시각과 코멘트 정보를 유지한다', () => {
    render(<ApprovalLineDisplay approvalLine={baseLine} expenseStatus="PENDING" />);
    expect(screen.getByText(/승인:/)).toBeInTheDocument();
    expect(screen.getByText('영수증 확인 필요')).toBeInTheDocument();
  });

  it('모든 결재 완료 시 최종 승인 메시지를 표시한다', () => {
    render(<ApprovalLineDisplay approvalLine={baseLine} expenseStatus="APPROVED_FINAL" />);
    expect(screen.getByText(/모든 결재가 완료되었습니다/)).toBeInTheDocument();
  });

  it('반려 상태에서는 최종 반려 메시지를 표시한다', () => {
    render(<ApprovalLineDisplay approvalLine={baseLine} expenseStatus="REJECTED" />);
    expect(screen.getByText(/지출결의서가 반려되었습니다/)).toBeInTheDocument();
  });
});
