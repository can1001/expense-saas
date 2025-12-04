import * as XLSX from 'xlsx';
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
  // ExcelJS 워크북 생성
  const workbook = new ExcelJS.Workbook();

  // 1. 지출결의서 기본 정보 시트
  const infoSheet = workbook.addWorksheet('지출결의서');
  
  infoSheet.getColumn(1).width = 15;
  infoSheet.getColumn(2).width = 30;

  infoSheet.addRow(['지출결의서']);
  infoSheet.addRow([]);
  infoSheet.addRow(['예산 정보']);
  infoSheet.addRow(['위원회', expense.committee]);
  infoSheet.addRow(['사역팀(부)', expense.department]);
  infoSheet.addRow(['예산(항)', expense.budgetCategory]);
  infoSheet.addRow(['예산(목)', expense.budgetSubcategory]);
  infoSheet.addRow([]);
  infoSheet.addRow(['지출 정보']);
  infoSheet.addRow(['지출일자', expense.expenseDate ? format(new Date(expense.expenseDate), 'yyyy-MM-dd') : '미정']);
  infoSheet.addRow([]);
  infoSheet.addRow(['신청 정보']);
  infoSheet.addRow(['청구일자', format(new Date(expense.requestDate), 'yyyy-MM-dd')]);
  infoSheet.addRow(['청구팀', expense.requestTeam]);
  infoSheet.addRow(['청구인', expense.applicantName]);
  infoSheet.addRow(['직책', expense.applicantTitle || '']);
  infoSheet.addRow([]);
  infoSheet.addRow(['은행 정보']);
  infoSheet.addRow(['은행명', expense.bankName]);
  infoSheet.addRow(['계좌번호', expense.accountNumber]);
  infoSheet.addRow(['예금주', expense.accountHolder]);
  infoSheet.addRow([]);
  infoSheet.addRow(['총 청구금액', expense.requestAmount.toLocaleString('ko-KR') + '원']);

  // 2. 세부 항목 시트
  const itemsSheet = workbook.addWorksheet('세부항목');
  
  itemsSheet.getColumn(1).width = 8;  // 순서
  itemsSheet.getColumn(2).width = 25; // 예산(세목)
  itemsSheet.getColumn(3).width = 40; // 적요
  itemsSheet.getColumn(4).width = 15; // 단가
  itemsSheet.getColumn(5).width = 8;  // 수량
  itemsSheet.getColumn(6).width = 15; // 금액

  // 헤더
  const headerRow = itemsSheet.addRow(['순서', '예산(세목)', '적요', '단가', '수량', '금액']);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  // 데이터 행
  expense.items.forEach((item) => {
    const row = itemsSheet.addRow([
      item.order,
      item.budgetDetail,
      item.description,
      item.unitPrice,
      item.quantity,
      item.amount,
    ]);
    // 숫자 포맷 (천 단위 콤마)
    row.getCell(4).numFmt = '#,##0';
    row.getCell(6).numFmt = '#,##0';
  });

  // 합계 행
  const totalRow = itemsSheet.addRow(['', '', '', '', '합계', expense.requestAmount]);
  totalRow.getCell(5).font = { bold: true };
  totalRow.getCell(6).font = { bold: true };
  totalRow.getCell(6).numFmt = '#,##0';

  // 3. 첨부파일 이미지 시트 (있는 경우)
  if (expense.attachments && expense.attachments.length > 0) {
    const imagesSheet = workbook.addWorksheet('첨부파일');
    
    // A4 용지 설정
    imagesSheet.pageSetup = {
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
    };

    // A4 용지 크기 (mm 기준)
    // A4: 210mm x 297mm
    // Excel에서 mm를 포인트로 변환: 1mm = 2.83465 points
    const a4WidthMM = 210;
    const a4HeightMM = 297;
    const marginMM = 10; // 여백
    const usableWidthMM = a4WidthMM - (marginMM * 2);
    const usableHeightMM = a4HeightMM - (marginMM * 2);
    
    // 2x2 그리드로 배치
    const imageWidthMM = usableWidthMM / 2;
    const imageHeightMM = usableHeightMM / 2;
    
    // Excel에서 mm를 포인트로 변환 (1mm ≈ 2.83465 points)
    const mmToPoints = 2.83465;
    const imageWidthPoints = imageWidthMM * mmToPoints;
    const imageHeightPoints = imageHeightMM * mmToPoints;

    // 열 너비 설정 (이미지가 들어갈 공간 확보)
    // 기본 열 너비를 포인트로 변환하여 설정
    const colWidthPoints = imageWidthPoints + 20; // 여유 공간 추가
    imagesSheet.getColumn(1).width = colWidthPoints / 7; // Excel 열 너비는 문자 단위 (대략 7포인트 = 1문자)
    imagesSheet.getColumn(2).width = colWidthPoints / 7;
    imagesSheet.getColumn(3).width = colWidthPoints / 7;
    imagesSheet.getColumn(4).width = colWidthPoints / 7;

    // 이미지를 4개씩 페이지에 배치
    const imagesPerPage = 4;
    const totalPages = Math.ceil(expense.attachments.length / imagesPerPage);

    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      const startIndex = pageIndex * imagesPerPage;
      const endIndex = Math.min(startIndex + imagesPerPage, expense.attachments.length);
      const pageAttachments = expense.attachments.slice(startIndex, endIndex);

      // 페이지당 시작 행 계산 (각 페이지는 30행 높이)
      const pageStartRow = pageIndex * 30;

      for (let i = 0; i < pageAttachments.length; i++) {
        const attachment = pageAttachments[i];
        const gridRow = Math.floor(i / 2); // 그리드 내 행 (0 또는 1)
        const gridCol = i % 2; // 그리드 내 열 (0 또는 1)

        try {
          // 이미지 다운로드
          const imageBuffer = await fetchImageAsBuffer(attachment.secureUrl);
          
          // 이미지 형식 결정
          let extension = 'png';
          if (attachment.format) {
            if (attachment.format.toLowerCase() === 'jpg' || attachment.format.toLowerCase() === 'jpeg') {
              extension = 'jpeg';
            } else if (attachment.format.toLowerCase() === 'png') {
              extension = 'png';
            } else if (attachment.format.toLowerCase() === 'gif') {
              extension = 'gif';
            }
          }
          
          // 이미지 추가
          const imageId = workbook.addImage({
            buffer: imageBuffer,
            extension: extension as 'jpeg' | 'png' | 'gif',
          });

          // 이미지 위치 계산
          // 왼쪽 상단: gridCol * 2 (A=0, C=2)
          // 행: pageStartRow + gridRow * 15 (각 이미지 영역은 15행 높이)
          const startCol = gridCol * 2;
          const startRow = pageStartRow + gridRow * 15;
          
          imagesSheet.addImage(imageId, {
            tl: { col: startCol, row: startRow },
            ext: { width: imageWidthPoints, height: imageHeightPoints },
          });

          // 이미지 아래에 파일명 추가
          const fileNameRow = startRow + Math.ceil(imageHeightPoints / 20) + 1; // 이미지 높이에 따라 조정
          const fileNameCell = imagesSheet.getCell(fileNameRow, startCol + 1);
          fileNameCell.value = attachment.fileName;
          fileNameCell.font = { size: 9 };
          fileNameCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
          imagesSheet.getRow(fileNameRow).height = 20;
        } catch (error) {
          console.error(`Failed to add image ${attachment.fileName}:`, error);
          // 이미지 로드 실패 시 파일명만 표시
          const startCol = gridCol * 2;
          const startRow = pageStartRow + gridRow * 15;
          const errorCell = imagesSheet.getCell(startRow + 1, startCol + 1);
          errorCell.value = `[이미지 로드 실패] ${attachment.fileName}`;
          errorCell.font = { size: 9, color: { argb: 'FFFF0000' } };
        }
      }
    }

  }

  // 파일명 생성
  const fileName = `지출결의서_${expense.applicantName}_${format(new Date(expense.requestDate), 'yyyyMMdd')}.xlsx`;

  // 엑셀 파일 생성 및 다운로드
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
