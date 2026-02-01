import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { Expense } from '@/lib/types';

// 이미지를 다운로드하여 ArrayBuffer로 변환하는 헬퍼 함수
async function fetchImageAsBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  return await response.arrayBuffer();
}

export async function generateExpenseExcel(expense: Expense) {
  // 1. 템플릿 파일 가져오기
  const templateResponse = await fetch('/template.xlsx');
  if (!templateResponse.ok) {
    throw new Error('템플릿 파일을 불러올 수 없습니다.');
  }
  const templateBuffer = await templateResponse.arrayBuffer();

  // 2. ExcelJS로 템플릿 로드
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);

  // 3. 첫 번째 시트 가져오기
  const sheet = workbook.worksheets[0];

  // 4. Shared Formula 문제 해결: 모든 수식을 값으로 변환
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      // 수식이 있는 셀은 값으로 변환
      if (cell.type === ExcelJS.ValueType.Formula) {
        const cellValue: any = cell.value;
        if (cellValue && typeof cellValue === 'object' && 'result' in cellValue) {
          cell.value = cellValue.result;
        } else {
          // 수식만 있고 결과가 없으면 빈 값으로
          cell.value = null;
        }
      }
    });
  });

  // 4. 데이터 매핑 (셀 위치에 값 채우기)

  // 예산 정보 (첫 번째 항목에서 가져오기)
  const firstItem = expense.items[0];
  const budgetValue = firstItem
    ? `${firstItem.budgetCategory || '-'} / ${firstItem.budgetSubcategory || '-'}`
    : '- / -';
  // E3 셀에 예산항목 입력
  const e3Cell = sheet.getCell('E3');
  if (e3Cell) {
    e3Cell.value = budgetValue;
  }

  // 지출일자
  if (expense.expenseDate) {
    const expenseYear = format(new Date(expense.expenseDate), 'yyyy');
    const expenseMonth = format(new Date(expense.expenseDate), 'M');
    const expenseDay = format(new Date(expense.expenseDate), 'd');
    const dateValue = `${expenseYear} 년        ${expenseMonth} 월        ${expenseDay} 일`;

    // E4 셀에 지출일자 입력
    const e4Cell = sheet.getCell('E4');
    if (e4Cell) {
      e4Cell.value = dateValue;
    }
  }

  // 청구금액
  const amountValue = `\\ ${expense.requestAmount.toLocaleString('ko-KR')} 원`;
  // E6 셀에 청구금액 입력
  const e6Cell = sheet.getCell('E6');
  if (e6Cell) {
    e6Cell.value = amountValue;
  }

  // 세부 항목 데이터 입력 (12행부터 21행까지, 최대 10개)
  for (let i = 0; i < 10; i++) {
    const rowNum = 12 + i;
    const item = expense.items[i];

    if (item) {
      // B열: 예산(세목)
      const bCell = sheet.getCell(`B${rowNum}`);
      if (bCell) {
        bCell.value = item.budgetDetail;
      }

      // D열: 적요
      const dCell = sheet.getCell(`D${rowNum}`);
      if (dCell) {
        dCell.value = item.description;
      }

      // F열: 단가
      const fCell = sheet.getCell(`F${rowNum}`);
      if (fCell) {
        fCell.value = item.unitPrice;
      }

      // H열: 수량
      const hCell = sheet.getCell(`H${rowNum}`);
      if (hCell) {
        hCell.value = item.quantity;
      }

      // I열: 금액
      const iCell = sheet.getCell(`I${rowNum}`);
      if (iCell) {
        iCell.value = item.amount;
      }
    } else {
      // 빈 행은 0 또는 빈 값
      const bCell = sheet.getCell(`B${rowNum}`);
      if (bCell) {
        bCell.value = '0';
      }

      const iCell = sheet.getCell(`I${rowNum}`);
      if (iCell) {
        iCell.value = '0';
      }
    }
  }

  // 합계 (I23)
  const i23Cell = sheet.getCell('I23');
  if (i23Cell) {
    i23Cell.value = expense.requestAmount;
  }

  // 청구 일자
  const requestYear = format(new Date(expense.requestDate), 'yyyy');
  const requestMonth = format(new Date(expense.requestDate), 'M');
  const requestDay = format(new Date(expense.requestDate), 'd');
  const requestDateValue = `○ 청구 일자 :    ${requestYear} 년         ${requestMonth} 월         ${requestDay} 일             (재정팀) 출납필   (인)`;

  // A26 셀
  const a26Cell = sheet.getCell('A26');
  if (a26Cell) {
    a26Cell.value = requestDateValue;
  }

  // 청구팀/청구인
  const teamValue = `○ 청구팀(부) :    ${expense.committee}    ${expense.department}    ○ 청구인 :    ${expense.applicantName}        (인)`;

  // A27 셀
  const a27Cell = sheet.getCell('A27');
  if (a27Cell) {
    a27Cell.value = teamValue;
  }

  // 은행 정보
  const bankValue = ` ○    ${expense.bankName}     ○ 계좌번호 :    ${expense.accountNumber}        ○ 예금주 :        ${expense.accountHolder}`;

  // A28 셀
  const a28Cell = sheet.getCell('A28');
  if (a28Cell) {
    a28Cell.value = bankValue;
  }

  // 5. 영수증 이미지 시트 추가
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
            header: 0.3,
            footer: 0.3,
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

  // 6. 파일 다운로드
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
