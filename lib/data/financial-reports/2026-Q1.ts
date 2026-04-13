/**
 * 2026년 1분기 재정보고서 데이터
 * 원본: 26_1분기_재정보고서(표준)_최종_20260411.xlsx
 */

import type { FinancialReportData } from './types';

export const report2026Q1: FinancialReportData = {
  year: 2026,
  quarter: 1,
  title: '2026년 1분기 재정보고서',
  summary: {
    period: '2026.01.01 ~ 2026.03.31',
    previousCarryover: 20376964,
    totalIncome: 177320848,
    totalExpense: 139649110,
    difference: 177320848 - 139649110,
    nextCarryover: 58048702,
    prevYear: {
      previousCarryover: 14690878,
      totalIncome: 107783964,
      totalExpense: 111005564,
      nextCarryover: 11469278,
    },
  },
  incomeItems: [
    // 주헌금
    { id: 'i1', category: '주헌금', itemName: '주헌금', budgetAmount: 420000000, currentAmount: 139355240, cumulativeAmount: 139355240, executionRate: 33.18, previousYearAmount: 102589990 },
    { id: 'i1-1', category: '주헌금', itemName: '십일조', budgetAmount: 310000000, currentAmount: 107468240, cumulativeAmount: 107468240, executionRate: 34.67, previousYearAmount: 80514990 },
    { id: 'i1-2', category: '주헌금', itemName: '주일헌금', budgetAmount: 110000000, currentAmount: 31887000, cumulativeAmount: 31887000, executionRate: 28.99, previousYearAmount: 22075000 },

    // 기타헌금
    { id: 'i2', category: '기타헌금', itemName: '기타헌금', budgetAmount: 15500000, currentAmount: 5580000, cumulativeAmount: 5580000, executionRate: 36.00, previousYearAmount: 2500000 },
    { id: 'i2-1', category: '기타헌금', itemName: '감사헌금', budgetAmount: 12000000, currentAmount: 3580000, cumulativeAmount: 3580000, executionRate: 29.83, previousYearAmount: 900000 },
    { id: 'i2-2', category: '기타헌금', itemName: '선교헌금', budgetAmount: 3500000, currentAmount: 2000000, cumulativeAmount: 2000000, executionRate: 57.14, previousYearAmount: 1600000 },

    // 절기헌금
    { id: 'i3', category: '절기헌금', itemName: '절기헌금', budgetAmount: 17000000, currentAmount: 0, cumulativeAmount: 0, executionRate: 0, previousYearAmount: 0 },
    { id: 'i3-1', category: '절기헌금', itemName: '부활절헌금', budgetAmount: 8500000, currentAmount: 0, cumulativeAmount: 0, executionRate: 0, previousYearAmount: 0 },
    { id: 'i3-2', category: '절기헌금', itemName: '성탄절헌금', budgetAmount: 8500000, currentAmount: 0, cumulativeAmount: 0, executionRate: 0, previousYearAmount: 0 },

    // 기타수입
    { id: 'i4', category: '기타수입', itemName: '기타수입', budgetAmount: 7200000, currentAmount: 2385608, cumulativeAmount: 2385608, executionRate: 33.13, previousYearAmount: 2693974 },
    { id: 'i4-1', category: '기타수입', itemName: '잡수익', budgetAmount: 4700000, currentAmount: 1690700, cumulativeAmount: 1690700, executionRate: 35.97, previousYearAmount: 877990 },
    { id: 'i4-2', category: '기타수입', itemName: '이자수익', budgetAmount: 2500000, currentAmount: 694908, cumulativeAmount: 694908, executionRate: 27.80, previousYearAmount: 1815984 },

    // 예산외수입
    { id: 'i5', category: '예산외수입', itemName: '예산외수입', budgetAmount: 0, currentAmount: 30000000, cumulativeAmount: 30000000, executionRate: 0, previousYearAmount: 117048927 },
    { id: 'i5-1', category: '예산외수입', itemName: '적립금_해지', budgetAmount: 0, currentAmount: 30000000, cumulativeAmount: 30000000, executionRate: 0, previousYearAmount: 117048927 },
  ],
  expenseItems: [
    // 교역자사례비
    { id: 'e1', category: '교역자사례비', itemName: '교역자사례비', budgetAmount: 186357000, currentAmount: 47722829, cumulativeAmount: 47722829, executionRate: 25.61, previousYearAmount: 50288388 },
    { id: 'e1-1', category: '교역자사례비', itemName: '담임목사생활비', budgetAmount: 69538000, currentAmount: 20154140, cumulativeAmount: 20154140, executionRate: 28.98, previousYearAmount: 19230110 },
    { id: 'e1-2', category: '교역자사례비', itemName: '전임사역자생활비', budgetAmount: 0, currentAmount: 0, cumulativeAmount: 0, executionRate: 0, previousYearAmount: 3582610 },
    { id: 'e1-3', category: '교역자사례비', itemName: '준전임사역자생활비', budgetAmount: 58476000, currentAmount: 13345270, cumulativeAmount: 13345270, executionRate: 22.82, previousYearAmount: 9941670 },
    { id: 'e1-4', category: '교역자사례비', itemName: '파트사역자생활비', budgetAmount: 14526000, currentAmount: 4412600, cumulativeAmount: 4412600, executionRate: 30.38, previousYearAmount: 5653930 },
    { id: 'e1-5', category: '교역자사례비', itemName: '교역자식대', budgetAmount: 9040000, currentAmount: 2200000, cumulativeAmount: 2200000, executionRate: 24.34, previousYearAmount: 1520000 },
    { id: 'e1-6', category: '교역자사례비', itemName: '교역자_복리후생비', budgetAmount: 16277000, currentAmount: 3170780, cumulativeAmount: 3170780, executionRate: 19.48, previousYearAmount: 3968020 },
    { id: 'e1-7', category: '교역자사례비', itemName: '자녀학비보조비', budgetAmount: 7000000, currentAmount: 1302000, cumulativeAmount: 1302000, executionRate: 18.60, previousYearAmount: 1975000 },
    { id: 'e1-8', category: '교역자사례비', itemName: '학자금지원비', budgetAmount: 4000000, currentAmount: 2024000, cumulativeAmount: 2024000, executionRate: 50.60, previousYearAmount: 1974000 },
    { id: 'e1-9', category: '교역자사례비', itemName: '사택관리비', budgetAmount: 7500000, currentAmount: 1114039, cumulativeAmount: 1114039, executionRate: 14.85, previousYearAmount: 2443048 },

    // 사무사역비
    { id: 'e2', category: '사무사역비', itemName: '사무사역비', budgetAmount: 36049000, currentAmount: 9839820, cumulativeAmount: 9839820, executionRate: 27.30, previousYearAmount: 9697000 },
    { id: 'e2-1', category: '사무사역비', itemName: '사무간사급여', budgetAmount: 30100000, currentAmount: 8731730, cumulativeAmount: 8731730, executionRate: 29.01, previousYearAmount: 8844110 },
    { id: 'e2-2', category: '사무사역비', itemName: '사무간사식대', budgetAmount: 2400000, currentAmount: 600000, cumulativeAmount: 600000, executionRate: 25.00, previousYearAmount: 400000 },
    { id: 'e2-3', category: '사무사역비', itemName: '사무_복리후생비', budgetAmount: 3549000, currentAmount: 508090, cumulativeAmount: 508090, executionRate: 14.32, previousYearAmount: 452890 },

    // 예배사역비
    { id: 'e3', category: '예배사역비', itemName: '예배사역비', budgetAmount: 4470000, currentAmount: 452410, cumulativeAmount: 452410, executionRate: 10.12, previousYearAmount: 803160 },
    { id: 'e3-1', category: '예배사역비', itemName: '강사사례비', budgetAmount: 1500000, currentAmount: 0, cumulativeAmount: 0, executionRate: 0, previousYearAmount: 500000 },
    { id: 'e3-2', category: '예배사역비', itemName: '예배준비비', budgetAmount: 1540000, currentAmount: 314200, cumulativeAmount: 314200, executionRate: 20.40, previousYearAmount: 223160 },
    { id: 'e3-3', category: '예배사역비', itemName: '방송비', budgetAmount: 310000, currentAmount: 0, cumulativeAmount: 0, executionRate: 0, previousYearAmount: 0 },
    { id: 'e3-4', category: '예배사역비', itemName: '찬양팀운영비', budgetAmount: 1120000, currentAmount: 138210, cumulativeAmount: 138210, executionRate: 12.34, previousYearAmount: 80000 },

    // 교육사역비
    { id: 'e4', category: '교육사역비', itemName: '교육사역비', budgetAmount: 26127000, currentAmount: 4906795, cumulativeAmount: 4906795, executionRate: 18.78, previousYearAmount: 6303180 },
    { id: 'e4-1', category: '교육사역비', itemName: '영유아사역비', budgetAmount: 2928000, currentAmount: 141060, cumulativeAmount: 141060, executionRate: 4.82, previousYearAmount: 180520 },
    { id: 'e4-2', category: '교육사역비', itemName: '유치사역비', budgetAmount: 3500000, currentAmount: 589290, cumulativeAmount: 589290, executionRate: 16.84, previousYearAmount: 251940 },
    { id: 'e4-3', category: '교육사역비', itemName: '유년사역비', budgetAmount: 2899000, currentAmount: 115080, cumulativeAmount: 115080, executionRate: 3.97, previousYearAmount: 660200 },
    { id: 'e4-4', category: '교육사역비', itemName: '초등사역비', budgetAmount: 3794000, currentAmount: 253750, cumulativeAmount: 253750, executionRate: 6.69, previousYearAmount: 904940 },
    { id: 'e4-5', category: '교육사역비', itemName: '중고등사역비', budgetAmount: 5766000, currentAmount: 1845310, cumulativeAmount: 1845310, executionRate: 32.00, previousYearAmount: 2166300 },
    { id: 'e4-6', category: '교육사역비', itemName: '청연유스사역비', budgetAmount: 7240000, currentAmount: 1962305, cumulativeAmount: 1962305, executionRate: 27.10, previousYearAmount: 2139280 },

    // 양육사역비
    { id: 'e5', category: '양육사역비', itemName: '양육사역비', budgetAmount: 10185000, currentAmount: 606150, cumulativeAmount: 606150, executionRate: 5.95, previousYearAmount: 855000 },
    { id: 'e5-1', category: '양육사역비', itemName: '양육지원비', budgetAmount: 7051000, currentAmount: 485150, cumulativeAmount: 485150, executionRate: 6.88, previousYearAmount: 722910 },
    { id: 'e5-2', category: '양육사역비', itemName: '새가족운영비', budgetAmount: 2070000, currentAmount: 0, cumulativeAmount: 0, executionRate: 0, previousYearAmount: 0 },
    { id: 'e5-3', category: '양육사역비', itemName: '세바맘운영비', budgetAmount: 1064000, currentAmount: 121000, cumulativeAmount: 121000, executionRate: 11.37, previousYearAmount: 132090 },

    // 목양사역비
    { id: 'e6', category: '목양사역비', itemName: '목양사역비', budgetAmount: 3530000, currentAmount: 890540, cumulativeAmount: 890540, executionRate: 25.23, previousYearAmount: 592400 },
    { id: 'e6-1', category: '목양사역비', itemName: '목양비', budgetAmount: 2030000, currentAmount: 490540, cumulativeAmount: 490540, executionRate: 24.16, previousYearAmount: 592400 },
    { id: 'e6-2', category: '목양사역비', itemName: '마중물비', budgetAmount: 1500000, currentAmount: 400000, cumulativeAmount: 400000, executionRate: 26.67, previousYearAmount: 0 },

    // 섬김사역비
    { id: 'e7', category: '섬김사역비', itemName: '섬김사역비', budgetAmount: 41000000, currentAmount: 10685534, cumulativeAmount: 10685534, executionRate: 26.06, previousYearAmount: 9503050 },
    { id: 'e7-1', category: '섬김사역비', itemName: '경조비', budgetAmount: 3000000, currentAmount: 774364, cumulativeAmount: 774364, executionRate: 25.81, previousYearAmount: 235900 },
    { id: 'e7-2', category: '섬김사역비', itemName: '주일식사비', budgetAmount: 35000000, currentAmount: 9111170, cumulativeAmount: 9111170, executionRate: 26.03, previousYearAmount: 8867150 },
    { id: 'e7-3', category: '섬김사역비', itemName: '주차비', budgetAmount: 3000000, currentAmount: 800000, cumulativeAmount: 800000, executionRate: 26.67, previousYearAmount: 400000 },

    // 비전사역비
    { id: 'e8', category: '비전사역비', itemName: '비전사역비', budgetAmount: 43709440, currentAmount: 5446800, cumulativeAmount: 5446800, executionRate: 12.46, previousYearAmount: 5404390 },
    { id: 'e8-1', category: '비전사역비', itemName: '공간사역비', budgetAmount: 7799440, currentAmount: 1247200, cumulativeAmount: 1247200, executionRate: 15.99, previousYearAmount: 1248000 },
    { id: 'e8-2', category: '비전사역비', itemName: '이웃사랑사역비', budgetAmount: 35910000, currentAmount: 4199600, cumulativeAmount: 4199600, executionRate: 11.69, previousYearAmount: 4156390 },

    // 사역지원비
    { id: 'e9', category: '사역지원비', itemName: '사역지원비', budgetAmount: 5304000, currentAmount: 84600, cumulativeAmount: 84600, executionRate: 1.60, previousYearAmount: 0 },
    { id: 'e9-1', category: '사역지원비', itemName: '전교인행사', budgetAmount: 2250000, currentAmount: 0, cumulativeAmount: 0, executionRate: 0, previousYearAmount: 0 },
    { id: 'e9-2', category: '사역지원비', itemName: '홍보비', budgetAmount: 534000, currentAmount: 0, cumulativeAmount: 0, executionRate: 0, previousYearAmount: 0 },
    { id: 'e9-3', category: '사역지원비', itemName: '교제비', budgetAmount: 1200000, currentAmount: 84600, cumulativeAmount: 84600, executionRate: 7.05, previousYearAmount: 0 },
    { id: 'e9-4', category: '사역지원비', itemName: '청세포비(포럼비)', budgetAmount: 1320000, currentAmount: 0, cumulativeAmount: 0, executionRate: 0, previousYearAmount: 0 },

    // 건물및시설유지관리비
    { id: 'e10', category: '건물및시설유지관리비', itemName: '건물및시설유지관리비', budgetAmount: 85062400, currentAmount: 21654320, cumulativeAmount: 21654320, executionRate: 25.46, previousYearAmount: 22504840 },
    { id: 'e10-1', category: '건물및시설유지관리비', itemName: '시설유지보수비', budgetAmount: 5157400, currentAmount: 857530, cumulativeAmount: 857530, executionRate: 16.63, previousYearAmount: 1608750 },
    { id: 'e10-2', category: '건물및시설유지관리비', itemName: '건물관리비', budgetAmount: 48465000, currentAmount: 14731250, cumulativeAmount: 14731250, executionRate: 30.40, previousYearAmount: 14064060 },
    { id: 'e10-3', category: '건물및시설유지관리비', itemName: '비품비', budgetAmount: 1000000, currentAmount: 0, cumulativeAmount: 0, executionRate: 0, previousYearAmount: 1222390 },
    { id: 'e10-4', category: '건물및시설유지관리비', itemName: '공간임차료', budgetAmount: 30440000, currentAmount: 6065540, cumulativeAmount: 6065540, executionRate: 19.93, previousYearAmount: 5609640 },

    // 목회활동비
    { id: 'e11', category: '목회활동비', itemName: '목회활동비', budgetAmount: 6860000, currentAmount: 1339980, cumulativeAmount: 1339980, executionRate: 19.53, previousYearAmount: 1831676 },
    { id: 'e11-1', category: '목회활동비', itemName: '목회_통신비', budgetAmount: 960000, currentAmount: 240000, cumulativeAmount: 240000, executionRate: 25.00, previousYearAmount: 311420 },
    { id: 'e11-2', category: '목회활동비', itemName: '목회_회의및접대비', budgetAmount: 600000, currentAmount: 0, cumulativeAmount: 0, executionRate: 0, previousYearAmount: 142836 },
    { id: 'e11-3', category: '목회활동비', itemName: '교육지원비', budgetAmount: 300000, currentAmount: 100000, cumulativeAmount: 100000, executionRate: 33.33, previousYearAmount: 20000 },
    { id: 'e11-4', category: '목회활동비', itemName: '차량관리비', budgetAmount: 4400000, currentAmount: 851480, cumulativeAmount: 851480, executionRate: 19.35, previousYearAmount: 1206220 },
    { id: 'e11-5', category: '목회활동비', itemName: '도서구입비', budgetAmount: 600000, currentAmount: 148500, cumulativeAmount: 148500, executionRate: 24.75, previousYearAmount: 151200 },

    // 사무행정비
    { id: 'e12', category: '사무행정비', itemName: '사무행정비', budgetAmount: 9525449, currentAmount: 2045952, cumulativeAmount: 2045952, executionRate: 21.48, previousYearAmount: 3222480 },
    { id: 'e12-1', category: '사무행정비', itemName: '사무_통신비', budgetAmount: 1557500, currentAmount: 296168, cumulativeAmount: 296168, executionRate: 19.02, previousYearAmount: 342950 },
    { id: 'e12-2', category: '사무행정비', itemName: '소모품및사무용품비', budgetAmount: 3000000, currentAmount: 447120, cumulativeAmount: 447120, executionRate: 14.90, previousYearAmount: 1562330 },
    { id: 'e12-3', category: '사무행정비', itemName: '사무_회의및접대비', budgetAmount: 192000, currentAmount: 0, cumulativeAmount: 0, executionRate: 0, previousYearAmount: 108000 },
    { id: 'e12-4', category: '사무행정비', itemName: '인쇄비', budgetAmount: 250000, currentAmount: 0, cumulativeAmount: 0, executionRate: 0, previousYearAmount: 27000 },
    { id: 'e12-5', category: '사무행정비', itemName: '여비교통비', budgetAmount: 250000, currentAmount: 0, cumulativeAmount: 0, executionRate: 0, previousYearAmount: 40000 },
    { id: 'e12-6', category: '사무행정비', itemName: '지급수수료', budgetAmount: 3835949, currentAmount: 1118064, cumulativeAmount: 1118064, executionRate: 29.15, previousYearAmount: 493800 },
    { id: 'e12-7', category: '사무행정비', itemName: '잡지출', budgetAmount: 440000, currentAmount: 184600, cumulativeAmount: 184600, executionRate: 41.95, previousYearAmount: 648400 },

    // 상회부담금
    { id: 'e13', category: '상회부담금', itemName: '상회부담금', budgetAmount: 6300000, currentAmount: 800000, cumulativeAmount: 800000, executionRate: 12.70, previousYearAmount: 0 },

    // 예비비
    { id: 'e14', category: '예비비', itemName: '예비비', budgetAmount: 15000000, currentAmount: 0, cumulativeAmount: 0, executionRate: 0, previousYearAmount: 0 },

    // 적립금
    { id: 'e15', category: '적립금', itemName: '적립금', budgetAmount: 34606000, currentAmount: 4200000, cumulativeAmount: 4200000, executionRate: 12.14, previousYearAmount: 0 },
    { id: 'e15-1', category: '적립금', itemName: '임차보증금(상환)적립금', budgetAmount: 12200000, currentAmount: 4200000, cumulativeAmount: 4200000, executionRate: 34.43, previousYearAmount: 0 },
    { id: 'e15-2', category: '적립금', itemName: '퇴직적립금', budgetAmount: 22406000, currentAmount: 0, cumulativeAmount: 0, executionRate: 0, previousYearAmount: 0 },

    // 예산외지출
    { id: 'e16', category: '예산외지출', itemName: '예산외지출', budgetAmount: 0, currentAmount: 28973380, cumulativeAmount: 28973380, executionRate: 0, previousYearAmount: 0 },
    { id: 'e16-1', category: '예산외지출', itemName: '적립금(예산외)', budgetAmount: 0, currentAmount: 28973380, cumulativeAmount: 28973380, executionRate: 0, previousYearAmount: 0 },
  ],
  bankAccounts: [
    { id: 'b1', accountType: '보통예금(주거래통장)', accountNumber: '1005-004-116622', balance: 58048702, note: '재정보고서 잔액과 일치함' },
  ],
  reserves: [
    { id: 'r1', itemName: '이웃사랑적립금', previousBalance: 37700000, increase: 0, decrease: 0, currentBalance: 37700000, note: '' },
    { id: 'r2', itemName: '은급적립금', previousBalance: 5000000, increase: 0, decrease: 0, currentBalance: 5000000, note: '' },
    { id: 'r3', itemName: '공간확보적립금', previousBalance: 30000000, increase: 0, decrease: 30000000, currentBalance: 0, note: '410호 임차료 및 공사비' },
    { id: 'r4', itemName: '차량적립금', previousBalance: 10000000, increase: 0, decrease: 0, currentBalance: 10000000, note: '' },
    { id: 'r5', itemName: '방송시설적립금', previousBalance: 15000000, increase: 0, decrease: 0, currentBalance: 15000000, note: '' },
    { id: 'r6', itemName: '퇴직적립금(퇴직연금)', previousBalance: 26136021, increase: 0, decrease: 0, currentBalance: 26136021, note: '' },
  ],
  assets: [
    { id: 'a1', assetType: '담임목사 사택전세보증금', amount: 514500000, maturityDate: '2027-04-05', owner: '임대웅', note: '청연교회 350,000,000 / 전세자금·신용대출(임대웅) 164,500,000 / 3.5억 채권양도(임대웅)양수(청연교회)계약' },
    { id: 'a2', assetType: '410호 전세보증금', amount: 30000000, maturityDate: '2029-03-01', owner: '청연교회', note: '월임대료 180만원' },
  ],
  liabilities: [
    { id: 'l1', itemName: '전세자금대출', previousBalance: 140000000, increase: 0, decrease: 0, currentBalance: 140000000, maturityDate: '2027-05-04', debtor: '임대웅', interestRate: undefined, note: '' },
    { id: 'l2', itemName: '신용대출(전세보증금 인상)', previousBalance: 24500000, increase: 0, decrease: 0, currentBalance: 24500000, maturityDate: '2026-04-06', debtor: '임대웅', interestRate: undefined, note: '' },
    { id: 'l3', itemName: '서문교회 차입금', previousBalance: 12200000, increase: 0, decrease: 4200000, currentBalance: 8000000, maturityDate: '2026-06-30', debtor: '청연교회', interestRate: undefined, note: '' },
  ],
  committeeExpenses: [
    // PDF 6페이지 차트 기준 (단위: 천원 -> 원)
    { id: 'c1', committee: '인건·복리비', amount: 56450000 },
    { id: 'c2', committee: '행정비', amount: 40130000 },
    { id: 'c3', committee: '기획위원회', amount: 6300000 },
    { id: 'c4', committee: '교육위원회', amount: 3070000 },
    { id: 'c5', committee: '목양위원회', amount: 3340000 },
    { id: 'c6', committee: '예배위원회', amount: 450000 },
  ],
};
