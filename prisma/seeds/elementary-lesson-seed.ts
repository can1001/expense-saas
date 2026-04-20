/**
 * 초등부 교안 업로드 스크립트
 *
 * 실행: npx tsx prisma/seeds/elementary-lesson-seed.ts
 */

import { PrismaClient, AgeGroup } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🏫 초등부 레슨 업로드 시작...\n');

  // 1. 기존 초등부 커리큘럼 찾기 또는 새로 생성
  let curriculum = await prisma.curriculum.findFirst({
    where: {
      ageGroup: AgeGroup.ELEMENTARY,
      type: 'YOUTH_NIGHT',
      isActive: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!curriculum) {
    console.log('📚 기존 초등부 커리큘럼이 없어서 새로 생성합니다...');
    curriculum = await prisma.curriculum.create({
      data: {
        title: '2026년 초등부 청나잇',
        description: '초등부 대상 청나잇 말씀 시리즈',
        type: 'YOUTH_NIGHT',
        ageGroup: AgeGroup.ELEMENTARY,
        isActive: true,
        sortOrder: 0,
      },
    });
    console.log(`✅ 커리큘럼 생성 완료: ${curriculum.title} (ID: ${curriculum.id})\n`);
  } else {
    console.log(`📚 기존 커리큘럼 사용: ${curriculum.title} (ID: ${curriculum.id})\n`);
  }

  // 2. 현재 커리큘럼의 레슨 수 확인 (다음 레슨 번호 결정)
  const existingLessons = await prisma.lesson.count({
    where: { curriculumId: curriculum.id },
  });
  const nextLessonNumber = existingLessons + 1;

  console.log(`📝 현재 레슨 수: ${existingLessons}, 새 레슨 번호: ${nextLessonNumber}\n`);

  // 3. 새 레슨 생성
  const lessonData = {
    curriculumId: curriculum.id,
    title: '스데반이 담대하게 복음을 전했어요!',
    description: '스데반이 죽음 앞에서도 담대하게 복음을 전한 이야기',
    bibleVerse: '사도행전 7:55-60',
    keyPoint: '죽음 앞에서도 담대하게 복음을 전하는 믿음',
    content: `## 오늘의 말씀

📖 사도행전 7:55-60

55 스데반이 성령 충만하여 하늘을 우러러 주목하여 하나님의 영광과 및 예수께서 하나님 우편에 서신 것을 보고
56 말하되 보라 하늘이 열리고 인자가 하나님 우편에 서신 것을 보노라 한대
57 그들이 큰 소리를 지르며 귀를 막고 일제히 그에게 달려들어
58 성 밖으로 내치고 돌로 칠새 증인들이 옷을 벗어 사울이라 하는 청년의 발 앞에 두니라
59 그들이 돌로 스데반을 치니 스데반이 부르짖어 이르되 주 예수여 내 영혼을 받으시옵소서 하고
60 무릎을 꿇고 크게 불러 이르되 주여 이 죄를 그들에게 돌리지 마옵소서 이 말을 하고 자니라

---

## 질문 1

법정에서 스데반이 사람들을 향하여 '여러분은 하나님을 반역했습니다.' 말했을 때 사람들은 화가나서 스데반을 성 밖으로 끌고 갔어. 하나님을 반역했다는 의미는 무엇이고, 이 사람들은 왜 화가 났을까?

**힌트**: 예수님을 박해하고 죽인것 / 자신들은 하나님을 잘 섬기고 있다고 생각했기 때문

*하나님을 반역했다는 것은 하나님이 보내신 예수님을 박해하고 죽인 것을 의미합니다. 이 사람들은 자신들이 하나님을 잘 섬기고 있다고 생각했는데, 스데반이 그들의 잘못을 지적하자 자존심이 상하고 분노하여 스데반을 성 밖으로 끌고 나갔습니다.*

## 질문 2

스데반이 죽음 앞에서도 용기 있게 복음을 전할 수 있던 이유는 무엇이었을까?

**힌트**: 하나님이 죽음보다 강하고 위대한 분인 것을 알고 믿었고, 복음의 가치가 자신에게 가장 중요한 것이었기 때문

*스데반은 하나님이 죽음보다 강하고 위대한 분임을 알고 믿었습니다. 또한 복음의 가치가 자신의 생명보다 더 중요하다고 생각했기 때문에 두려움 없이 담대하게 복음을 전할 수 있었습니다. 성령 충만함으로 하늘이 열리고 예수님이 하나님 우편에 서 계신 것을 본 스데반은 죽음 앞에서도 흔들리지 않았습니다.*
`,
    lessonNumber: nextLessonNumber,
    isActive: true,
    publishedAt: null, // 기본적으로 비공개, 관리자가 나중에 공개 처리
  };

  // 동일한 제목의 레슨이 있는지 확인
  const existingLesson = await prisma.lesson.findFirst({
    where: {
      curriculumId: curriculum.id,
      title: lessonData.title,
    },
  });

  if (existingLesson) {
    console.log(`⚠️  이미 동일한 제목의 레슨이 존재합니다: "${existingLesson.title}" (ID: ${existingLesson.id})`);
    console.log('   기존 레슨을 업데이트하지 않습니다. 새로운 레슨을 추가하려면 제목을 변경해주세요.\n');
  } else {
    const newLesson = await prisma.lesson.create({
      data: lessonData,
    });

    console.log('✅ 새 레슨 생성 완료!');
    console.log(`   📖 제목: ${newLesson.title}`);
    console.log(`   📜 성경구절: ${newLesson.bibleVerse}`);
    console.log(`   💡 핵심포인트: ${newLesson.keyPoint}`);
    console.log(`   🔢 레슨 번호: ${newLesson.lessonNumber}`);
    console.log(`   🆔 ID: ${newLesson.id}`);
    console.log(`   📅 생성일: ${newLesson.createdAt.toISOString()}\n`);
  }

  // 4. 최종 확인 - 커리큘럼의 모든 레슨 목록 출력
  const allLessons = await prisma.lesson.findMany({
    where: { curriculumId: curriculum.id },
    orderBy: { lessonNumber: 'asc' },
    select: {
      id: true,
      lessonNumber: true,
      title: true,
      bibleVerse: true,
      publishedAt: true,
    },
  });

  console.log(`📋 ${curriculum.title} 커리큘럼의 모든 레슨:`);
  console.log('─'.repeat(60));
  for (const lesson of allLessons) {
    const status = lesson.publishedAt ? '✅ 공개' : '🔒 비공개';
    console.log(`   ${lesson.lessonNumber}. ${lesson.title} (${lesson.bibleVerse}) [${status}]`);
  }
  console.log('─'.repeat(60));
  console.log(`\n총 ${allLessons.length}개 레슨\n`);
}

main()
  .catch((error) => {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
