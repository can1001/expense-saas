/**
 * 청나잇 레슨 콘텐츠를 단계별 학습 형태로 파싱하는 유틸리티
 */

export interface LessonStep {
  type: 'scripture' | 'question' | 'keypoint';
  title: string;
  content: string;
  hint?: string;  // 질문의 경우 답/힌트
}

/**
 * 마크다운 콘텐츠에서 질문과 힌트를 추출
 * 패턴: ### 질문 N 또는 **질문 N** 형식
 * 힌트: *이탤릭 텍스트* 형식
 */
function extractQuestions(content: string): { question: string; hint?: string }[] {
  const questions: { question: string; hint?: string }[] = [];

  // 질문 패턴: ### 질문 N, ## 질문 N, **질문 N**, 질문 N: 등
  const questionPatterns = [
    /###?\s*질문\s*(\d+)[.:]?\s*\n([\s\S]*?)(?=###?\s*질문|\*\*질문|$)/gi,
    /\*\*질문\s*(\d+)[.:]?\*\*\s*\n?([\s\S]*?)(?=\*\*질문|###?\s*질문|$)/gi,
  ];

  // 먼저 ### 질문 패턴 시도
  let matches = [...content.matchAll(/###?\s*질문\s*\d+[.:]?\s*\n([\s\S]*?)(?=###?\s*질문\s*\d+|$)/gi)];

  if (matches.length === 0) {
    // **질문** 패턴 시도
    matches = [...content.matchAll(/\*\*질문\s*\d+[.:]?\*\*\s*\n?([\s\S]*?)(?=\*\*질문\s*\d+|\n##|$)/gi)];
  }

  if (matches.length === 0) {
    // 간단한 "질문 N:" 패턴 시도
    matches = [...content.matchAll(/질문\s*\d+[.:]\s*([\s\S]*?)(?=질문\s*\d+[.:]|$)/gi)];
  }

  for (const match of matches) {
    const questionContent = match[1] || match[0];
    const { mainText, hint } = extractHint(questionContent.trim());

    if (mainText) {
      questions.push({
        question: mainText,
        hint: hint,
      });
    }
  }

  return questions;
}

/**
 * 텍스트에서 힌트(이탤릭 텍스트)를 추출
 * 패턴: *힌트 텍스트* 또는 _힌트 텍스트_
 */
function extractHint(text: string): { mainText: string; hint?: string } {
  // 이탤릭 텍스트 패턴 (*텍스트* 또는 _텍스트_)
  const italicPattern = /\*([^*]+)\*|_([^_]+)_/g;
  const hints: string[] = [];

  let mainText = text;
  let match;

  while ((match = italicPattern.exec(text)) !== null) {
    const hintText = match[1] || match[2];
    if (hintText && hintText.length > 10) {
      hints.push(hintText.trim());
    }
  }

  // 힌트 텍스트 제거
  if (hints.length > 0) {
    mainText = text.replace(italicPattern, '').trim();
    // 빈 줄 정리
    mainText = mainText.replace(/\n{3,}/g, '\n\n').trim();
  }

  return {
    mainText,
    hint: hints.length > 0 ? hints.join('\n\n') : undefined,
  };
}

/**
 * "## 오늘의 말씀" 또는 "## 성경 본문" 섹션 추출
 */
function extractScriptureSection(content: string): string | null {
  // ## 오늘의 말씀 또는 ## 성경 본문 패턴
  const scripturePattern = /##\s*(오늘의\s*말씀|성경\s*본문)[:\s]*\n?([\s\S]*?)(?=##\s*질문|###\s*질문|\*\*질문|$)/i;
  const match = content.match(scripturePattern);

  if (match && match[2]) {
    return match[2].trim();
  }

  // 패턴이 없으면 첫 번째 질문 전까지의 내용을 반환
  const beforeQuestion = content.split(/##\s*질문|###\s*질문|\*\*질문/i)[0];
  if (beforeQuestion && beforeQuestion.trim().length > 20) {
    return beforeQuestion.trim();
  }

  return null;
}

/**
 * 레슨 콘텐츠를 단계별로 파싱
 */
export function parseLessonContent(
  content: string | null,
  bibleVerse: string | null,
  keyPoint: string | null
): LessonStep[] {
  const steps: LessonStep[] = [];

  // Step 1: 오늘의 말씀 (성경 구절)
  if (bibleVerse || content) {
    const scriptureContent = content ? extractScriptureSection(content) : null;

    steps.push({
      type: 'scripture',
      title: '오늘의 말씀',
      content: [
        bibleVerse ? `📖 ${bibleVerse}` : '',
        scriptureContent || '',
      ].filter(Boolean).join('\n\n'),
    });
  }

  // Step 2~N: 질문들
  if (content) {
    const questions = extractQuestions(content);

    questions.forEach((q, index) => {
      steps.push({
        type: 'question',
        title: `질문 ${index + 1}`,
        content: q.question,
        hint: q.hint,
      });
    });
  }

  // 마지막 Step: 핵심 포인트
  if (keyPoint) {
    steps.push({
      type: 'keypoint',
      title: '핵심 포인트',
      content: keyPoint,
    });
  }

  // 최소 1개의 step이 있어야 함
  if (steps.length === 0 && content) {
    // 파싱된 내용이 없으면 전체 내용을 하나의 step으로
    steps.push({
      type: 'scripture',
      title: '레슨 내용',
      content: content,
    });
  }

  return steps;
}

/**
 * Step 타입별 아이콘 반환
 */
export function getStepIcon(type: LessonStep['type']): string {
  switch (type) {
    case 'scripture':
      return '📖';
    case 'question':
      return '❓';
    case 'keypoint':
      return '💡';
    default:
      return '📝';
  }
}

/**
 * Step 타입별 색상 클래스 반환
 */
export function getStepColorClass(type: LessonStep['type']): string {
  switch (type) {
    case 'scripture':
      return 'bg-blue-50 border-blue-200';
    case 'question':
      return 'bg-purple-50 border-purple-200';
    case 'keypoint':
      return 'bg-yellow-50 border-yellow-200';
    default:
      return 'bg-gray-50 border-gray-200';
  }
}
