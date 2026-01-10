'use client';

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { Expense } from '@/lib/types';

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

// 한글 폰트 등록 (옵션: 웹 폰트 사용)
// Font.register({
//   family: 'NotoSansKR',
//   src: 'https://fonts.gstatic.com/s/notosanskr/v12/Pby7FmXiEBPT4ITbgNA5CgmOsn7uwpYcuH8y.ttf',
// });

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    textAlign: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
    marginBottom: 5,
  },
  section: {
    marginBottom: 15,
    padding: 10,
    border: '1px solid #ddd',
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '2px solid #3B82F6',
    color: '#3B82F6',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: '30%',
    fontWeight: 'bold',
    color: '#374151',
  },
  value: {
    width: '70%',
    color: '#1F2937',
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#3B82F6',
    padding: 8,
    color: 'white',
    fontWeight: 'bold',
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #E5E7EB',
    padding: 8,
    fontSize: 9,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottom: '1px solid #E5E7EB',
    padding: 8,
    backgroundColor: '#F9FAFB',
    fontSize: 9,
  },
  tableCell: {
    flex: 1,
  },
  tableCellRight: {
    flex: 1,
    textAlign: 'right',
  },
  tableFooter: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    padding: 10,
    fontWeight: 'bold',
    fontSize: 10,
  },
  totalLabel: {
    flex: 5,
    textAlign: 'right',
    marginRight: 10,
  },
  totalAmount: {
    flex: 1,
    textAlign: 'right',
    color: '#3B82F6',
    fontSize: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 8,
    borderTop: '1px solid #E5E7EB',
    paddingTop: 10,
  },
  approvalTable: {
    marginTop: 10,
    border: '1px solid #ddd',
  },
  approvalHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottom: '1px solid #ddd',
  },
  approvalHeaderCell: {
    flex: 1,
    padding: 6,
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
    borderRight: '1px solid #ddd',
  },
  approvalRow: {
    flexDirection: 'row',
  },
  approvalCell: {
    flex: 1,
    padding: 6,
    fontSize: 8,
    textAlign: 'center',
    borderRight: '1px solid #ddd',
    borderBottom: '1px solid #ddd',
  },
  signatureImage: {
    width: 50,
    height: 25,
    objectFit: 'contain',
  },
});

interface PDFDocumentProps {
  expense: Expense;
  approvalLine?: ApprovalLine | null;
}

export const ExpensePDFDocument: React.FC<PDFDocumentProps> = ({ expense, approvalLine }) => {
  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString('ko-KR')}원`;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.title}>지출결의서</Text>
          <Text style={styles.subtitle}>
            작성일: {format(new Date(expense.createdAt), 'yyyy-MM-dd HH:mm')}
          </Text>
          <Text style={styles.subtitle}>문서번호: {expense.id}</Text>
        </View>

        {/* 예산 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>예산 정보</Text>
          <View style={styles.row}>
            <Text style={styles.label}>위원회:</Text>
            <Text style={styles.value}>{expense.committee}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>사역팀(부):</Text>
            <Text style={styles.value}>{expense.department}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>예산(항):</Text>
            <Text style={styles.value}>{expense.budgetCategory}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>예산(목):</Text>
            <Text style={styles.value}>{expense.budgetSubcategory}</Text>
          </View>
        </View>

        {/* 지출 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>지출 정보</Text>
          <View style={styles.row}>
            <Text style={styles.label}>지출일자:</Text>
            <Text style={styles.value}>
              {expense.expenseDate
                ? format(new Date(expense.expenseDate), 'yyyy-MM-dd')
                : '미정'}
            </Text>
          </View>
        </View>

        {/* 세부 항목 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>세부 항목</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={{ ...styles.tableCell, width: '8%' }}>순서</Text>
              <Text style={{ ...styles.tableCell, width: '20%' }}>예산(세목)</Text>
              <Text style={{ ...styles.tableCell, width: '25%' }}>적요</Text>
              <Text style={{ ...styles.tableCellRight, width: '15%' }}>단가</Text>
              <Text style={{ ...styles.tableCellRight, width: '12%' }}>수량</Text>
              <Text style={{ ...styles.tableCellRight, width: '20%' }}>금액</Text>
            </View>
            {expense.items.map((item, index) => (
              <View
                key={item.id}
                style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
              >
                <Text style={{ ...styles.tableCell, width: '8%' }}>{item.order}</Text>
                <Text style={{ ...styles.tableCell, width: '20%' }}>{item.budgetDetail}</Text>
                <Text style={{ ...styles.tableCell, width: '25%' }}>{item.description}</Text>
                <Text style={{ ...styles.tableCellRight, width: '15%' }}>
                  {item.unitPrice.toLocaleString()}
                </Text>
                <Text style={{ ...styles.tableCellRight, width: '12%' }}>{item.quantity}</Text>
                <Text style={{ ...styles.tableCellRight, width: '20%' }}>
                  {formatCurrency(item.amount)}
                </Text>
              </View>
            ))}
            <View style={styles.tableFooter}>
              <Text style={styles.totalLabel}>총 청구금액:</Text>
              <Text style={styles.totalAmount}>{formatCurrency(expense.requestAmount)}</Text>
            </View>
          </View>
        </View>

        {/* 신청 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>신청 정보</Text>
          <View style={styles.row}>
            <Text style={styles.label}>청구 일자:</Text>
            <Text style={styles.value}>
              {format(new Date(expense.requestDate), 'yyyy-MM-dd')}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>청구팀:</Text>
            <Text style={styles.value}>{expense.committee} {expense.department}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>청구인:</Text>
            <Text style={styles.value}>
              {expense.applicantName}
              {expense.applicantTitle && ` (${expense.applicantTitle})`}
            </Text>
          </View>
        </View>

        {/* 은행 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>은행 정보</Text>
          <View style={styles.row}>
            <Text style={styles.label}>은행명:</Text>
            <Text style={styles.value}>{expense.bankName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>계좌번호:</Text>
            <Text style={styles.value}>{expense.accountNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>예금주:</Text>
            <Text style={styles.value}>{expense.accountHolder}</Text>
          </View>
        </View>

        {/* 결재선 */}
        {approvalLine && approvalLine.steps.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>결재선</Text>
            <View style={styles.approvalTable}>
              {/* 헤더 - 직책 */}
              <View style={styles.approvalHeader}>
                {approvalLine.steps.map((step, index) => (
                  <Text key={`h1-${step.id}`} style={{
                    ...styles.approvalHeaderCell,
                    borderRight: index === approvalLine.steps.length - 1 ? 'none' : '1px solid #ddd',
                  }}>
                    {step.stepName}
                  </Text>
                ))}
              </View>
              {/* 서명/도장 */}
              <View style={styles.approvalRow}>
                {approvalLine.steps.map((step, index) => (
                  <View key={`sig-${step.id}`} style={{
                    ...styles.approvalCell,
                    height: 40,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRight: index === approvalLine.steps.length - 1 ? 'none' : '1px solid #ddd',
                  }}>
                    {step.status === 'APPROVED' && step.signatureData ? (
                      <Image src={step.signatureData} style={styles.signatureImage} />
                    ) : step.status === 'APPROVED' ? (
                      <Text style={{ fontSize: 8, color: '#10B981' }}>승인</Text>
                    ) : step.status === 'REJECTED' ? (
                      <Text style={{ fontSize: 8, color: '#EF4444' }}>반려</Text>
                    ) : (
                      <Text style={{ fontSize: 8, color: '#9CA3AF' }}>대기</Text>
                    )}
                  </View>
                ))}
              </View>
              {/* 결재자 이름 */}
              <View style={styles.approvalRow}>
                {approvalLine.steps.map((step, index) => (
                  <Text key={`name-${step.id}`} style={{
                    ...styles.approvalCell,
                    borderRight: index === approvalLine.steps.length - 1 ? 'none' : '1px solid #ddd',
                  }}>
                    {step.approverName}
                  </Text>
                ))}
              </View>
              {/* 결재 일시 */}
              <View style={styles.approvalRow}>
                {approvalLine.steps.map((step, index) => (
                  <Text key={`date-${step.id}`} style={{
                    ...styles.approvalCell,
                    fontSize: 7,
                    color: '#6B7280',
                    borderRight: index === approvalLine.steps.length - 1 ? 'none' : '1px solid #ddd',
                    borderBottom: 'none',
                  }}>
                    {step.approvedAt ? format(new Date(step.approvedAt), 'MM/dd HH:mm') : ''}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* 푸터 */}
        <View style={styles.footer}>
          <Text>이 문서는 지출결의서 관리 시스템에서 자동으로 생성되었습니다.</Text>
        </View>
      </Page>
    </Document>
  );
};

export default ExpensePDFDocument;
