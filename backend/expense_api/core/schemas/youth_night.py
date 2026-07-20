"""청나잇(youth-night) 요청/응답 스키마 (Phase Y)."""

from datetime import datetime

from pydantic import BaseModel


class CurriculumBriefOut(BaseModel):
    title: str
    ageGroup: str


class LessonBriefOut(BaseModel):
    title: str
    lessonNumber: int
    curriculum: CurriculumBriefOut


class AttendanceUserBriefOut(BaseModel):
    username: str


class AttendanceOut(BaseModel):
    """include 없이 조회된 Attendance — 이미 출석 체크된 경우의 응답."""

    id: str
    userId: str
    lessonId: str
    attendedAt: datetime
    isPresent: bool
    createdAt: datetime
    updatedAt: datetime


class AttendanceWithLessonOut(AttendanceOut):
    lesson: LessonBriefOut


class AttendanceWithUserAndLessonOut(AttendanceOut):
    user: AttendanceUserBriefOut
    lesson: LessonBriefOut


class AttendanceCheckRequest(BaseModel):
    lessonId: str | None = None


class PointsGrantRequest(BaseModel):
    pointType: str
    points: int | None = None
    description: str | None = None
    lessonId: str | None = None


class StudentPointsListLessonOut(BaseModel):
    id: str
    title: str
    lessonNumber: int
    curriculum: CurriculumBriefOut


class StudentPointsOut(BaseModel):
    """include 없이 조회된 StudentPoints — 중복 부여 거부 응답."""

    id: str
    userId: str
    pointType: str
    points: int
    description: str | None
    lessonId: str | None
    earnedAt: datetime
    createdAt: datetime
    updatedAt: datetime


class StudentPointsWithListLessonOut(StudentPointsOut):
    lesson: StudentPointsListLessonOut | None


class StudentPointsCreateLessonOut(BaseModel):
    title: str
    lessonNumber: int


class StudentPointsWithCreateLessonOut(StudentPointsOut):
    lesson: StudentPointsCreateLessonOut | None


# ── 퀴즈 (Y2) ──────────────────────────────────────────────────────────


class QuizAnswerItem(BaseModel):
    questionId: str | None = None
    userAnswer: str | None = None


class QuizSubmitRequest(BaseModel):
    lessonId: str | None = None
    answers: list[QuizAnswerItem] | None = None


class QuizResponseOut(BaseModel):
    """include 없이 조회된 QuizResponse — 퀴즈 제출 응답."""

    id: str
    userId: str
    questionId: str
    userAnswer: str
    isCorrect: bool
    score: int
    submittedAt: datetime
    createdAt: datetime
    updatedAt: datetime


class QuizAnswerQuestionOut(BaseModel):
    id: str
    questionNumber: int
    questionText: str
    correctAnswer: str
    explanation: str | None


class QuizResponseWithQuestionOut(QuizResponseOut):
    question: QuizAnswerQuestionOut


class QuizRecentLessonOut(BaseModel):
    title: str
    lessonNumber: int


class QuizRecentQuestionOut(BaseModel):
    questionNumber: int
    questionText: str
    lesson: QuizRecentLessonOut


class QuizRecentResponseOut(QuizResponseOut):
    question: QuizRecentQuestionOut


# ── 암송 (Y3) ──────────────────────────────────────────────────────────


class RecitationSubmitRequest(BaseModel):
    lessonId: str | None = None
    bibleVerse: str | None = None
    audioUrl: str | None = None
    videoUrl: str | None = None
    textContent: str | None = None


class RecitationOut(BaseModel):
    """include 없이 조회된 RecitationSubmission."""

    id: str
    userId: str
    lessonId: str
    bibleVerse: str
    audioUrl: str | None
    videoUrl: str | None
    textContent: str | None
    status: str
    approvedBy: str | None
    approvedAt: datetime | None
    rejectionReason: str | None
    score: int
    submittedAt: datetime
    createdAt: datetime
    updatedAt: datetime


class RecitationLessonBriefOut(BaseModel):
    title: str
    lessonNumber: int


class RecitationApproverOut(BaseModel):
    username: str


class RecitationUserBriefOut(BaseModel):
    username: str


class RecitationWithLessonOut(RecitationOut):
    """제출/재제출 응답 — lesson{title,lessonNumber}만 포함."""

    lesson: RecitationLessonBriefOut


class RecitationWithLessonAndApproverOut(RecitationOut):
    """lessonId 단건 조회 응답 — lesson{title,lessonNumber} + approver{username}."""

    lesson: RecitationLessonBriefOut
    approver: RecitationApproverOut | None


class RecitationWithFullLessonAndApproverOut(RecitationOut):
    """전체 제출 목록 조회 응답 — lesson 에 curriculum 까지 포함."""

    lesson: LessonBriefOut
    approver: RecitationApproverOut | None


class RecitationApproveRequest(BaseModel):
    submissionId: str | None = None
    action: str | None = None
    score: int | None = None
    rejectionReason: str | None = None


class RecitationWithLessonAndUserOut(RecitationOut):
    """승인/반려 처리 응답 — lesson{title,lessonNumber} + user{username}."""

    lesson: RecitationLessonBriefOut
    user: RecitationUserBriefOut


class RecitationAdminListItemOut(RecitationOut):
    """승인 대기 목록 조회 응답 — user + lesson(curriculum 포함) + approver."""

    user: RecitationUserBriefOut
    lesson: LessonBriefOut
    approver: RecitationApproverOut | None
