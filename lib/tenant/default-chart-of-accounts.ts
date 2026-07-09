/**
 * 조직 유형별 기본 계정과목 정의
 *
 * 새 테넌트 생성 시 orgType에 따라 자동으로 기본 데이터가 설정됩니다.
 */

import { OrgType } from '@prisma/client';

// 위원회 정의
export interface CommitteeData {
  name: string;
  sortOrder: number;
  departments: DepartmentData[];
}

// 부서 정의
export interface DepartmentData {
  name: string;
  sortOrder: number;
}

// 예산 항목 정의
export interface BudgetCategoryData {
  name: string;
  sortOrder: number;
  subcategories: BudgetSubcategoryData[];
}

// 예산 목 정의
export interface BudgetSubcategoryData {
  name: string;
  sortOrder: number;
  details: BudgetDetailData[];
}

// 예산 세목 정의
export interface BudgetDetailData {
  name: string;
  accountCode?: string;
  description?: string;
  sortOrder: number;
}

// 조직 유형별 기본 데이터
export interface OrgTypeDefaultData {
  committees: CommitteeData[];
  budgetCategories: BudgetCategoryData[];
}

// ========================================
// 1. 교회 (CHURCH)
// ========================================

const churchCommittees: CommitteeData[] = [
  {
    name: '당회',
    sortOrder: 1,
    departments: [
      { name: '당회사무국', sortOrder: 1 },
    ],
  },
  {
    name: '기획위원회',
    sortOrder: 2,
    departments: [
      { name: '재정팀', sortOrder: 1 },
      { name: '행정팀', sortOrder: 2 },
      { name: '시설관리팀', sortOrder: 3 },
    ],
  },
  {
    name: '교육위원회',
    sortOrder: 3,
    departments: [
      { name: '유초등부', sortOrder: 1 },
      { name: '중고등부', sortOrder: 2 },
      { name: '청년부', sortOrder: 3 },
      { name: '장년교육부', sortOrder: 4 },
    ],
  },
  {
    name: '선교위원회',
    sortOrder: 4,
    departments: [
      { name: '국내선교팀', sortOrder: 1 },
      { name: '해외선교팀', sortOrder: 2 },
      { name: '구제팀', sortOrder: 3 },
    ],
  },
  {
    name: '섬김위원회',
    sortOrder: 5,
    departments: [
      { name: '봉사팀', sortOrder: 1 },
      { name: '새가족팀', sortOrder: 2 },
      { name: '심방팀', sortOrder: 3 },
    ],
  },
  {
    name: '예배위원회',
    sortOrder: 6,
    departments: [
      { name: '찬양대', sortOrder: 1 },
      { name: '예배팀', sortOrder: 2 },
      { name: '음향영상팀', sortOrder: 3 },
    ],
  },
];

const churchBudgetCategories: BudgetCategoryData[] = [
  {
    name: '인건비',
    sortOrder: 1,
    subcategories: [
      {
        name: '교역자사례비',
        sortOrder: 1,
        details: [
          { name: '담임목사사례비', sortOrder: 1 },
          { name: '부목사사례비', sortOrder: 2 },
          { name: '전도사사례비', sortOrder: 3 },
        ],
      },
      {
        name: '직원급여',
        sortOrder: 2,
        details: [
          { name: '행정간사급여', sortOrder: 1 },
          { name: '시설관리급여', sortOrder: 2 },
          { name: '파트타임급여', sortOrder: 3 },
        ],
      },
      {
        name: '4대보험',
        sortOrder: 3,
        details: [
          { name: '국민연금', sortOrder: 1 },
          { name: '건강보험', sortOrder: 2 },
          { name: '고용보험', sortOrder: 3 },
          { name: '산재보험', sortOrder: 4 },
        ],
      },
      {
        name: '퇴직급여',
        sortOrder: 4,
        details: [
          { name: '퇴직적립금', sortOrder: 1 },
        ],
      },
    ],
  },
  {
    name: '사무행정비',
    sortOrder: 2,
    subcategories: [
      {
        name: '사무비',
        sortOrder: 1,
        details: [
          { name: '사무용품비', sortOrder: 1 },
          { name: '인쇄비', sortOrder: 2 },
          { name: '통신비', sortOrder: 3 },
          { name: '우편비', sortOrder: 4 },
        ],
      },
      {
        name: '관리비',
        sortOrder: 2,
        details: [
          { name: '수도광열비', sortOrder: 1 },
          { name: '청소비', sortOrder: 2 },
          { name: '세금공과금', sortOrder: 3 },
        ],
      },
      {
        name: '차량유지비',
        sortOrder: 3,
        details: [
          { name: '유류비', sortOrder: 1 },
          { name: '수리비', sortOrder: 2 },
          { name: '차량보험료', sortOrder: 3 },
        ],
      },
      {
        name: '회의비',
        sortOrder: 4,
        details: [
          { name: '당회비', sortOrder: 1 },
          { name: '제직회비', sortOrder: 2 },
          { name: '위원회회의비', sortOrder: 3 },
        ],
      },
    ],
  },
  {
    name: '교육비',
    sortOrder: 3,
    subcategories: [
      {
        name: '유초등부',
        sortOrder: 1,
        details: [
          { name: '교재비', sortOrder: 1 },
          { name: '교사훈련비', sortOrder: 2 },
          { name: '행사비', sortOrder: 3 },
        ],
      },
      {
        name: '중고등부',
        sortOrder: 2,
        details: [
          { name: '교재비', sortOrder: 1 },
          { name: '교사훈련비', sortOrder: 2 },
          { name: '수련회비', sortOrder: 3 },
        ],
      },
      {
        name: '청년부',
        sortOrder: 3,
        details: [
          { name: '프로그램비', sortOrder: 1 },
          { name: '수련회비', sortOrder: 2 },
          { name: '도서구입비', sortOrder: 3 },
        ],
      },
      {
        name: '장년교육',
        sortOrder: 4,
        details: [
          { name: '성경공부', sortOrder: 1 },
          { name: '세미나비', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '선교비',
    sortOrder: 4,
    subcategories: [
      {
        name: '국내선교',
        sortOrder: 1,
        details: [
          { name: '개척교회지원', sortOrder: 1 },
          { name: '농어촌선교', sortOrder: 2 },
          { name: '군선교', sortOrder: 3 },
        ],
      },
      {
        name: '해외선교',
        sortOrder: 2,
        details: [
          { name: '선교사지원', sortOrder: 1 },
          { name: '단기선교', sortOrder: 2 },
          { name: '선교훈련', sortOrder: 3 },
        ],
      },
      {
        name: '구제비',
        sortOrder: 3,
        details: [
          { name: '교회내구제', sortOrder: 1 },
          { name: '지역사회구제', sortOrder: 2 },
          { name: '긴급구호', sortOrder: 3 },
        ],
      },
    ],
  },
  {
    name: '예배비',
    sortOrder: 5,
    subcategories: [
      {
        name: '예배준비',
        sortOrder: 1,
        details: [
          { name: '성찬비', sortOrder: 1 },
          { name: '꽃꽂이', sortOrder: 2 },
          { name: '음향영상', sortOrder: 3 },
        ],
      },
      {
        name: '찬양대',
        sortOrder: 2,
        details: [
          { name: '악보구입', sortOrder: 1 },
          { name: '찬양대수련회', sortOrder: 2 },
          { name: '악기수리', sortOrder: 3 },
        ],
      },
      {
        name: '특별예배',
        sortOrder: 3,
        details: [
          { name: '부활절', sortOrder: 1 },
          { name: '추수감사절', sortOrder: 2 },
          { name: '성탄절', sortOrder: 3 },
        ],
      },
    ],
  },
  {
    name: '시설비',
    sortOrder: 6,
    subcategories: [
      {
        name: '시설유지',
        sortOrder: 1,
        details: [
          { name: '건물수리', sortOrder: 1 },
          { name: '설비보수', sortOrder: 2 },
          { name: '안전점검', sortOrder: 3 },
        ],
      },
      {
        name: '시설개선',
        sortOrder: 2,
        details: [
          { name: '리모델링', sortOrder: 1 },
          { name: '장비구입', sortOrder: 2 },
        ],
      },
      {
        name: '비품구입',
        sortOrder: 3,
        details: [
          { name: '집기비품', sortOrder: 1 },
          { name: '전자기기', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '기타지출',
    sortOrder: 7,
    subcategories: [
      {
        name: '경조비',
        sortOrder: 1,
        details: [
          { name: '축의금', sortOrder: 1 },
          { name: '조의금', sortOrder: 2 },
          { name: '위로금', sortOrder: 3 },
        ],
      },
      {
        name: '예비비',
        sortOrder: 2,
        details: [
          { name: '예비비', sortOrder: 1 },
        ],
      },
    ],
  },
];

// ========================================
// 2. 비영리단체 (NONPROFIT)
// ========================================

const nonprofitCommittees: CommitteeData[] = [
  {
    name: '이사회',
    sortOrder: 1,
    departments: [
      { name: '이사회사무국', sortOrder: 1 },
    ],
  },
  {
    name: '사무국',
    sortOrder: 2,
    departments: [
      { name: '총무팀', sortOrder: 1 },
      { name: '재무팀', sortOrder: 2 },
    ],
  },
  {
    name: '사업팀',
    sortOrder: 3,
    departments: [
      { name: '교육사업팀', sortOrder: 1 },
      { name: '지원사업팀', sortOrder: 2 },
      { name: '연구팀', sortOrder: 3 },
    ],
  },
  {
    name: '홍보팀',
    sortOrder: 4,
    departments: [
      { name: '온라인홍보팀', sortOrder: 1 },
      { name: '대외협력팀', sortOrder: 2 },
    ],
  },
];

const nonprofitBudgetCategories: BudgetCategoryData[] = [
  {
    name: '인건비',
    sortOrder: 1,
    subcategories: [
      {
        name: '급여',
        sortOrder: 1,
        details: [
          { name: '상근직급여', sortOrder: 1 },
          { name: '비상근직급여', sortOrder: 2 },
        ],
      },
      {
        name: '상여금',
        sortOrder: 2,
        details: [
          { name: '정기상여', sortOrder: 1 },
          { name: '성과급', sortOrder: 2 },
        ],
      },
      {
        name: '4대보험',
        sortOrder: 3,
        details: [
          { name: '국민연금', sortOrder: 1 },
          { name: '건강보험', sortOrder: 2 },
          { name: '고용보험', sortOrder: 3 },
          { name: '산재보험', sortOrder: 4 },
        ],
      },
      {
        name: '퇴직급여',
        sortOrder: 4,
        details: [
          { name: '퇴직적립금', sortOrder: 1 },
        ],
      },
    ],
  },
  {
    name: '사업비',
    sortOrder: 2,
    subcategories: [
      {
        name: '프로그램비',
        sortOrder: 1,
        details: [
          { name: '교육프로그램', sortOrder: 1 },
          { name: '캠페인', sortOrder: 2 },
          { name: '행사', sortOrder: 3 },
        ],
      },
      {
        name: '지원사업비',
        sortOrder: 2,
        details: [
          { name: '장학금', sortOrder: 1 },
          { name: '지원금', sortOrder: 2 },
          { name: '물품지원', sortOrder: 3 },
        ],
      },
      {
        name: '연구비',
        sortOrder: 3,
        details: [
          { name: '조사연구', sortOrder: 1 },
          { name: '정책연구', sortOrder: 2 },
        ],
      },
      {
        name: '출판비',
        sortOrder: 4,
        details: [
          { name: '인쇄비', sortOrder: 1 },
          { name: '제작비', sortOrder: 2 },
          { name: '배포비', sortOrder: 3 },
        ],
      },
    ],
  },
  {
    name: '운영비',
    sortOrder: 3,
    subcategories: [
      {
        name: '사무비',
        sortOrder: 1,
        details: [
          { name: '사무용품', sortOrder: 1 },
          { name: '통신비', sortOrder: 2 },
          { name: '우편비', sortOrder: 3 },
        ],
      },
      {
        name: '관리비',
        sortOrder: 2,
        details: [
          { name: '임차료', sortOrder: 1 },
          { name: '관리비', sortOrder: 2 },
          { name: '공과금', sortOrder: 3 },
        ],
      },
      {
        name: '차량비',
        sortOrder: 3,
        details: [
          { name: '유류비', sortOrder: 1 },
          { name: '정비비', sortOrder: 2 },
          { name: '보험료', sortOrder: 3 },
        ],
      },
      {
        name: '회의비',
        sortOrder: 4,
        details: [
          { name: '이사회', sortOrder: 1 },
          { name: '실무회의', sortOrder: 2 },
          { name: '간담회', sortOrder: 3 },
        ],
      },
    ],
  },
  {
    name: '홍보비',
    sortOrder: 4,
    subcategories: [
      {
        name: '온라인홍보',
        sortOrder: 1,
        details: [
          { name: 'SNS광고', sortOrder: 1 },
          { name: '웹사이트', sortOrder: 2 },
          { name: '뉴스레터', sortOrder: 3 },
        ],
      },
      {
        name: '오프라인홍보',
        sortOrder: 2,
        details: [
          { name: '인쇄물', sortOrder: 1 },
          { name: '현수막', sortOrder: 2 },
          { name: '굿즈', sortOrder: 3 },
        ],
      },
    ],
  },
  {
    name: '일반관리비',
    sortOrder: 5,
    subcategories: [
      {
        name: '지급수수료',
        sortOrder: 1,
        details: [
          { name: '회계감사', sortOrder: 1 },
          { name: '법률자문', sortOrder: 2 },
          { name: '세무자문', sortOrder: 3 },
        ],
      },
      {
        name: '교육훈련비',
        sortOrder: 2,
        details: [
          { name: '직원교육', sortOrder: 1 },
          { name: '외부연수', sortOrder: 2 },
        ],
      },
      {
        name: '복리후생비',
        sortOrder: 3,
        details: [
          { name: '식대', sortOrder: 1 },
          { name: '건강검진', sortOrder: 2 },
          { name: '경조비', sortOrder: 3 },
        ],
      },
    ],
  },
  {
    name: '기타지출',
    sortOrder: 6,
    subcategories: [
      {
        name: '예비비',
        sortOrder: 1,
        details: [
          { name: '예비비', sortOrder: 1 },
        ],
      },
    ],
  },
];

// ========================================
// 3. 학교 (SCHOOL)
// ========================================

const schoolCommittees: CommitteeData[] = [
  {
    name: '이사회',
    sortOrder: 1,
    departments: [
      { name: '이사회사무국', sortOrder: 1 },
    ],
  },
  {
    name: '교무부',
    sortOrder: 2,
    departments: [
      { name: '교무팀', sortOrder: 1 },
      { name: '학사팀', sortOrder: 2 },
    ],
  },
  {
    name: '학생부',
    sortOrder: 3,
    departments: [
      { name: '학생지원팀', sortOrder: 1 },
      { name: '진로취업팀', sortOrder: 2 },
    ],
  },
  {
    name: '행정부',
    sortOrder: 4,
    departments: [
      { name: '총무팀', sortOrder: 1 },
      { name: '재무팀', sortOrder: 2 },
      { name: '인사팀', sortOrder: 3 },
    ],
  },
  {
    name: '연구부',
    sortOrder: 5,
    departments: [
      { name: '연구지원팀', sortOrder: 1 },
      { name: '산학협력팀', sortOrder: 2 },
    ],
  },
  {
    name: '시설부',
    sortOrder: 6,
    departments: [
      { name: '시설관리팀', sortOrder: 1 },
      { name: '환경안전팀', sortOrder: 2 },
    ],
  },
];

const schoolBudgetCategories: BudgetCategoryData[] = [
  {
    name: '인건비',
    sortOrder: 1,
    subcategories: [
      {
        name: '교원인건비',
        sortOrder: 1,
        details: [
          { name: '교원급여', sortOrder: 1 },
          { name: '연구비', sortOrder: 2 },
          { name: '수당', sortOrder: 3 },
        ],
      },
      {
        name: '직원인건비',
        sortOrder: 2,
        details: [
          { name: '직원급여', sortOrder: 1 },
          { name: '시간외수당', sortOrder: 2 },
          { name: '직책수당', sortOrder: 3 },
        ],
      },
      {
        name: '4대보험',
        sortOrder: 3,
        details: [
          { name: '국민연금', sortOrder: 1 },
          { name: '건강보험', sortOrder: 2 },
          { name: '고용보험', sortOrder: 3 },
          { name: '산재보험', sortOrder: 4 },
        ],
      },
      {
        name: '퇴직급여',
        sortOrder: 4,
        details: [
          { name: '퇴직적립금', sortOrder: 1 },
        ],
      },
    ],
  },
  {
    name: '운영비',
    sortOrder: 2,
    subcategories: [
      {
        name: '사무비',
        sortOrder: 1,
        details: [
          { name: '사무용품', sortOrder: 1 },
          { name: '인쇄비', sortOrder: 2 },
          { name: '통신비', sortOrder: 3 },
        ],
      },
      {
        name: '공공요금',
        sortOrder: 2,
        details: [
          { name: '전기', sortOrder: 1 },
          { name: '수도', sortOrder: 2 },
          { name: '가스', sortOrder: 3 },
        ],
      },
      {
        name: '일반관리비',
        sortOrder: 3,
        details: [
          { name: '청소비', sortOrder: 1 },
          { name: '경비비', sortOrder: 2 },
          { name: '용역비', sortOrder: 3 },
        ],
      },
    ],
  },
  {
    name: '교육비',
    sortOrder: 3,
    subcategories: [
      {
        name: '실험실습비',
        sortOrder: 1,
        details: [
          { name: '실험재료', sortOrder: 1 },
          { name: '실습비', sortOrder: 2 },
          { name: '소모품', sortOrder: 3 },
        ],
      },
      {
        name: '교육활동비',
        sortOrder: 2,
        details: [
          { name: '행사비', sortOrder: 1 },
          { name: '수련회비', sortOrder: 2 },
          { name: '견학비', sortOrder: 3 },
        ],
      },
      {
        name: '도서구입비',
        sortOrder: 3,
        details: [
          { name: '도서구입', sortOrder: 1 },
          { name: '정기간행물', sortOrder: 2 },
        ],
      },
      {
        name: '교육기자재',
        sortOrder: 4,
        details: [
          { name: '교육용기기', sortOrder: 1 },
          { name: 'SW라이선스', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '학생복지비',
    sortOrder: 4,
    subcategories: [
      {
        name: '장학금',
        sortOrder: 1,
        details: [
          { name: '성적장학', sortOrder: 1 },
          { name: '가계장학', sortOrder: 2 },
          { name: '특기장학', sortOrder: 3 },
        ],
      },
      {
        name: '학생활동비',
        sortOrder: 2,
        details: [
          { name: '동아리지원', sortOrder: 1 },
          { name: '학생회비', sortOrder: 2 },
          { name: '체육대회', sortOrder: 3 },
        ],
      },
      {
        name: '진로지원비',
        sortOrder: 3,
        details: [
          { name: '취업지원', sortOrder: 1 },
          { name: '진로상담', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '연구비',
    sortOrder: 5,
    subcategories: [
      {
        name: '학술연구비',
        sortOrder: 1,
        details: [
          { name: '연구프로젝트', sortOrder: 1 },
          { name: '학술행사', sortOrder: 2 },
        ],
      },
      {
        name: '학술지원비',
        sortOrder: 2,
        details: [
          { name: '논문심사', sortOrder: 1 },
          { name: '학술발표', sortOrder: 2 },
          { name: '출판지원', sortOrder: 3 },
        ],
      },
    ],
  },
  {
    name: '시설비',
    sortOrder: 6,
    subcategories: [
      {
        name: '시설유지비',
        sortOrder: 1,
        details: [
          { name: '건물보수', sortOrder: 1 },
          { name: '설비유지', sortOrder: 2 },
          { name: '조경관리', sortOrder: 3 },
        ],
      },
      {
        name: '기자재구입',
        sortOrder: 2,
        details: [
          { name: '비품', sortOrder: 1 },
          { name: '기계기구', sortOrder: 2 },
          { name: '집기', sortOrder: 3 },
        ],
      },
    ],
  },
  {
    name: '기타지출',
    sortOrder: 7,
    subcategories: [
      {
        name: '예비비',
        sortOrder: 1,
        details: [
          { name: '예비비', sortOrder: 1 },
        ],
      },
    ],
  },
];

// ========================================
// 4. 기업 (COMPANY)
// ========================================

const companyCommittees: CommitteeData[] = [
  {
    name: '경영지원본부',
    sortOrder: 1,
    departments: [
      { name: '경영지원팀', sortOrder: 1 },
      { name: '재무팀', sortOrder: 2 },
      { name: '인사팀', sortOrder: 3 },
      { name: '총무팀', sortOrder: 4 },
    ],
  },
  {
    name: '영업본부',
    sortOrder: 2,
    departments: [
      { name: '영업1팀', sortOrder: 1 },
      { name: '영업2팀', sortOrder: 2 },
      { name: '영업지원팀', sortOrder: 3 },
    ],
  },
  {
    name: '마케팅본부',
    sortOrder: 3,
    departments: [
      { name: '마케팅팀', sortOrder: 1 },
      { name: '브랜드팀', sortOrder: 2 },
      { name: '디지털마케팅팀', sortOrder: 3 },
    ],
  },
  {
    name: '개발본부',
    sortOrder: 4,
    departments: [
      { name: '개발1팀', sortOrder: 1 },
      { name: '개발2팀', sortOrder: 2 },
      { name: 'QA팀', sortOrder: 3 },
    ],
  },
  {
    name: '연구소',
    sortOrder: 5,
    departments: [
      { name: '연구1팀', sortOrder: 1 },
      { name: '연구2팀', sortOrder: 2 },
    ],
  },
];

const companyBudgetCategories: BudgetCategoryData[] = [
  {
    name: '인건비',
    sortOrder: 1,
    subcategories: [
      {
        name: '급여',
        sortOrder: 1,
        details: [
          { name: '기본급', sortOrder: 1 },
          { name: '직책수당', sortOrder: 2 },
          { name: '자격수당', sortOrder: 3 },
        ],
      },
      {
        name: '상여금',
        sortOrder: 2,
        details: [
          { name: '정기상여', sortOrder: 1 },
          { name: '성과급', sortOrder: 2 },
          { name: '인센티브', sortOrder: 3 },
        ],
      },
      {
        name: '4대보험',
        sortOrder: 3,
        details: [
          { name: '국민연금', sortOrder: 1 },
          { name: '건강보험', sortOrder: 2 },
          { name: '고용보험', sortOrder: 3 },
          { name: '산재보험', sortOrder: 4 },
        ],
      },
      {
        name: '퇴직급여',
        sortOrder: 4,
        details: [
          { name: '퇴직적립금', sortOrder: 1 },
        ],
      },
    ],
  },
  {
    name: '복리후생비',
    sortOrder: 2,
    subcategories: [
      {
        name: '식대',
        sortOrder: 1,
        details: [
          { name: '중식대', sortOrder: 1 },
          { name: '야근식대', sortOrder: 2 },
        ],
      },
      {
        name: '건강관리',
        sortOrder: 2,
        details: [
          { name: '건강검진', sortOrder: 1 },
          { name: '의료비지원', sortOrder: 2 },
        ],
      },
      {
        name: '경조비',
        sortOrder: 3,
        details: [
          { name: '축의금', sortOrder: 1 },
          { name: '조의금', sortOrder: 2 },
          { name: '출산축하', sortOrder: 3 },
        ],
      },
      {
        name: '복지비',
        sortOrder: 4,
        details: [
          { name: '동호회지원', sortOrder: 1 },
          { name: '휴양시설', sortOrder: 2 },
          { name: '자기계발', sortOrder: 3 },
        ],
      },
    ],
  },
  {
    name: '판매관리비',
    sortOrder: 3,
    subcategories: [
      {
        name: '접대비',
        sortOrder: 1,
        details: [
          { name: '거래처접대', sortOrder: 1 },
          { name: '회의비', sortOrder: 2 },
        ],
      },
      {
        name: '광고선전비',
        sortOrder: 2,
        details: [
          { name: '온라인광고', sortOrder: 1 },
          { name: '오프라인광고', sortOrder: 2 },
          { name: '판촉물', sortOrder: 3 },
        ],
      },
      {
        name: '운반비',
        sortOrder: 3,
        details: [
          { name: '택배비', sortOrder: 1 },
          { name: '운송비', sortOrder: 2 },
        ],
      },
      {
        name: '지급수수료',
        sortOrder: 4,
        details: [
          { name: '수수료', sortOrder: 1 },
          { name: '외주비', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '일반관리비',
    sortOrder: 4,
    subcategories: [
      {
        name: '사무비',
        sortOrder: 1,
        details: [
          { name: '사무용품', sortOrder: 1 },
          { name: '소모품', sortOrder: 2 },
        ],
      },
      {
        name: '통신비',
        sortOrder: 2,
        details: [
          { name: '전화', sortOrder: 1 },
          { name: '인터넷', sortOrder: 2 },
          { name: '우편', sortOrder: 3 },
        ],
      },
      {
        name: '임차료',
        sortOrder: 3,
        details: [
          { name: '사무실임차', sortOrder: 1 },
          { name: '주차장임차', sortOrder: 2 },
        ],
      },
      {
        name: '관리비',
        sortOrder: 4,
        details: [
          { name: '건물관리비', sortOrder: 1 },
          { name: '공과금', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '차량유지비',
    sortOrder: 5,
    subcategories: [
      {
        name: '유류비',
        sortOrder: 1,
        details: [
          { name: '주유비', sortOrder: 1 },
        ],
      },
      {
        name: '수리비',
        sortOrder: 2,
        details: [
          { name: '정비비', sortOrder: 1 },
        ],
      },
      {
        name: '차량보험',
        sortOrder: 3,
        details: [
          { name: '자동차보험', sortOrder: 1 },
        ],
      },
      {
        name: '리스료',
        sortOrder: 4,
        details: [
          { name: '차량리스', sortOrder: 1 },
        ],
      },
    ],
  },
  {
    name: '연구개발비',
    sortOrder: 6,
    subcategories: [
      {
        name: '연구인건비',
        sortOrder: 1,
        details: [
          { name: '연구원인건비', sortOrder: 1 },
        ],
      },
      {
        name: '재료비',
        sortOrder: 2,
        details: [
          { name: '연구재료', sortOrder: 1 },
          { name: '시약', sortOrder: 2 },
        ],
      },
      {
        name: '외주용역비',
        sortOrder: 3,
        details: [
          { name: '연구외주', sortOrder: 1 },
        ],
      },
    ],
  },
  {
    name: '교육훈련비',
    sortOrder: 7,
    subcategories: [
      {
        name: '사내교육',
        sortOrder: 1,
        details: [
          { name: '직무교육', sortOrder: 1 },
          { name: '신입교육', sortOrder: 2 },
        ],
      },
      {
        name: '사외교육',
        sortOrder: 2,
        details: [
          { name: '외부연수', sortOrder: 1 },
          { name: '자격취득', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '기타지출',
    sortOrder: 8,
    subcategories: [
      {
        name: '세금공과',
        sortOrder: 1,
        details: [
          { name: '재산세', sortOrder: 1 },
          { name: '자동차세', sortOrder: 2 },
          { name: '협회비', sortOrder: 3 },
        ],
      },
      {
        name: '예비비',
        sortOrder: 2,
        details: [
          { name: '예비비', sortOrder: 1 },
        ],
      },
    ],
  },
];

// ========================================
// 5. 기타 (OTHER)
// ========================================

const otherCommittees: CommitteeData[] = [
  {
    name: '운영위원회',
    sortOrder: 1,
    departments: [
      { name: '운영팀', sortOrder: 1 },
    ],
  },
  {
    name: '총무부',
    sortOrder: 2,
    departments: [
      { name: '총무팀', sortOrder: 1 },
      { name: '재무팀', sortOrder: 2 },
    ],
  },
  {
    name: '사업부',
    sortOrder: 3,
    departments: [
      { name: '사업팀', sortOrder: 1 },
    ],
  },
];

const otherBudgetCategories: BudgetCategoryData[] = [
  {
    name: '인건비',
    sortOrder: 1,
    subcategories: [
      {
        name: '급여',
        sortOrder: 1,
        details: [
          { name: '직원급여', sortOrder: 1 },
        ],
      },
      {
        name: '4대보험',
        sortOrder: 2,
        details: [
          { name: '사회보험료', sortOrder: 1 },
        ],
      },
      {
        name: '퇴직급여',
        sortOrder: 3,
        details: [
          { name: '퇴직적립금', sortOrder: 1 },
        ],
      },
    ],
  },
  {
    name: '운영비',
    sortOrder: 2,
    subcategories: [
      {
        name: '사무비',
        sortOrder: 1,
        details: [
          { name: '사무용품', sortOrder: 1 },
          { name: '통신비', sortOrder: 2 },
        ],
      },
      {
        name: '관리비',
        sortOrder: 2,
        details: [
          { name: '임차료', sortOrder: 1 },
          { name: '공과금', sortOrder: 2 },
        ],
      },
      {
        name: '회의비',
        sortOrder: 3,
        details: [
          { name: '회의비', sortOrder: 1 },
        ],
      },
    ],
  },
  {
    name: '사업비',
    sortOrder: 3,
    subcategories: [
      {
        name: '프로그램비',
        sortOrder: 1,
        details: [
          { name: '사업비용', sortOrder: 1 },
        ],
      },
      {
        name: '행사비',
        sortOrder: 2,
        details: [
          { name: '행사비용', sortOrder: 1 },
        ],
      },
    ],
  },
  {
    name: '기타지출',
    sortOrder: 4,
    subcategories: [
      {
        name: '예비비',
        sortOrder: 1,
        details: [
          { name: '예비비', sortOrder: 1 },
        ],
      },
    ],
  },
];

// ========================================
// 조직 유형별 기본 데이터 매핑
// ========================================

export const orgTypeDefaults: Record<OrgType, OrgTypeDefaultData> = {
  [OrgType.CHURCH]: {
    committees: churchCommittees,
    budgetCategories: churchBudgetCategories,
  },
  [OrgType.NONPROFIT]: {
    committees: nonprofitCommittees,
    budgetCategories: nonprofitBudgetCategories,
  },
  [OrgType.SCHOOL]: {
    committees: schoolCommittees,
    budgetCategories: schoolBudgetCategories,
  },
  [OrgType.COMPANY]: {
    committees: companyCommittees,
    budgetCategories: companyBudgetCategories,
  },
  [OrgType.OTHER]: {
    committees: otherCommittees,
    budgetCategories: otherBudgetCategories,
  },
};

/**
 * 조직 유형에 따른 기본 데이터 반환
 */
export function getDefaultDataForOrgType(orgType: OrgType): OrgTypeDefaultData {
  return orgTypeDefaults[orgType];
}
