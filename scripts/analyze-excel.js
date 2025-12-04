const ExcelJS = require('exceljs');
const path = require('path');

async function analyzeExcel() {
  const workbook = new ExcelJS.Workbook();
  const filePath = '/Users/wandosea/Downloads/지출결의서_A4출력용 (1).xlsx';

  try {
    await workbook.xlsx.readFile(filePath);

    console.log('=== 워크북 정보 ===');
    console.log('시트 이름:', workbook.worksheets.map(ws => ws.name).join(', '));
    console.log();

    const sheet = workbook.worksheets[0];
    console.log('=== 첫 번째 시트 정보 ===');
    console.log('시트 이름:', sheet.name);
    console.log('행 개수:', sheet.rowCount);
    console.log('열 개수:', sheet.columnCount);
    console.log();

    // 페이지 설정
    if (sheet.pageSetup) {
      console.log('=== 페이지 설정 ===');
      console.log('용지 크기:', sheet.pageSetup.paperSize);
      console.log('방향:', sheet.pageSetup.orientation);
      console.log('여백:', JSON.stringify(sheet.pageSetup.margins));
      console.log();
    }

    // 열 너비
    console.log('=== 열 너비 ===');
    sheet.columns.forEach((col, idx) => {
      if (col.width) {
        console.log(`열 ${idx + 1}: ${col.width}`);
      }
    });
    console.log();

    // 처음 30행의 데이터
    console.log('=== 처음 30행의 데이터 ===');
    for (let rowNum = 1; rowNum <= Math.min(30, sheet.rowCount); rowNum++) {
      const row = sheet.getRow(rowNum);
      const rowData = [];

      for (let colNum = 1; colNum <= Math.min(10, sheet.columnCount); colNum++) {
        const cell = row.getCell(colNum);
        if (cell.value) {
          const colLetter = String.fromCharCode(64 + colNum);
          let value = cell.value;

          // 값 타입 확인
          if (typeof value === 'object' && value.text) {
            value = value.text;
          }

          const valueStr = String(value).substring(0, 30);

          // 스타일 정보
          const style = [];
          if (cell.font?.bold) style.push('bold');
          if (cell.font?.size) style.push(`size:${cell.font.size}`);
          if (cell.fill?.fgColor?.argb) style.push(`bg:${cell.fill.fgColor.argb}`);
          if (cell.alignment?.horizontal) style.push(`h:${cell.alignment.horizontal}`);
          if (cell.alignment?.vertical) style.push(`v:${cell.alignment.vertical}`);

          const styleStr = style.length > 0 ? ` [${style.join(', ')}]` : '';
          rowData.push(`${colLetter}${rowNum}:${valueStr}${styleStr}`);
        }
      }

      if (rowData.length > 0) {
        console.log(`행 ${rowNum}: ${rowData.join(' | ')}`);
      }

      // 행 높이
      if (row.height && row.height !== 15) {
        console.log(`  → 행 높이: ${row.height}`);
      }
    }

    console.log();
    console.log('=== 셀 병합 정보 ===');
    if (sheet.model && sheet.model.merges) {
      sheet.model.merges.forEach(merge => {
        console.log('병합:', merge);
      });
    }

  } catch (error) {
    console.error('오류:', error.message);
    process.exit(1);
  }
}

analyzeExcel();
