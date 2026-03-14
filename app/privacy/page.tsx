import { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 - 지출결의서",
  description: "지출결의서 앱 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-6 md:p-10">
        <h1 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-2">
          개인정보처리방침
        </h1>
        <p className="text-center text-blue-500 mb-2">지출결의서 앱</p>
        <p className="text-center text-gray-500 text-sm mb-8">
          시행일: 2026년 1월 1일 | 최종 수정: 2026년 3월
        </p>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg mb-8">
          <p className="text-gray-700">
            <strong>지출결의서</strong> 앱(이하 &quot;앱&quot;)은 이용자의 개인정보를 중요시하며,
            「개인정보 보호법」을 준수하고 있습니다. 본 개인정보처리방침을 통해 이용자가
            제공하는 개인정보가 어떠한 용도와 방식으로 이용되고 있으며, 개인정보 보호를
            위해 어떠한 조치가 취해지고 있는지 알려드립니다.
          </p>
        </div>

        <Section title="1. 수집하는 개인정보 항목">
          <p className="mb-3">앱은 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.</p>
          <h4 className="font-semibold text-gray-800 mt-4 mb-2">필수 수집 항목</h4>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>로그인 정보: 아이디, 비밀번호</li>
            <li>지출 관련 정보: 지출 내역, 금액, 날짜, 사용 목적</li>
          </ul>
          <h4 className="font-semibold text-gray-800 mt-4 mb-2">자동 수집 항목</h4>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>기기 정보: 기기 유형, 운영체제 버전</li>
            <li>앱 사용 기록: 접속 일시, 서비스 이용 기록</li>
          </ul>
        </Section>

        <Section title="2. 개인정보의 수집 및 이용 목적">
          <p className="mb-3">수집한 개인정보는 다음의 목적을 위해 활용됩니다.</p>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>회원 관리: 회원제 서비스 이용에 따른 본인확인, 개인식별</li>
            <li>서비스 제공: 지출결의서 작성, 승인, 조회 등 핵심 기능 제공</li>
            <li>서비스 개선: 서비스 이용 통계 분석 및 품질 개선</li>
          </ul>
        </Section>

        <Section title="3. 개인정보의 보유 및 이용 기간">
          <p className="mb-3">
            이용자의 개인정보는 원칙적으로 개인정보의 수집 및 이용목적이 달성되면
            지체 없이 파기합니다. 단, 관계 법령의 규정에 의하여 보존할 필요가 있는
            경우 해당 법령에서 정한 기간 동안 보관합니다.
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>회원 탈퇴 시: 즉시 파기</li>
            <li>지출 관련 기록: 회계 관련 법령에 따라 5년간 보관</li>
          </ul>
        </Section>

        <Section title="4. 개인정보의 제3자 제공">
          <p className="mb-3">
            앱은 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다.
            다만, 아래의 경우에는 예외로 합니다.
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>이용자가 사전에 동의한 경우</li>
            <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
          </ul>
        </Section>

        <Section title="5. 개인정보의 파기 절차 및 방법">
          <p className="mb-3">
            앱은 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게
            되었을 때에는 지체 없이 해당 개인정보를 파기합니다.
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>전자적 파일 형태: 복구 및 재생이 되지 않도록 기술적 방법을 사용하여 삭제</li>
            <li>종이 문서: 분쇄기로 분쇄하거나 소각</li>
          </ul>
        </Section>

        <Section title="6. 개인정보 보호를 위한 기술적 대책">
          <p className="mb-3">
            앱은 이용자의 개인정보를 안전하게 관리하기 위하여 다음과 같은
            기술적 대책을 강구하고 있습니다.
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>개인정보의 암호화: 비밀번호는 암호화되어 저장 및 관리</li>
            <li>해킹 등에 대비한 대책: SSL/TLS 암호화 통신 사용</li>
            <li>접근 통제: 개인정보에 대한 접근권한 제한</li>
          </ul>
        </Section>

        <Section title="7. 이용자의 권리">
          <p className="mb-3">이용자는 언제든지 다음과 같은 권리를 행사할 수 있습니다.</p>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>개인정보 열람 요구</li>
            <li>오류 등이 있을 경우 정정 요구</li>
            <li>삭제 요구</li>
            <li>처리정지 요구</li>
          </ul>
        </Section>

        <Section title="8. 개인정보 보호책임자">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-gray-700 mb-3">
              앱은 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와
              관련한 이용자의 불만처리 및 피해구제 등을 위하여 아래와 같이
              개인정보 보호책임자를 지정하고 있습니다.
            </p>
            <p className="font-semibold text-gray-800">개인정보 보호책임자</p>
            <ul className="list-disc list-inside text-gray-600 mt-2 space-y-1">
              <li>담당자: 앱 관리자</li>
              <li>연락처: 앱 내 문의하기 기능 이용</li>
            </ul>
          </div>
        </Section>

        <Section title="9. 개인정보처리방침의 변경">
          <p>
            이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른
            변경 내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일
            전부터 앱 내 공지사항을 통하여 고지할 것입니다.
          </p>
        </Section>

        <div className="mt-10 pt-6 border-t border-gray-200 text-center text-gray-500 text-sm">
          <p>&copy; 2026 지출결의서. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-gray-900 pb-2 mb-4 border-b-2 border-blue-500">
        {title}
      </h2>
      <div className="text-gray-600 leading-relaxed">{children}</div>
    </section>
  );
}
