/* eslint-disable jsx-a11y/alt-text */
// react-pdf Image component doesn't support alt attribute
'use client';

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { Expense, ExpenseAttachment } from '@/lib/types';
import type { PrintMode } from './print';

interface ApprovalStep {
  id: string;
  stepNumber: number;
  stepName: string;
  approverName: string;
  status: string;
  approvedAt?: Date | null;
  signatureType?: string | null;
  signatureData?: string | null;
}

interface ApprovalLine {
  id: string;
  currentStep: number;
  totalSteps: number;
  steps: ApprovalStep[];
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  // 헤더 영역 (로고 + 제목 + 결재란)
  headerRow: {
    flexDirection: 'row',
    border: '1px solid #000',
    marginBottom: 0,
  },
  logoSection: {
    width: 60,
    padding: 8,
    borderRight: '1px solid #000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 45,
    height: 45,
    objectFit: 'contain',
  },
  titleSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRight: '1px solid #000',
    padding: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 8,
  },
  // 결재란
  approvalSection: {
    flexDirection: 'row',
    width: 165,
  },
  approvalColumn: {
    flex: 1,
    borderRight: '1px solid #000',
  },
  approvalColumnLast: {
    flex: 1,
  },
  approvalHeader: {
    backgroundColor: '#f5f5f5',
    padding: 4,
    fontSize: 7,
    fontWeight: 'bold',
    textAlign: 'center',
    borderBottom: '1px solid #000',
  },
  approvalSignCell: {
    height: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottom: '1px solid #000',
  },
  signatureImage: {
    width: 40,
    height: 25,
    objectFit: 'contain',
  },
  approvedText: {
    fontSize: 7,
    color: '#10B981',
    fontWeight: 'bold',
  },
  rejectedText: {
    fontSize: 7,
    color: '#EF4444',
    fontWeight: 'bold',
  },
  approvalNameCell: {
    padding: 3,
    fontSize: 7,
    textAlign: 'center',
  },
  // 정보 테이블 - 1줄 콤팩트형
  infoTable: {
    border: '1px solid #000',
    borderTop: 'none',
  },
  infoRowLast: {
    flexDirection: 'row',
  },
  headerInfoCell: {
    flex: 1,
    padding: 8,
    fontSize: 9,
    textAlign: 'center',
    borderRight: '1px solid #000',
  },
  headerInfoCellLast: {
    flex: 1,
    padding: 8,
    fontSize: 9,
    textAlign: 'center',
  },
  headerInfoLabel: {
    fontWeight: 'bold',
    color: '#333',
  },
  headerInfoValue: {
    fontWeight: 'bold',
  },
  headerAmountValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  // 세부 항목 테이블
  itemsSection: {
    marginTop: 10,
    border: '1px solid #000',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#c8e6c9',
    borderBottom: '1px solid #000',
  },
  tableHeaderCell: {
    padding: 6,
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
    borderRight: '1px solid #000',
  },
  tableHeaderCellLast: {
    padding: 6,
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #000',
  },
  tableRowLast: {
    flexDirection: 'row',
  },
  tableCell: {
    padding: 5,
    fontSize: 8,
    textAlign: 'center',
    borderRight: '1px solid #000',
  },
  tableCellLeft: {
    padding: 5,
    fontSize: 8,
    textAlign: 'left',
    borderRight: '1px solid #000',
  },
  tableCellRight: {
    padding: 5,
    fontSize: 8,
    textAlign: 'right',
    borderRight: '1px solid #000',
  },
  tableCellRightLast: {
    padding: 5,
    fontSize: 8,
    textAlign: 'right',
  },
  tableFooter: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
  },
  totalLabel: {
    flex: 1,
    padding: 8,
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'right',
    borderRight: '1px solid #000',
  },
  totalAmount: {
    width: 100,
    padding: 8,
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  // 청구내역 섹션
  requestSection: {
    marginTop: 10,
    border: '1px solid #000',
  },
  requestRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #000',
  },
  requestRowLast: {
    flexDirection: 'row',
  },
  sectionLabel: {
    width: 35,
    backgroundColor: '#f5f5f5',
    padding: 8,
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
    borderRight: '1px solid #000',
    justifyContent: 'center',
  },
  requestLabel: {
    width: 70,
    backgroundColor: '#f5f5f5',
    padding: 6,
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
    borderRight: '1px solid #000',
  },
  requestValue: {
    flex: 1,
    padding: 6,
    fontSize: 8,
    textAlign: 'center',
    borderRight: '1px solid #000',
  },
  requestValueLast: {
    flex: 1,
    padding: 6,
    fontSize: 8,
    textAlign: 'center',
  },
  sealMark: {
    color: '#d32f2f',
    fontWeight: 'bold',
  },
  // 청구내역 1줄 콤팩트형
  requestInfoCell: {
    flex: 1,
    padding: 8,
    fontSize: 8,
    textAlign: 'center',
    borderRight: '1px solid #000',
  },
  requestInfoCellLast: {
    flex: 1,
    padding: 8,
    fontSize: 8,
    textAlign: 'center',
  },
  infoLabel: {
    fontWeight: 'bold',
    color: '#333',
  },
  infoValue: {
    fontWeight: 'bold',
  },
  // 입금정보 섹션
  bankSection: {
    marginTop: 8,
    border: '1px solid #000',
  },
  bankRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #000',
  },
  bankRowLast: {
    flexDirection: 'row',
  },
  // 최종확인 1줄 통합형
  confirmationSection: {
    marginTop: 8,
    border: '1px solid #000',
  },
  confirmationRow: {
    flexDirection: 'row',
  },
  confirmCell: {
    flex: 1,
    padding: 8,
    fontSize: 8,
    textAlign: 'center',
    borderRight: '1px solid #000',
  },
  confirmCellLast: {
    flex: 1,
    padding: 8,
    fontSize: 8,
    textAlign: 'center',
  },
  confirmLabel: {
    fontWeight: 'bold',
    color: '#333',
  },
  confirmDate: {
    fontWeight: 'bold',
  },
  // 푸터
  footer: {
    marginTop: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTop: '2px solid #000',
  },
  churchName: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 8,
    color: '#26a69a',
  },
  versionText: {
    fontSize: 7,
    color: '#666',
  },
  // 첨부파일 페이지 스타일
  attachmentsPage: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  attachmentsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 4,
  },
  attachmentsSubtitle: {
    fontSize: 10,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  attachmentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 15,
  },
  attachmentItem: {
    width: 250,
    border: '1px solid #000',
    padding: 10,
    marginBottom: 15,
  },
  attachmentImage: {
    width: '100%',
    maxHeight: 300,
    objectFit: 'contain',
  },
  attachmentName: {
    fontSize: 8,
    textAlign: 'center',
    marginTop: 8,
    color: '#333',
    borderTop: '1px solid #ddd',
    paddingTop: 5,
  },
  attachmentNumber: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 20,
    height: 20,
    backgroundColor: '#333',
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    borderRadius: 10,
    textAlign: 'center',
    paddingTop: 3,
  },
  noAttachments: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 600,
  },
  noAttachmentsText: {
    fontSize: 14,
    color: '#999',
    letterSpacing: 2,
  },
});

interface PDFDocumentProps {
  expense: Expense;
  approvalLine?: ApprovalLine | null;
  printMode?: PrintMode;
}

// 첨부파일 페이지 컴포넌트
const AttachmentsPage: React.FC<{ attachments: ExpenseAttachment[] }> = ({ attachments }) => {
  if (!attachments || attachments.length === 0) {
    return (
      <Page size="A4" style={styles.attachmentsPage}>
        <View style={styles.noAttachments}>
          <Text style={styles.noAttachmentsText}>(첨부서류 없음)</Text>
        </View>
      </Page>
    );
  }

  return (
    <Page size="A4" style={styles.attachmentsPage}>
      <Text style={styles.attachmentsTitle}>첨 부 서 류</Text>
      <Text style={styles.attachmentsSubtitle}>(영수증 및 증빙자료)</Text>

      <View style={styles.attachmentsGrid}>
        {attachments.map((attachment, index) => (
          <View key={attachment.id} style={styles.attachmentItem}>
            <Text style={styles.attachmentNumber}>{index + 1}</Text>
            {attachment.format !== 'pdf' && (
              <Image src={attachment.secureUrl} style={styles.attachmentImage} />
            )}
            <Text style={styles.attachmentName}>{attachment.fileName}</Text>
          </View>
        ))}
      </View>
    </Page>
  );
};

export const ExpensePDFDocument: React.FC<PDFDocumentProps> = ({ expense, approvalLine, printMode = 'both' }) => {
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('ko-KR');
  };

  const expenseDate = expense.expenseDate ? new Date(expense.expenseDate) : null;
  const requestDate = new Date(expense.requestDate);

  const steps = approvalLine?.steps || [];
  const hasApprovalLine = steps.length > 0;

  // 결재란 기본 3열
  const defaultSteps = [
    { id: '1', stepName: '담당', approverName: '', status: 'PENDING', signatureData: null },
    { id: '2', stepName: '팀장', approverName: '', status: 'PENDING', signatureData: null },
    { id: '3', stepName: '회계', approverName: '', status: 'PENDING', signatureData: null },
  ];

  const displaySteps = hasApprovalLine ? steps : defaultSteps;

  // 지출결의서 페이지 렌더 함수
  const renderExpensePage = () => (
    <Page size="A4" style={styles.page}>
        {/* 헤더: 로고 + 제목 + 결재란 */}
        <View style={styles.headerRow}>
          {/* 로고 */}
          <View style={styles.logoSection}>
            <Image src="/logo.png" style={styles.logoImage} />
          </View>

          {/* 제목 */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>지 출 결 의 서</Text>
          </View>

          {/* 결재란 */}
          <View style={styles.approvalSection}>
            {displaySteps.map((step, index) => (
              <View
                key={step.id}
                style={index === displaySteps.length - 1 ? styles.approvalColumnLast : styles.approvalColumn}
              >
                <Text style={styles.approvalHeader}>{step.stepName}</Text>
                <View style={styles.approvalSignCell}>
                  {step.status === 'APPROVED' && step.signatureData ? (
                    <Image src={step.signatureData} style={styles.signatureImage} />
                  ) : step.status === 'APPROVED' ? (
                    <Text style={styles.approvedText}>승인</Text>
                  ) : step.status === 'REJECTED' ? (
                    <Text style={styles.rejectedText}>반려</Text>
                  ) : null}
                </View>
                <Text style={styles.approvalNameCell}>
                  {step.approverName ? step.approverName.split('').join(' ') : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* 예산/지출 정보 - 1줄 콤팩트형 */}
        <View style={styles.infoTable}>
          <View style={styles.infoRowLast}>
            <Text style={styles.headerInfoCell}>
              <Text style={styles.headerInfoLabel}>예산항목: </Text>
              <Text style={styles.headerInfoValue}>{expense.items?.[0]?.budgetCategory || '-'}/{expense.items?.[0]?.budgetSubcategory || '-'}</Text>
            </Text>
            <Text style={styles.headerInfoCell}>
              <Text style={styles.headerInfoLabel}>지출일자: </Text>
              <Text style={styles.headerInfoValue}>{expenseDate ? format(expenseDate, 'yyyy.MM.dd') : '미정'}</Text>
            </Text>
            <Text style={styles.headerInfoCellLast}>
              <Text style={styles.headerInfoLabel}>청구금액: </Text>
              <Text style={styles.headerAmountValue}>₩ {formatCurrency(expense.requestAmount)} 원</Text>
            </Text>
          </View>
        </View>

        {/* 세부 항목 테이블 */}
        <View style={styles.itemsSection}>
          {/* 헤더 */}
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.tableHeaderCell, width: '10%' }}>세목</Text>
            <Text style={{ ...styles.tableHeaderCell, flex: 1 }}>적요</Text>
            <Text style={{ ...styles.tableHeaderCell, width: '15%' }}>단가</Text>
            <Text style={{ ...styles.tableHeaderCell, width: '10%' }}>수량</Text>
            <Text style={{ ...styles.tableHeaderCellLast, width: '18%' }}>금액</Text>
          </View>

          {/* 항목들 */}
          {expense.items.map((item, index) => (
            <View
              key={item.id}
              style={index === expense.items.length - 1 ? styles.tableRowLast : styles.tableRow}
            >
              <Text style={{ ...styles.tableCell, width: '10%' }}>{item.budgetDetail}</Text>
              <Text style={{ ...styles.tableCellLeft, flex: 1 }}>{item.description}</Text>
              <Text style={{ ...styles.tableCellRight, width: '15%' }}>
                {formatCurrency(item.unitPrice)}
              </Text>
              <Text style={{ ...styles.tableCell, width: '10%' }}>{item.quantity}</Text>
              <Text style={{ ...styles.tableCellRightLast, width: '18%' }}>
                {formatCurrency(item.amount)}
              </Text>
            </View>
          ))}

          {/* 합계 */}
          <View style={styles.tableFooter}>
            <Text style={styles.totalLabel}>합 계</Text>
            <Text style={styles.totalAmount}>{formatCurrency(expense.requestAmount)} 원</Text>
          </View>
        </View>

        {/* 청구내역 - 1줄 콤팩트형 */}
        <View style={styles.requestSection}>
          <View style={styles.requestRowLast}>
            <Text style={styles.requestInfoCell}>
              <Text style={styles.infoLabel}>청구일자: </Text>
              <Text style={styles.infoValue}>{format(requestDate, 'yyyy.MM.dd')}</Text>
            </Text>
            <Text style={styles.requestInfoCell}>
              <Text style={styles.infoLabel}>청구팀(부): </Text>
              <Text style={styles.infoValue}>{expense.committee}/{expense.department}</Text>
            </Text>
            <Text style={styles.requestInfoCellLast}>
              <Text style={styles.infoLabel}>청구인: </Text>
              <Text style={styles.infoValue}>{expense.applicantName}</Text>
              <Text style={styles.sealMark}>  (인)</Text>
            </Text>
          </View>
        </View>

        {/* 입금정보 - 1줄 콤팩트형 */}
        <View style={styles.bankSection}>
          <View style={styles.bankRowLast}>
            <Text style={styles.requestInfoCell}>
              <Text style={styles.infoLabel}>은행: </Text>
              <Text style={styles.infoValue}>{expense.bankName}</Text>
            </Text>
            <Text style={{ ...styles.requestInfoCell, flex: 2 }}>
              <Text style={styles.infoLabel}>계좌번호: </Text>
              <Text style={styles.infoValue}>{expense.accountNumber}</Text>
            </Text>
            <Text style={styles.requestInfoCellLast}>
              <Text style={styles.infoLabel}>예금주: </Text>
              <Text style={styles.infoValue}>{expense.accountHolder}</Text>
            </Text>
          </View>
        </View>

        {/* 최종확인 - 1줄 통합형 */}
        {/* <View style={styles.confirmationSection}>
          <View style={styles.confirmationRow}>
            <Text style={styles.confirmCell}>
              <Text style={styles.confirmLabel}>재정팀 검토  </Text>
              <Text style={styles.sealMark}>(인)</Text>
            </Text>
            <Text style={styles.confirmCell}>
              <Text style={styles.confirmLabel}>회계 승인  </Text>
              <Text style={styles.sealMark}>(인)</Text>
            </Text>
            <Text style={styles.confirmCellLast}>
              <Text style={styles.confirmLabel}>지급완료  </Text>
              <Text style={styles.confirmDate}>____.____.____</Text>
            </Text>
          </View>
        </View> */}

        {/* 푸터 */}
        <View style={styles.footer}>
          <Text style={styles.churchName}>청 연 교 회</Text>
          <Text style={styles.versionText}>지출결의서 Ver.4.1.4</Text>
        </View>
      </Page>
    );

  return (
    <Document>
      {printMode !== 'receipt' && renderExpensePage()}
      {printMode !== 'expense' && (
        <AttachmentsPage attachments={expense.attachments || []} />
      )}
    </Document>
  );
};

export default ExpensePDFDocument;
