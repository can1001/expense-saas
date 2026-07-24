"""청나잇(youth-night) 모델 (Prisma Curriculum/Lesson/Question/Attendance/
QuizResponse/StudentPoints/RecitationSubmission 이전, Phase Y).

컬럼명 camelCase 보존, tenantId 는 쿼리 최적화용(nullable) — 조회는 반드시
tenant_id 로 스코프한다. enum(CurriculumType/AgeGroup)은 String 저장.
"""

from datetime import datetime

from sqlalchemy import UniqueConstraint, func
from sqlmodel import Field, SQLModel

from expense_api.core.models.enums import pg_enum
from expense_api.core.models.ids import new_id, utcnow


class Curriculum(SQLModel, table=True):
    __tablename__ = "Curriculum"

    id: str = Field(default_factory=new_id, primary_key=True)

    tenantId: str | None = Field(default=None, index=True)

    title: str
    description: str | None = None
    type: str = Field(sa_type=pg_enum("CurriculumType"))
    ageGroup: str = Field(sa_type=pg_enum("AgeGroup"))

    startDate: datetime | None = None
    endDate: datetime | None = None

    isActive: bool = Field(default=True, index=True)
    sortOrder: int = 0

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )


class Lesson(SQLModel, table=True):
    __tablename__ = "Lesson"
    __table_args__ = (UniqueConstraint("curriculumId", "lessonNumber"),)

    id: str = Field(default_factory=new_id, primary_key=True)

    tenantId: str | None = Field(default=None, index=True)

    curriculumId: str = Field(foreign_key="Curriculum.id", ondelete="CASCADE", index=True)

    title: str
    description: str | None = None
    bibleVerse: str | None = None
    keyPoint: str | None = None

    content: str | None = None
    videoUrl: str | None = None
    materialUrl: str | None = None

    lessonNumber: int = Field(index=True)
    isActive: bool = Field(default=True, index=True)
    publishedAt: datetime | None = Field(default=None, index=True)

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )


class Question(SQLModel, table=True):
    __tablename__ = "Question"
    __table_args__ = (UniqueConstraint("lessonId", "questionNumber"),)

    id: str = Field(default_factory=new_id, primary_key=True)

    tenantId: str | None = Field(default=None, index=True)

    lessonId: str = Field(foreign_key="Lesson.id", ondelete="CASCADE", index=True)

    questionText: str
    questionType: str = "MULTIPLE_CHOICE"

    option1: str | None = None
    option2: str | None = None
    option3: str | None = None
    option4: str | None = None

    correctAnswer: str
    explanation: str | None = None

    questionNumber: int = Field(index=True)

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )


class Attendance(SQLModel, table=True):
    __tablename__ = "Attendance"
    __table_args__ = (UniqueConstraint("userId", "lessonId"),)

    id: str = Field(default_factory=new_id, primary_key=True)

    tenantId: str | None = Field(default=None, index=True)

    userId: str = Field(foreign_key="User.id", ondelete="CASCADE", index=True)
    lessonId: str = Field(foreign_key="Lesson.id", ondelete="CASCADE", index=True)

    attendedAt: datetime = Field(
        default_factory=utcnow, index=True, sa_column_kwargs={"server_default": func.now()}
    )
    isPresent: bool = True

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )


class QuizResponse(SQLModel, table=True):
    __tablename__ = "QuizResponse"
    __table_args__ = (UniqueConstraint("userId", "questionId"),)

    id: str = Field(default_factory=new_id, primary_key=True)

    tenantId: str | None = Field(default=None, index=True)

    userId: str = Field(foreign_key="User.id", ondelete="CASCADE", index=True)
    questionId: str = Field(foreign_key="Question.id", ondelete="CASCADE", index=True)

    userAnswer: str
    isCorrect: bool = Field(index=True)
    score: int = 0

    submittedAt: datetime = Field(
        default_factory=utcnow, index=True, sa_column_kwargs={"server_default": func.now()}
    )

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )


class StudentPoints(SQLModel, table=True):
    __tablename__ = "StudentPoints"

    id: str = Field(default_factory=new_id, primary_key=True)

    tenantId: str | None = Field(default=None, index=True)

    userId: str = Field(foreign_key="User.id", ondelete="CASCADE", index=True)

    pointType: str = Field(index=True)
    points: int
    description: str | None = None

    lessonId: str | None = Field(default=None, foreign_key="Lesson.id", index=True)

    earnedAt: datetime = Field(
        default_factory=utcnow, index=True, sa_column_kwargs={"server_default": func.now()}
    )

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )


class RecitationSubmission(SQLModel, table=True):
    __tablename__ = "RecitationSubmission"
    __table_args__ = (UniqueConstraint("userId", "lessonId"),)

    id: str = Field(default_factory=new_id, primary_key=True)

    tenantId: str | None = Field(default=None, index=True)

    userId: str = Field(foreign_key="User.id", ondelete="CASCADE", index=True)
    lessonId: str = Field(foreign_key="Lesson.id", ondelete="CASCADE", index=True)

    bibleVerse: str
    audioUrl: str | None = None
    videoUrl: str | None = None
    textContent: str | None = None

    status: str = Field(default="PENDING", index=True)
    approvedBy: str | None = Field(default=None, foreign_key="User.id", index=True)
    approvedAt: datetime | None = None
    rejectionReason: str | None = None

    score: int = 0

    submittedAt: datetime = Field(
        default_factory=utcnow, index=True, sa_column_kwargs={"server_default": func.now()}
    )

    createdAt: datetime = Field(
        default_factory=utcnow, sa_column_kwargs={"server_default": func.now()}
    )
    updatedAt: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )
