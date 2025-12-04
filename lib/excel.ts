import ExcelJS from 'exceljs';
import { format } from 'date-fns';

interface ExpenseItem {
  id: string;
  budgetDetail: string;
  description: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  order: number;
}

interface ExpenseAttachment {
  id: string;
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
}

interface Expense {
  id: string;
  committee: string;
  department: string;
  budgetCategory: string;
  budgetSubcategory: string;
  expenseDate?: string;
  requestAmount: number;
  requestDate: string;
  requestTeam: string;
  applicantName: string;
  applicantTitle?: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  items: ExpenseItem[];
  attachments?: ExpenseAttachment[];
  createdAt: string;
  updatedAt: string;
}

// 이미지를 다운로드하여 ArrayBuffer로 변환하는 헬퍼 함수
async function fetchImageAsBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  return await response.arrayBuffer();
}

// 테두리 스타일
const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

export async function generateExpenseExcel(expense: Expense) {
  const workbook = new ExcelJS.Workbook();

  // ===== 첫 번째 페이지: 지출결의서 양식 =====
  const sheet = workbook.addWorksheet('지출결의서', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.5,
        right: 0.5,
        top: 0.5,
        bottom: 0.5,
      },
    },
  });

  // 열 너비 설정 (A~I, 9열)
  sheet.columns = [
    { width: 4 },   // A
    { width: 7 },   // B
    { width: 7 },   // C
    { width: 13 },  // D
    { width: 26 },  // E
    { width: 10 },  // F
    { width: 7 },   // G
    { width: 9 },   // H
    { width: 11 },  // I
  ];

  let row = 1;

  // ===== 행 1-3: 헤더 영역 =====

  // A1:B3 - 로고 영역 (3개 원 아이콘)
  sheet.mergeCells('A1:B3');
  const logoCell = sheet.getCell('A1');
  logoCell.value = '';
  logoCell.alignment = { vertical: 'middle', horizontal: 'center' };
  logoCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF5B9BD5' }, // 파란색 배경
  };
  logoCell.border = thinBorder;

  // C1:G1 - 제목 "지 출 결 의 서"
  sheet.mergeCells('C1:G1');
  const titleCell = sheet.getCell('C1');
  titleCell.value = '지  출  결  의  서';
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.font = { size: 18, bold: true };
  titleCell.border = thinBorder;
  sheet.getRow(1).height = 25;

  // H1:I1 - "재정팀장"
  sheet.mergeCells('H1:I1');
  const managerLabelCell = sheet.getCell('H1');
  managerLabelCell.value = '재정팀장';
  managerLabelCell.alignment = { vertical: 'middle', horizontal: 'center' };
  managerLabelCell.font = { size: 10 };
  managerLabelCell.border = thinBorder;

  // 행 2
  sheet.mergeCells('C2:G2');
  const c2Cell = sheet.getCell('C2');
  c2Cell.border = thinBorder;

  sheet.mergeCells('H2:I2');
  const h2Cell = sheet.getCell('H2');
  h2Cell.border = thinBorder;

  // 행 3
  // C3:D3 - "예산항목(계정과목)"
  sheet.mergeCells('C3:D3');
  const budgetLabelCell = sheet.getCell('C3');
  budgetLabelCell.value = '예산항목\n(계정과목)';
  budgetLabelCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  budgetLabelCell.font = { size: 9 };
  budgetLabelCell.border = thinBorder;

  // E3:G3 - 예산항목 값
  sheet.mergeCells('E3:G3');
  const budgetValueCell = sheet.getCell('E3');
  budgetValueCell.value = `${expense.budgetCategory} / ${expense.budgetSubcategory}`;
  budgetValueCell.alignment = { vertical: 'middle', horizontal: 'left' };
  budgetValueCell.font = { size: 9 };
  budgetValueCell.border = thinBorder;

  // H3:I3 - 신창국
  sheet.mergeCells('H3:I3');
  const nameCell = sheet.getCell('H3');
  nameCell.value = '';
  nameCell.alignment = { vertical: 'middle', horizontal: 'center' };
  nameCell.border = thinBorder;

  row = 4;

  // ===== 행 4: 사역팀/지출일자/회계 =====

  // A4:B4 - "사역팀(부)장"
  sheet.mergeCells('A4:B4');
  const deptLabelCell = sheet.getCell('A4');
  deptLabelCell.value = '사역팀(부)장';
  deptLabelCell.alignment = { vertical: 'middle', horizontal: 'center' };
  deptLabelCell.font = { size: 9 };
  deptLabelCell.border = thinBorder;

  // C4:D4 - "지출일자"
  sheet.mergeCells('C4:D4');
  const dateLabelCell = sheet.getCell('C4');
  dateLabelCell.value = '지출일자';
  dateLabelCell.alignment = { vertical: 'middle', horizontal: 'center' };
  dateLabelCell.font = { size: 10 };
  dateLabelCell.border = thinBorder;

  // E4:G4 - 지출일자 값
  sheet.mergeCells('E4:G4');
  const dateValueCell = sheet.getCell('E4');
  const expenseYear = expense.expenseDate ? format(new Date(expense.expenseDate), 'yyyy') : '2025';
  const expenseMonth = expense.expenseDate ? format(new Date(expense.expenseDate), 'M') : '';
  const expenseDay = expense.expenseDate ? format(new Date(expense.expenseDate), 'd') : '';
  dateValueCell.value = `${expenseYear} 년        ${expenseMonth ? expenseMonth + ' 월' : '월'}        ${expenseDay ? expenseDay + ' 일' : '일'}`;
  dateValueCell.alignment = { vertical: 'middle', horizontal: 'center' };
  dateValueCell.font = { size: 10 };
  dateValueCell.border = thinBorder;

  // H4:I4 - "회  계"
  sheet.mergeCells('H4:I4');
  const accountLabelCell = sheet.getCell('H4');
  accountLabelCell.value = '회  계';
  accountLabelCell.alignment = { vertical: 'middle', horizontal: 'center' };
  accountLabelCell.font = { size: 10 };
  accountLabelCell.border = thinBorder;

  row = 5;

  // ===== 행 5: 빈 행 =====
  sheet.mergeCells('A5:I5');
  const a5Cell = sheet.getCell('A5');
  a5Cell.border = thinBorder;

  row = 6;

  // ===== 행 6: 청구금액 =====

  // C6:D6 - "청구금액"
  sheet.mergeCells('C6:D6');
  const amountLabelCell = sheet.getCell('C6');
  amountLabelCell.value = '청구금액';
  amountLabelCell.alignment = { vertical: 'middle', horizontal: 'center' };
  amountLabelCell.font = { size: 11, bold: true };
  amountLabelCell.border = thinBorder;

  // E6:G6 - 청구금액 값
  sheet.mergeCells('E6:G6');
  const amountValueCell = sheet.getCell('E6');
  amountValueCell.value = `\\ ${expense.requestAmount.toLocaleString('ko-KR')} 원`;
  amountValueCell.alignment = { vertical: 'middle', horizontal: 'center' };
  amountValueCell.font = { size: 14, bold: true };
  amountValueCell.border = thinBorder;
  sheet.getRow(6).height = 25;

  // H6:I6
  sheet.mergeCells('H6:I6');
  const h6Cell = sheet.getCell('H6');
  h6Cell.border = thinBorder;

  row = 7;

  // ===== 행 7: 빈 행 =====
  sheet.mergeCells('A7:I7');
  const a7Cell = sheet.getCell('A7');
  a7Cell.border = thinBorder;

  row = 8;

  // ===== 행 8: 예시 설명 =====
  sheet.mergeCells('A8:I8');
  const exampleCell = sheet.getCell('A8');
  exampleCell.value = '※ 아래 예시 참조하여 【세목, 행사일자, 행사명과 내용, 단가, 인원(수량)】 등 자세하게 기록하여 주세요.';
  exampleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  exampleCell.font = { size: 8, color: { argb: 'FF0000FF' } };
  exampleCell.border = thinBorder;

  row = 9;

  // ===== 행 9: 예시 데이터 =====
  sheet.mergeCells('A9:I9');
  const exampleDataCell = sheet.getCell('A9');
  exampleDataCell.value = '행사비(리더세미나)     2/8 유치부 교사 성경학교 준비 다과비            3,000     35     105,000';
  exampleDataCell.alignment = { vertical: 'middle', horizontal: 'left' };
  exampleDataCell.font = { size: 8, color: { argb: 'FF0000FF' } };
  exampleDataCell.border = thinBorder;

  row = 10;

  // ===== 행 10: 빈 행 =====
  sheet.mergeCells('A10:I10');
  const a10Cell = sheet.getCell('A10');
  a10Cell.border = thinBorder;

  row = 11;

  // ===== 행 11: 테이블 헤더 =====

  // A11 빈 셀
  const a11Cell = sheet.getCell('A11');
  a11Cell.border = thinBorder;

  // B11:C11 - "세 목"
  sheet.mergeCells('B11:C11');
  const h1Cell = sheet.getCell('B11');
  h1Cell.value = '세  목';
  h1Cell.alignment = { vertical: 'middle', horizontal: 'center' };
  h1Cell.font = { bold: true, size: 10 };
  h1Cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9D9D9' },
  };
  h1Cell.border = thinBorder;

  // D11:E11 - "적 요"
  sheet.mergeCells('D11:E11');
  const h2CellValue = sheet.getCell('D11');
  h2CellValue.value = '적  요';
  h2CellValue.alignment = { vertical: 'middle', horizontal: 'center' };
  h2CellValue.font = { bold: true, size: 10 };
  h2CellValue.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9D9D9' },
  };
  h2CellValue.border = thinBorder;

  // F11:G11 - "단가"
  sheet.mergeCells('F11:G11');
  const h3Cell = sheet.getCell('F11');
  h3Cell.value = '단가';
  h3Cell.alignment = { vertical: 'middle', horizontal: 'center' };
  h3Cell.font = { bold: true, size: 10 };
  h3Cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9D9D9' },
  };
  h3Cell.border = thinBorder;

  // H11 - "인원(수량)"
  const h4Cell = sheet.getCell('H11');
  h4Cell.value = '인원\n(수량)';
  h4Cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  h4Cell.font = { bold: true, size: 9 };
  h4Cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9D9D9' },
  };
  h4Cell.border = thinBorder;

  // I11 - "금액"
  const h5Cell = sheet.getCell('I11');
  h5Cell.value = '금액';
  h5Cell.alignment = { vertical: 'middle', horizontal: 'center' };
  h5Cell.font = { bold: true, size: 10 };
  h5Cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9D9D9' },
  };
  h5Cell.border = thinBorder;

  row = 12;

  // ===== 행 12-21: 데이터 행 (10개) =====
  for (let i = 0; i < 10; i++) {
    const currentRowNum = row + i;
    const item = expense.items[i];

    // A열 빈 셀
    const aCell = sheet.getCell(`A${currentRowNum}`);
    aCell.border = thinBorder;

    if (item) {
      // B:C - 예산(세목)
      sheet.mergeCells(`B${currentRowNum}:C${currentRowNum}`);
      const budgetCell = sheet.getCell(`B${currentRowNum}`);
      budgetCell.value = item.budgetDetail;
      budgetCell.alignment = { vertical: 'middle', horizontal: 'left' };
      budgetCell.font = { size: 9 };
      budgetCell.border = thinBorder;

      // D:E - 적요
      sheet.mergeCells(`D${currentRowNum}:E${currentRowNum}`);
      const descCell = sheet.getCell(`D${currentRowNum}`);
      descCell.value = item.description;
      descCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      descCell.font = { size: 9 };
      descCell.border = thinBorder;

      // F:G - 단가
      sheet.mergeCells(`F${currentRowNum}:G${currentRowNum}`);
      const priceCell = sheet.getCell(`F${currentRowNum}`);
      priceCell.value = item.unitPrice;
      priceCell.numFmt = '#,##0';
      priceCell.alignment = { vertical: 'middle', horizontal: 'right' };
      priceCell.font = { size: 9 };
      priceCell.border = thinBorder;

      // H - 수량
      const qtyCell = sheet.getCell(`H${currentRowNum}`);
      qtyCell.value = item.quantity;
      qtyCell.alignment = { vertical: 'middle', horizontal: 'right' };
      qtyCell.font = { size: 9 };
      qtyCell.border = thinBorder;

      // I - 금액
      const amtCell = sheet.getCell(`I${currentRowNum}`);
      amtCell.value = item.amount;
      amtCell.numFmt = '#,##0';
      amtCell.alignment = { vertical: 'middle', horizontal: 'right' };
      amtCell.font = { size: 9 };
      amtCell.border = thinBorder;
    } else {
      // 빈 행 - "0" 표시
      sheet.mergeCells(`B${currentRowNum}:C${currentRowNum}`);
      const b = sheet.getCell(`B${currentRowNum}`);
      b.value = '0';
      b.alignment = { vertical: 'middle', horizontal: 'center' };
      b.font = { size: 9 };
      b.border = thinBorder;

      sheet.mergeCells(`D${currentRowNum}:E${currentRowNum}`);
      const d = sheet.getCell(`D${currentRowNum}`);
      d.border = thinBorder;

      sheet.mergeCells(`F${currentRowNum}:G${currentRowNum}`);
      const f = sheet.getCell(`F${currentRowNum}`);
      f.border = thinBorder;

      const h = sheet.getCell(`H${currentRowNum}`);
      h.border = thinBorder;

      const iCell = sheet.getCell(`I${currentRowNum}`);
      iCell.value = '0';
      iCell.alignment = { vertical: 'middle', horizontal: 'right' };
      iCell.font = { size: 9 };
      iCell.border = thinBorder;
    }
  }

  row = 22;

  // ===== 행 22: 빈 행 =====
  sheet.mergeCells('A22:I22');
  const a22Cell = sheet.getCell('A22');
  a22Cell.border = thinBorder;

  row = 23;

  // ===== 행 23: 합계 =====

  // A23:E23 빈 셀
  for (let col of ['A', 'B', 'C', 'D', 'E']) {
    const cell = sheet.getCell(`${col}23`);
    cell.border = thinBorder;
  }

  // F23:H23 - "합 계"
  sheet.mergeCells('F23:H23');
  const totalLabelCell = sheet.getCell('F23');
  totalLabelCell.value = '합  계';
  totalLabelCell.alignment = { vertical: 'middle', horizontal: 'center' };
  totalLabelCell.font = { size: 12, bold: true };
  totalLabelCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9D9D9' },
  };
  totalLabelCell.border = thinBorder;

  // I23 - 합계 값
  const totalValueCell = sheet.getCell('I23');
  totalValueCell.value = expense.requestAmount;
  totalValueCell.numFmt = '#,##0';
  totalValueCell.alignment = { vertical: 'middle', horizontal: 'right' };
  totalValueCell.font = { size: 12, bold: true };
  totalValueCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9D9D9' },
  };
  totalValueCell.border = thinBorder;

  row = 24;

  // ===== 행 24: 빈 행 =====
  sheet.mergeCells('A24:I24');
  const a24Cell = sheet.getCell('A24');
  a24Cell.border = thinBorder;

  row = 25;

  // ===== 행 25-28: 청구내역 =====

  // 청구내역 헤더
  const claimHeaderCell = sheet.getCell('A25');
  claimHeaderCell.value = '청구내역';
  claimHeaderCell.font = { bold: true, size: 10 };

  row = 26;

  // 청구 일자
  const requestYear = format(new Date(expense.requestDate), 'yyyy');
  const requestMonth = format(new Date(expense.requestDate), 'M');
  const requestDay = format(new Date(expense.requestDate), 'd');

  sheet.mergeCells('A26:I26');
  const dateRow = sheet.getCell('A26');
  dateRow.value = `○ 청구 일자 :    ${requestYear} 년         ${requestMonth} 월         ${requestDay} 일             (재정팀) 출납필   (인)`;
  dateRow.alignment = { vertical: 'middle', horizontal: 'left' };
  dateRow.font = { size: 9 };

  row = 27;

  // 청구팀/청구인
  sheet.mergeCells('A27:I27');
  const teamRow = sheet.getCell('A27');
  teamRow.value = `○ 청구팀(부) :    ${expense.committee}    ${expense.department}    ○ 청구인 :    ${expense.applicantName}        (인)`;
  teamRow.alignment = { vertical: 'middle', horizontal: 'left' };
  teamRow.font = { size: 9 };

  row = 28;

  // 은행 정보
  sheet.mergeCells('A28:I28');
  const bankRow = sheet.getCell('A28');
  bankRow.value = ` ○    ${expense.bankName}     ○ 계좌번호 :    ${expense.accountNumber}        ○ 예금주 :        ${expense.accountHolder}`;
  bankRow.alignment = { vertical: 'middle', horizontal: 'left' };
  bankRow.font = { size: 9 };

  row = 29;

  // 빈 행
  sheet.getRow(29).height = 10;

  row = 30;

  // 버전 정보
  sheet.mergeCells('H30:I30');
  const versionCell = sheet.getCell('H30');
  versionCell.value = '지출결의서 Ver.4.1.3';
  versionCell.alignment = { vertical: 'middle', horizontal: 'right' };
  versionCell.font = { size: 8, color: { argb: 'FF808080' } };

  row = 31;

  // 영수증 라벨
  const receiptLabelCell = sheet.getCell('A31');
  receiptLabelCell.value = '영수증';
  receiptLabelCell.font = { bold: true, size: 10 };

  // ===== 두 번째 페이지 이후: 영수증 이미지 (2x2 배치) =====
  if (expense.attachments && expense.attachments.length > 0) {
    const imagesPerPage = 4;
    const totalPages = Math.ceil(expense.attachments.length / imagesPerPage);

    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      const startIndex = pageIndex * imagesPerPage;
      const endIndex = Math.min(startIndex + imagesPerPage, expense.attachments.length);
      const pageAttachments = expense.attachments.slice(startIndex, endIndex);

      const imageSheet = workbook.addWorksheet(`영수증 ${pageIndex + 1}`, {
        pageSetup: {
          paperSize: 9, // A4
          orientation: 'portrait',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 1,
          margins: {
            left: 0.5,
            right: 0.5,
            top: 0.5,
            bottom: 0.5,
          },
        },
      });

      // A4 용지 크기
      const a4WidthMM = 210;
      const a4HeightMM = 297;
      const marginMM = 10;
      const usableWidthMM = a4WidthMM - (marginMM * 2);
      const usableHeightMM = a4HeightMM - (marginMM * 2);

      // 2x2 그리드
      const imageWidthMM = usableWidthMM / 2;
      const imageHeightMM = usableHeightMM / 2;

      const mmToPoints = 2.83465;
      const imageWidthPoints = imageWidthMM * mmToPoints;
      const imageHeightPoints = imageHeightMM * mmToPoints;

      // 열 너비 설정
      const colWidthPoints = imageWidthPoints + 10;
      imageSheet.getColumn(1).width = colWidthPoints / 7;
      imageSheet.getColumn(2).width = colWidthPoints / 7;

      for (let i = 0; i < pageAttachments.length; i++) {
        const attachment = pageAttachments[i];
        const gridRow = Math.floor(i / 2);
        const gridCol = i % 2;

        try {
          const imageBuffer = await fetchImageAsBuffer(attachment.secureUrl);

          let extension: 'jpeg' | 'png' | 'gif' = 'png';
          if (attachment.format) {
            const fmt = attachment.format.toLowerCase();
            if (fmt === 'jpg' || fmt === 'jpeg') {
              extension = 'jpeg';
            } else if (fmt === 'png') {
              extension = 'png';
            } else if (fmt === 'gif') {
              extension = 'gif';
            }
          }

          const imageId = workbook.addImage({
            buffer: imageBuffer,
            extension: extension,
          });

          const startCol = gridCol;
          const startRow = gridRow * 20;

          imageSheet.addImage(imageId, {
            tl: { col: startCol, row: startRow },
            ext: { width: imageWidthPoints, height: imageHeightPoints },
          });

          // 파일명 표시
          const fileNameRow = startRow + Math.ceil(imageHeightPoints / 20) + 1;
          const fileNameCell = imageSheet.getCell(fileNameRow, startCol + 1);
          fileNameCell.value = attachment.fileName;
          fileNameCell.font = { size: 9 };
          fileNameCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        } catch (error) {
          console.error(`Failed to add image ${attachment.fileName}:`, error);
          const startCol = gridCol;
          const startRow = gridRow * 20;
          const errorCell = imageSheet.getCell(startRow + 1, startCol + 1);
          errorCell.value = `[이미지 로드 실패] ${attachment.fileName}`;
          errorCell.font = { size: 9, color: { argb: 'FFFF0000' } };
        }
      }
    }
  }

  // 파일 다운로드
  const fileName = `지출결의서_${expense.applicantName}_${format(new Date(expense.requestDate), 'yyyyMMdd')}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
