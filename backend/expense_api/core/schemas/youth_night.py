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
