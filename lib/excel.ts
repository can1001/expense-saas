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
      },
    },
  });

  // 열 너비 설정
  sheet.columns = [
    { width: 15 },  // A
    { width: 20 },  // B
    { width: 35 },  // C
    { width: 15 },  // D
    { width: 10 },  // E
    { width: 15 },  // F
  ];

  let currentRow = 1;

  // 제목
  sheet.mergeCells(`A${currentRow}:F${currentRow}`);
  const titleCell = sheet.getCell(`A${currentRow}`);
  titleCell.value = '지  출  결  의  서';
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.font = { size: 18, bold: true };
  sheet.getRow(currentRow).height = 35;
  currentRow++;

  // 빈 행
  currentRow++;

  // 예산 정보 헤더
  sheet.mergeCells(`A${currentRow}:F${currentRow}`);
  const budgetHeaderCell = sheet.getCell(`A${currentRow}`);
  budgetHeaderCell.value = '■ 예산 정보';
  budgetHeaderCell.font = { size: 12, bold: true };
  budgetHeaderCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };
  currentRow++;

  // 위원회
  sheet.getCell(`A${currentRow}`).value = '위원회';
  sheet.getCell(`A${currentRow}`).font = { bold: true };
  sheet.mergeCells(`B${currentRow}:F${currentRow}`);
  sheet.getCell(`B${currentRow}`).value = expense.committee;
  currentRow++;

  // 사역팀(부)
  sheet.getCell(`A${currentRow}`).value = '사역팀(부)';
  sheet.getCell(`A${currentRow}`).font = { bold: true };
  sheet.mergeCells(`B${currentRow}:F${currentRow}`);
  sheet.getCell(`B${currentRow}`).value = expense.department;
  currentRow++;

  // 예산(항)
  sheet.getCell(`A${currentRow}`).value = '예산(항)';
  sheet.getCell(`A${currentRow}`).font = { bold: true };
  sheet.mergeCells(`B${currentRow}:F${currentRow}`);
  sheet.getCell(`B${currentRow}`).value = expense.budgetCategory;
  currentRow++;

  // 예산(목)
  sheet.getCell(`A${currentRow}`).value = '예산(목)';
  sheet.getCell(`A${currentRow}`).font = { bold: true };
  sheet.mergeCells(`B${currentRow}:F${currentRow}`);
  sheet.getCell(`B${currentRow}`).value = expense.budgetSubcategory;
  currentRow++;

  // 빈 행
  currentRow++;

  // 지출 정보 헤더
  sheet.mergeCells(`A${currentRow}:F${currentRow}`);
  const expenseHeaderCell = sheet.getCell(`A${currentRow}`);
  expenseHeaderCell.value = '■ 지출 정보';
  expenseHeaderCell.font = { size: 12, bold: true };
  expenseHeaderCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };
  currentRow++;

  // 지출일자
  sheet.getCell(`A${currentRow}`).value = '지출일자';
  sheet.getCell(`A${currentRow}`).font = { bold: true };
  sheet.mergeCells(`B${currentRow}:F${currentRow}`);
  sheet.getCell(`B${currentRow}`).value = expense.expenseDate
    ? format(new Date(expense.expenseDate), 'yyyy년 MM월 dd일')
    : '미정';
  currentRow++;

  // 청구금액
  sheet.getCell(`A${currentRow}`).value = '청구금액';
  sheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 };
  sheet.mergeCells(`B${currentRow}:F${currentRow}`);
  const amountCell = sheet.getCell(`B${currentRow}`);
  amountCell.value = expense.requestAmount;
  amountCell.numFmt = '\\ #,##0 "원"';
  amountCell.font = { bold: true, size: 14 };
  sheet.getRow(currentRow).height = 25;
  currentRow++;

  // 빈 행
  currentRow++;

  // 세부 항목 헤더
  sheet.mergeCells(`A${currentRow}:F${currentRow}`);
  const itemsHeaderCell = sheet.getCell(`A${currentRow}`);
  itemsHeaderCell.value = '■ 세부 항목';
  itemsHeaderCell.font = { size: 12, bold: true };
  itemsHeaderCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };
  currentRow++;

  // 테이블 헤더
  const headers = ['순서', '예산(세목)', '적요', '단가', '수량', '금액'];
  const headerRow = sheet.getRow(currentRow);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' },
    };
    cell.border = thinBorder;
  });
  currentRow++;

  // 데이터 행 (최대 10개)
  for (let i = 0; i < 10; i++) {
    const item = expense.items[i];
    const row = sheet.getRow(currentRow);

    if (item) {
      row.getCell(1).value = item.order;
      row.getCell(1).alignment = { horizontal: 'center' };

      row.getCell(2).value = item.budgetDetail;

      row.getCell(3).value = item.description;
      row.getCell(3).alignment = { wrapText: true };

      row.getCell(4).value = item.unitPrice;
      row.getCell(4).numFmt = '#,##0';
      row.getCell(4).alignment = { horizontal: 'right' };

      row.getCell(5).value = item.quantity;
      row.getCell(5).alignment = { horizontal: 'right' };

      row.getCell(6).value = item.amount;
      row.getCell(6).numFmt = '#,##0';
      row.getCell(6).alignment = { horizontal: 'right' };
    } else {
      // 빈 행
      for (let j = 1; j <= 6; j++) {
        row.getCell(j).value = '';
      }
    }

    // 테두리 적용
    for (let j = 1; j <= 6; j++) {
      row.getCell(j).border = thinBorder;
    }

    currentRow++;
  }

  // 합계 행
  const totalRow = sheet.getRow(currentRow);
  sheet.mergeCells(`A${currentRow}:E${currentRow}`);
  totalRow.getCell(1).value = '합  계';
  totalRow.getCell(1).font = { bold: true, size: 12 };
  totalRow.getCell(1).alignment = { horizontal: 'center' };
  totalRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9D9D9' },
  };

  totalRow.getCell(6).value = expense.requestAmount;
  totalRow.getCell(6).numFmt = '#,##0';
  totalRow.getCell(6).font = { bold: true, size: 12 };
  totalRow.getCell(6).alignment = { horizontal: 'right' };
  totalRow.getCell(6).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9D9D9' },
  };

  for (let j = 1; j <= 6; j++) {
    totalRow.getCell(j).border = thinBorder;
  }
  currentRow++;

  // 빈 행
  currentRow++;

  // 신청 정보 헤더
  sheet.mergeCells(`A${currentRow}:F${currentRow}`);
  const applicantHeaderCell = sheet.getCell(`A${currentRow}`);
  applicantHeaderCell.value = '■ 신청 정보';
  applicantHeaderCell.font = { size: 12, bold: true };
  applicantHeaderCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };
  currentRow++;

  // 청구일자
  sheet.getCell(`A${currentRow}`).value = '청구일자';
  sheet.getCell(`A${currentRow}`).font = { bold: true };
  sheet.mergeCells(`B${currentRow}:F${currentRow}`);
  sheet.getCell(`B${currentRow}`).value = format(new Date(expense.requestDate), 'yyyy년 MM월 dd일');
  currentRow++;

  // 청구팀
  sheet.getCell(`A${currentRow}`).value = '청구팀';
  sheet.getCell(`A${currentRow}`).font = { bold: true };
  sheet.mergeCells(`B${currentRow}:F${currentRow}`);
  sheet.getCell(`B${currentRow}`).value = expense.requestTeam;
  currentRow++;

  // 청구인
  sheet.getCell(`A${currentRow}`).value = '청구인';
  sheet.getCell(`A${currentRow}`).font = { bold: true };
  sheet.mergeCells(`B${currentRow}:F${currentRow}`);
  sheet.getCell(`B${currentRow}`).value = expense.applicantName;
  currentRow++;

  // 직책
  if (expense.applicantTitle) {
    sheet.getCell(`A${currentRow}`).value = '직책';
    sheet.getCell(`A${currentRow}`).font = { bold: true };
    sheet.mergeCells(`B${currentRow}:F${currentRow}`);
    sheet.getCell(`B${currentRow}`).value = expense.applicantTitle;
    currentRow++;
  }

  // 빈 행
  currentRow++;

  // 은행 정보 헤더
  sheet.mergeCells(`A${currentRow}:F${currentRow}`);
  const bankHeaderCell = sheet.getCell(`A${currentRow}`);
  bankHeaderCell.value = '■ 은행 정보';
  bankHeaderCell.font = { size: 12, bold: true };
  bankHeaderCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };
  currentRow++;

  // 은행명
  sheet.getCell(`A${currentRow}`).value = '은행명';
  sheet.getCell(`A${currentRow}`).font = { bold: true };
  sheet.mergeCells(`B${currentRow}:F${currentRow}`);
  sheet.getCell(`B${currentRow}`).value = expense.bankName;
  currentRow++;

  // 계좌번호
  sheet.getCell(`A${currentRow}`).value = '계좌번호';
  sheet.getCell(`A${currentRow}`).font = { bold: true };
  sheet.mergeCells(`B${currentRow}:F${currentRow}`);
  sheet.getCell(`B${currentRow}`).value = expense.accountNumber;
  currentRow++;

  // 예금주
  sheet.getCell(`A${currentRow}`).value = '예금주';
  sheet.getCell(`A${currentRow}`).font = { bold: true };
  sheet.mergeCells(`B${currentRow}:F${currentRow}`);
  sheet.getCell(`B${currentRow}`).value = expense.accountHolder;
  currentRow++;

  // 첨부파일 섹션 (이미지 썸네일 포함)
  if (expense.attachments && expense.attachments.length > 0) {
    // 빈 행
    currentRow++;

    // 첨부파일 헤더
    sheet.mergeCells(`A${currentRow}:F${currentRow}`);
    const attachmentHeaderCell = sheet.getCell(`A${currentRow}`);
    attachmentHeaderCell.value = '■ 첨부파일';
    attachmentHeaderCell.font = { size: 12, bold: true };
    attachmentHeaderCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    currentRow++;

    // 첨부파일 목록과 썸네일
    for (let i = 0; i < expense.attachments.length; i++) {
      const attachment = expense.attachments[i];

      try {
        // 이미지 다운로드
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

        // 이미지를 셀에 추가 (썸네일 크기)
        sheet.addImage(imageId, {
          tl: { col: 0, row: currentRow - 1 },
          ext: { width: 100, height: 100 },
        });

        // 행 높이 설정 (이미지 크기에 맞춤)
        sheet.getRow(currentRow).height = 75;

        // 파일명과 크기 정보
        sheet.getCell(`B${currentRow}`).value = attachment.fileName;
        sheet.getCell(`B${currentRow}`).alignment = { vertical: 'middle' };

        sheet.mergeCells(`C${currentRow}:D${currentRow}`);
        sheet.getCell(`C${currentRow}`).value = `크기: ${(attachment.fileSize / 1024).toFixed(1)} KB`;
        sheet.getCell(`C${currentRow}`).alignment = { vertical: 'middle' };

        sheet.mergeCells(`E${currentRow}:F${currentRow}`);
        if (attachment.width && attachment.height) {
          sheet.getCell(`E${currentRow}`).value = `${attachment.width} x ${attachment.height}`;
          sheet.getCell(`E${currentRow}`).alignment = { vertical: 'middle' };
        }

        currentRow++;
      } catch (error) {
        console.error(`Failed to add thumbnail for ${attachment.fileName}:`, error);
        // 이미지 로드 실패 시 파일명만 표시
        sheet.getCell(`A${currentRow}`).value = `[이미지 로드 실패]`;
        sheet.getCell(`A${currentRow}`).font = { color: { argb: 'FFFF0000' } };
        sheet.mergeCells(`B${currentRow}:F${currentRow}`);
        sheet.getCell(`B${currentRow}`).value = attachment.fileName;
        currentRow++;
      }
    }
  }

  // 빈 행
  currentRow++;

  // 버전 정보
  sheet.mergeCells(`A${currentRow}:F${currentRow}`);
  const versionCell = sheet.getCell(`A${currentRow}`);
  versionCell.value = '지출결의서 Ver.4.1.3';
  versionCell.alignment = { horizontal: 'right' };
  versionCell.font = { size: 9, color: { argb: 'FF808080' } };

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
