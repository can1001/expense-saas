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

export async function generateExpenseExcel(expense: Expense) {
  const workbook = new ExcelJS.Workbook();

  // ===== 첫 번째 시트: 지출결의서 양식 =====
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
        header: 0.3,
        footer: 0.3,
      },
    },
    properties: {
      defaultRowHeight: 20,
    },
  });

  // 열 너비 설정
  sheet.columns = [
    { width: 3 },   // A
    { width: 12 },  // B
    { width: 5 },   // C
    { width: 15 },  // D
    { width: 12 },  // E
    { width: 10 },  // F
    { width: 3 },   // G
    { width: 10 },  // H
    { width: 10 },  // I
  ];

  // 로고/아이콘 영역 (A1:B3)
  const logoCell = sheet.getCell('A1');
  logoCell.value = '로고';
  sheet.mergeCells('A1:B3');
  logoCell.alignment = { vertical: 'middle', horizontal: 'center' };
  logoCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };
  logoCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // "사역팀(부)장" 라벨 (A4:B4)
  const deptLabelCell = sheet.getCell('A4');
  deptLabelCell.value = '사역팀(부)장';
  sheet.mergeCells('A4:B4');
  deptLabelCell.alignment = { vertical: 'middle', horizontal: 'center' };
  deptLabelCell.font = { size: 9 };
  deptLabelCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // 제목 "지  출  결  의  서" (C1:G1)
  const titleCell = sheet.getCell('C1');
  titleCell.value = '지  출  결  의  서';
  sheet.mergeCells('C1:G1');
  sheet.getRow(1).height = 30;
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.font = { size: 18, bold: true };
  titleCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // "재정팀장" 라벨 (H1:I1)
  const managerLabelCell = sheet.getCell('H1');
  managerLabelCell.value = '재정팀장';
  sheet.mergeCells('H1:I1');
  managerLabelCell.alignment = { vertical: 'middle', horizontal: 'center' };
  managerLabelCell.font = { size: 10 };
  managerLabelCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // 빈 셀 (C2:G2, H2:I2)
  sheet.mergeCells('C2:G2');
  const c2Cell = sheet.getCell('C2');
  c2Cell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  sheet.mergeCells('H2:I2');
  const h2Cell = sheet.getCell('H2');
  h2Cell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // "예산항목(계정과목)" 라벨 (C3:D3)
  const budgetLabelCell = sheet.getCell('C3');
  budgetLabelCell.value = '예산항목\n(계정과목)';
  sheet.mergeCells('C3:D3');
  budgetLabelCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  budgetLabelCell.font = { size: 9 };
  budgetLabelCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // 예산항목 값 (E3:G3)
  const budgetValueCell = sheet.getCell('E3');
  budgetValueCell.value = `${expense.budgetCategory} / ${expense.budgetSubcategory}`;
  sheet.mergeCells('E3:G3');
  budgetValueCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  budgetValueCell.font = { size: 10 };
  budgetValueCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // "신창국" (H3:I3)
  const nameCell1 = sheet.getCell('H3');
  nameCell1.value = expense.applicantName;
  sheet.mergeCells('H3:I3');
  nameCell1.alignment = { vertical: 'middle', horizontal: 'center' };
  nameCell1.font = { size: 10 };
  nameCell1.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // "지출일자" 라벨 (C4:D4)
  const dateLabelCell = sheet.getCell('C4');
  dateLabelCell.value = '지출일자';
  sheet.mergeCells('C4:D4');
  dateLabelCell.alignment = { vertical: 'middle', horizontal: 'center' };
  dateLabelCell.font = { size: 10 };
  dateLabelCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // 지출일자 값 (E4:F4)
  const expenseYear = expense.expenseDate
    ? format(new Date(expense.expenseDate), 'yyyy')
    : '2025';
  const expenseMonth = expense.expenseDate
    ? format(new Date(expense.expenseDate), 'M')
    : '';
  const expenseDay = expense.expenseDate
    ? format(new Date(expense.expenseDate), 'd')
    : '';

  const dateValueCell = sheet.getCell('E4');
  dateValueCell.value = `${expenseYear} 년        ${expenseMonth ? expenseMonth + ' 월' : '월'}        ${expenseDay ? expenseDay + ' 일' : '일'}`;
  sheet.mergeCells('E4:G4');
  dateValueCell.alignment = { vertical: 'middle', horizontal: 'center' };
  dateValueCell.font = { size: 10 };
  dateValueCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // "회  계" 라벨 (H4:I4)
  const accountLabelCell = sheet.getCell('H4');
  accountLabelCell.value = '회  계';
  sheet.mergeCells('H4:I4');
  accountLabelCell.alignment = { vertical: 'middle', horizontal: 'center' };
  accountLabelCell.font = { size: 10 };
  accountLabelCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // 빈 행 (5)
  sheet.mergeCells('A5:I5');
  const a5Cell = sheet.getCell('A5');
  a5Cell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // "청구금액" 라벨 (C6:D6)
  const amountLabelCell = sheet.getCell('C6');
  amountLabelCell.value = '청구금액';
  sheet.mergeCells('C6:D6');
  amountLabelCell.alignment = { vertical: 'middle', horizontal: 'center' };
  amountLabelCell.font = { size: 11, bold: true };
  amountLabelCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // 청구금액 값 (E6:G6)
  const amountValueCell = sheet.getCell('E6');
  amountValueCell.value = `\\ ${expense.requestAmount.toLocaleString('ko-KR')} 원`;
  sheet.mergeCells('E6:G6');
  amountValueCell.alignment = { vertical: 'middle', horizontal: 'center' };
  amountValueCell.font = { size: 14, bold: true };
  amountValueCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // 빈 셀 (H6:I6)
  sheet.mergeCells('H6:I6');
  const h6Cell = sheet.getCell('H6');
  h6Cell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // 빈 행 (7)
  sheet.mergeCells('A7:I7');
  const a7Cell = sheet.getCell('A7');
  a7Cell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // 예시 설명 (8)
  const exampleCell = sheet.getCell('A8');
  exampleCell.value = '※ 아래 예시 참조하여 【세목, 행사일자, 행사명과 내용, 단가, 인원(수량)】 등 자세하게 기록하여 주세요.';
  sheet.mergeCells('A8:I8');
  exampleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  exampleCell.font = { size: 9, color: { argb: 'FF0000FF' } };
  exampleCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // 예시 데이터 (9)
  const exampleDataCell = sheet.getCell('A9');
  exampleDataCell.value = '행사비(리더세미나)     2/8 유치부 교사 성경학교 준비 다과비            3,000     35     105,000';
  sheet.mergeCells('A9:I9');
  exampleDataCell.alignment = { vertical: 'middle', horizontal: 'left' };
  exampleDataCell.font = { size: 9, color: { argb: 'FF0000FF' } };
  exampleDataCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // 빈 행 (10)
  sheet.mergeCells('A10:I10');
  const a10Cell = sheet.getCell('A10');
  a10Cell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // 테이블 헤더 (11)
  const headers = ['세  목', '적  요', '단가', '인원\n(수량)', '금액'];
  const headerCells = ['B11', 'D11', 'F11', 'H11', 'I11'];
  const headerMerges = [
    ['B11', 'C11'],
    ['D11', 'E11'],
    ['F11', 'G11'],
    null,
    null,
  ];

  headers.forEach((header, index) => {
    const cellAddr = headerCells[index];
    const cell = sheet.getCell(cellAddr);
    cell.value = header;
    if (headerMerges[index]) {
      sheet.mergeCells(headerMerges[index][0], headerMerges[index][1]);
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.font = { size: 10, bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' },
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // A11 셀도 테두리 추가
  const a11Cell = sheet.getCell('A11');
  a11Cell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // 데이터 행 (12-21, 최대 10개)
  let currentRow = 12;
  const maxRows = 10;

  for (let i = 0; i < maxRows; i++) {
    const row = currentRow + i;
    const item = expense.items[i];

    if (item) {
      // 실제 데이터
      const budgetDetailCell = sheet.getCell(`B${row}`);
      budgetDetailCell.value = item.budgetDetail;
      sheet.mergeCells(`B${row}:C${row}`);
      budgetDetailCell.alignment = { vertical: 'middle', horizontal: 'left' };
      budgetDetailCell.font = { size: 9 };
      budgetDetailCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };

      const descCell = sheet.getCell(`D${row}`);
      descCell.value = item.description;
      sheet.mergeCells(`D${row}:E${row}`);
      descCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      descCell.font = { size: 9 };
      descCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };

      const priceCell = sheet.getCell(`F${row}`);
      priceCell.value = item.unitPrice;
      sheet.mergeCells(`F${row}:G${row}`);
      priceCell.alignment = { vertical: 'middle', horizontal: 'right' };
      priceCell.font = { size: 9 };
      priceCell.numFmt = '#,##0';
      priceCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };

      const qtyCell = sheet.getCell(`H${row}`);
      qtyCell.value = item.quantity;
      qtyCell.alignment = { vertical: 'middle', horizontal: 'right' };
      qtyCell.font = { size: 9 };
      qtyCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };

      const amtCell = sheet.getCell(`I${row}`);
      amtCell.value = item.amount;
      amtCell.alignment = { vertical: 'middle', horizontal: 'right' };
      amtCell.font = { size: 9 };
      amtCell.numFmt = '#,##0';
      amtCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    } else {
      // 빈 행
      const cells = ['B', 'D', 'F', 'H', 'I'];
      const merges = [
        [`B${row}`, `C${row}`],
        [`D${row}`, `E${row}`],
        [`F${row}`, `G${row}`],
        null,
        null,
      ];

      cells.forEach((col, idx) => {
        const cell = sheet.getCell(`${col}${row}`);
        cell.value = '0';
        if (merges[idx]) {
          sheet.mergeCells(merges[idx][0], merges[idx][1]);
        }
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = { size: 9 };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    }

    // A열 테두리
    const aCell = sheet.getCell(`A${row}`);
    aCell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  }

  // 빈 행 (22)
  sheet.mergeCells('A22:I22');
  const a22Cell = sheet.getCell('A22');
  a22Cell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // 합계 행 (23)
  const totalLabelCell = sheet.getCell('F23');
  totalLabelCell.value = '합  계';
  sheet.mergeCells('F23:H23');
  totalLabelCell.alignment = { vertical: 'middle', horizontal: 'center' };
  totalLabelCell.font = { size: 11, bold: true };
  totalLabelCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9D9D9' },
  };
  totalLabelCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  const totalValueCell = sheet.getCell('I23');
  totalValueCell.value = expense.requestAmount;
  totalValueCell.alignment = { vertical: 'middle', horizontal: 'right' };
  totalValueCell.font = { size: 11, bold: true };
  totalValueCell.numFmt = '#,##0';
  totalValueCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // A23-E23 테두리
  for (let col of ['A', 'B', 'C', 'D', 'E']) {
    const cell = sheet.getCell(`${col}23`);
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  }

  // 빈 행 (24)
  sheet.mergeCells('A24:I24');
  const a24Cell = sheet.getCell('A24');
  a24Cell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // "청구내역" 섹션 (25)
  const claimHeaderCell = sheet.getCell('A25');
  claimHeaderCell.value = '청구내역';
  claimHeaderCell.font = { size: 10, bold: true };
  claimHeaderCell.alignment = { vertical: 'middle', horizontal: 'left' };

  // 청구 일자 (26)
  const requestYear = format(new Date(expense.requestDate), 'yyyy');
  const requestMonth = format(new Date(expense.requestDate), 'M');
  const requestDay = format(new Date(expense.requestDate), 'd');

  const claimDateCell = sheet.getCell('A26');
  claimDateCell.value = `○ 청구 일자 :    ${requestYear} 년         ${requestMonth} 월         ${requestDay} 일             (재정팀) 출납필   (인)`;
  sheet.mergeCells('A26:I26');
  claimDateCell.alignment = { vertical: 'middle', horizontal: 'left' };
  claimDateCell.font = { size: 9 };

  // 청구팀/청구인 (27)
  const claimTeamCell = sheet.getCell('A27');
  claimTeamCell.value = `○ 청구팀(부) :    ${expense.committee}    ${expense.department}    ○ 청구인 :    ${expense.applicantName}        (인)`;
  sheet.mergeCells('A27:I27');
  claimTeamCell.alignment = { vertical: 'middle', horizontal: 'left' };
  claimTeamCell.font = { size: 9 };

  // 은행 정보 (28)
  const bankCell = sheet.getCell('A28');
  bankCell.value = ` ○    ${expense.bankName}     ○ 계좌번호 :    ${expense.accountNumber}        ○ 예금주 :        ${expense.accountHolder}`;
  sheet.mergeCells('A28:I28');
  bankCell.alignment = { vertical: 'middle', horizontal: 'left' };
  bankCell.font = { size: 9 };

  // 빈 행 (29)
  sheet.getRow(29).height = 15;

  // 버전 정보 (30)
  const versionCell = sheet.getCell('H30');
  versionCell.value = '지출결의서 Ver.4.1.3';
  sheet.mergeCells('H30:I30');
  versionCell.alignment = { vertical: 'middle', horizontal: 'right' };
  versionCell.font = { size: 8 };

  // "영수증" 라벨 (31)
  const receiptLabelCell = sheet.getCell('A31');
  receiptLabelCell.value = '영수증';
  receiptLabelCell.font = { size: 10, bold: true };
  receiptLabelCell.alignment = { vertical: 'middle', horizontal: 'left' };

  // ===== 두 번째 시트 이후: 영수증 이미지 (2x2 배치) =====
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
