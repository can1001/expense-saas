"""청나잇(youth-night) 라우터. (app/api/youth-night/* 이전, Phase Y)

출석·포인트(Y1) → 퀴즈·랭킹(Y2) → 암송(Y3) → 관리자(Y4) 순으로 확장된다.
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select, union_all, update
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.auth.permissions import PERMISSIONS
from expense_api.core.db.session import get_session
from expense_api.core.dependencies.auth import CurrentUser, get_current_user
from expense_api.core.dependencies.authz import effective_permissions
from expense_api.core.dependencies.tenant import require_tenant_id
from expense_api.core.models.ids import utcnow
from expense_api.core.models.user import User
from expense_api.core.models.youth_night import (
    Attendance,
    Curriculum,
    Lesson,
    Question,
    QuizResponse,
    RecitationSubmission,
    StudentPoints,
)
from expense_api.core.schemas.youth_night import (
    AttendanceCheckRequest,
    AttendanceOut,
    AttendanceUserBriefOut,
    AttendanceWithLessonOut,
    AttendanceWithUserAndLessonOut,
    CurriculumBriefOut,
    CurriculumDeleteRequest,
    CurriculumOut,
    CurriculumUpdateRequest,
    CurriculumWithLessonsCreateRequest,
    LessonAdminCreateRequest,
    LessonAdminUpdateRequest,
    LessonBriefOut,
    LessonCurriculumBriefOut,
    LessonDeleteRequest,
    LessonOut,
    LessonReorderItemOut,
    LessonReorderRequest,
    LessonWithCurriculumOut,
    PointsGrantRequest,
    QuestionAdminCreateRequest,
    QuestionAdminUpdateRequest,
    QuestionOut,
    QuestionReorderRequest,
    QuizAnswerQuestionOut,
    QuizRecentLessonOut,
    QuizRecentQuestionOut,
    QuizRecentResponseOut,
    QuizResponseOut,
    QuizResponseWithQuestionOut,
    QuizSubmitRequest,
    RecitationAdminListItemOut,
    RecitationApproverOut,
    RecitationApproveRequest,
    RecitationLessonBriefOut,
    RecitationSubmitRequest,
    RecitationUserBriefOut,
    RecitationWithFullLessonAndApproverOut,
    RecitationWithLessonAndApproverOut,
    RecitationWithLessonAndUserOut,
    RecitationWithLessonOut,
    StudentPointsCreateLessonOut,
    StudentPointsListLessonOut,
    StudentPointsOut,
    StudentPointsWithCreateLessonOut,
    StudentPointsWithListLessonOut,
)

router = APIRouter()

# pointType 별 부여 규칙 (app/api/youth-night/points/route.ts pointRules 이전)
_POINT_RULES: dict[str, dict] = {
    "ATTENDANCE": {"points": 5, "description": "출석 포인트"},
    "QUIZ_PERFECT": {"points": 15, "description": "퀴즈 만점 포인트"},
    "QUIZ_GOOD": {"points": 10, "description": "퀴즈 우수 포인트"},
    "LESSON_COMPLETE": {"points": 3, "description": "레슨 완료 포인트"},
    "RECITATION": {"points": 0, "description": "암송 포인트", "dynamic": True},
}


async def _lesson_brief(session: AsyncSession, lesson_id: str) -> LessonBriefOut:
    # Attendance/StudentPoints.lessonId 는 Lesson FK — 참조 무결성상 항상 존재한다.
    lesson = await session.get(Lesson, lesson_id)
    curriculum = await session.get(Curriculum, lesson.curriculumId)
    return LessonBriefOut(
        title=lesson.title,
        lessonNumber=lesson.lessonNumber,
        curriculum=CurriculumBriefOut(
            title=curriculum.title if curriculum else "",
            ageGroup=curriculum.ageGroup if curriculum else "",
        ),
    )


# ── POST /attendance — 출석 체크 ─────────────────────────────────────
@router.post("/attendance")
async def check_attendance(
    body: AttendanceCheckRequest,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not body.lessonId:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "lessonId가 필요합니다")

    lesson_stmt = select(Lesson).where(
        Lesson.id == body.lessonId,
        Lesson.tenantId == tenant_id,
        Lesson.isActive == True,  # noqa: E712
        Lesson.publishedAt.is_not(None),
    )
    lesson = (await session.execute(lesson_stmt)).scalars().first()
    if lesson is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "유효하지 않은 레슨입니다")

    existing_stmt = select(Attendance).where(
        Attendance.tenantId == tenant_id,
        Attendance.userId == user.id,
        Attendance.lessonId == body.lessonId,
    )
    existing = (await session.execute(existing_stmt)).scalars().first()
    if existing is not None:
        return {
            "message": "이미 출석 체크되었습니다",
            "attendance": AttendanceOut(**existing.model_dump()).model_dump(),
        }

    attendance = Attendance(tenantId=tenant_id, userId=user.id, lessonId=body.lessonId, isPresent=True)
    session.add(attendance)
    await session.flush()

    existing_point_stmt = select(StudentPoints).where(
        StudentPoints.tenantId == tenant_id,
        StudentPoints.userId == user.id,
        StudentPoints.pointType == "ATTENDANCE",
        StudentPoints.lessonId == body.lessonId,
    )
    existing_point = (await session.execute(existing_point_stmt)).scalars().first()

    points_earned = 0
    if existing_point is None:
        session.add(
            StudentPoints(
                tenantId=tenant_id,
                userId=user.id,
                pointType="ATTENDANCE",
                points=5,
                description=f"{lesson.title} 출석 포인트",
                lessonId=body.lessonId,
            )
        )
        points_earned = 5

    await session.commit()
    await session.refresh(attendance)

    curriculum = await session.get(Curriculum, lesson.curriculumId)
    return {
        "message": "출석 체크가 완료되었습니다",
        "attendance": AttendanceWithUserAndLessonOut(
            **attendance.model_dump(),
            user=AttendanceUserBriefOut(username=user.username),
            lesson=LessonBriefOut(
                title=lesson.title,
                lessonNumber=lesson.lessonNumber,
                curriculum=CurriculumBriefOut(
                    title=curriculum.title if curriculum else "",
                    ageGroup=curriculum.ageGroup if curriculum else "",
                ),
            ),
        ).model_dump(),
        "pointsEarned": points_earned,
    }


# ── GET /attendance — 출석 기록 조회 ─────────────────────────────────
@router.get("/attendance")
async def list_attendance(
    lessonId: str | None = None,
    curriculumId: str | None = None,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if lessonId:
        stmt = select(Attendance).where(
            Attendance.tenantId == tenant_id,
            Attendance.userId == user.id,
            Attendance.lessonId == lessonId,
        )
        attendance = (await session.execute(stmt)).scalars().first()
        if attendance is None:
            return {"attendance": None}
        lesson_brief = await _lesson_brief(session, attendance.lessonId)
        return {
            "attendance": AttendanceWithLessonOut(
                **attendance.model_dump(), lesson=lesson_brief
            ).model_dump()
        }

    stmt = (
        select(Attendance)
        .join(Lesson, Lesson.id == Attendance.lessonId)
        .where(Attendance.tenantId == tenant_id, Attendance.userId == user.id)
    )
    if curriculumId:
        stmt = stmt.where(Lesson.curriculumId == curriculumId)
    stmt = stmt.order_by(Lesson.lessonNumber.asc(), Attendance.attendedAt.desc())

    attendances = (await session.execute(stmt)).scalars().all()
    out = []
    for a in attendances:
        lesson_brief = await _lesson_brief(session, a.lessonId)
        out.append(AttendanceWithLessonOut(**a.model_dump(), lesson=lesson_brief).model_dump())
    return {"attendances": out}


# ── GET /attendance/stats — 출석 통계 조회 ───────────────────────────
@router.get("/attendance/stats")
async def attendance_stats(
    curriculumId: str | None = None,
    ageGroup: str | None = None,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    def _apply_filters(stmt):
        if curriculumId or ageGroup:
            stmt = stmt.join(Lesson, Lesson.id == Attendance.lessonId)
            if curriculumId:
                stmt = stmt.where(Lesson.curriculumId == curriculumId)
            if ageGroup:
                stmt = stmt.join(Curriculum, Curriculum.id == Lesson.curriculumId).where(
                    Curriculum.ageGroup == ageGroup
                )
        return stmt

    user_stmt = _apply_filters(
        select(Attendance.userId, func.count(Attendance.id)).where(
            Attendance.tenantId == tenant_id, Attendance.isPresent == True  # noqa: E712
        )
    ).group_by(Attendance.userId)
    user_rows = (await session.execute(user_stmt)).all()
    user_stats = [{"userId": row[0], "_count": {"id": row[1]}} for row in user_rows]

    lesson_stmt = _apply_filters(
        select(Attendance.lessonId, func.count(Attendance.id)).where(
            Attendance.tenantId == tenant_id, Attendance.isPresent == True  # noqa: E712
        )
    ).group_by(Attendance.lessonId)
    lesson_rows = (await session.execute(lesson_stmt)).all()
    lesson_stats = [{"lessonId": row[0], "_count": {"id": row[1]}} for row in lesson_rows]

    current_user_stats = None
    if curriculumId or ageGroup:
        user_attendance_stmt = _apply_filters(
            select(func.count(Attendance.id)).where(
                Attendance.tenantId == tenant_id,
                Attendance.userId == user.id,
                Attendance.isPresent == True,  # noqa: E712
            )
        )
        user_attendance_count = (await session.execute(user_attendance_stmt)).scalar_one()

        lesson_total_stmt = select(func.count(Lesson.id)).where(
            Lesson.tenantId == tenant_id,
            Lesson.isActive == True,  # noqa: E712
            Lesson.publishedAt.is_not(None),
        )
        if curriculumId:
            lesson_total_stmt = lesson_total_stmt.where(Lesson.curriculumId == curriculumId)
        if ageGroup:
            lesson_total_stmt = lesson_total_stmt.join(
                Curriculum, Curriculum.id == Lesson.curriculumId
            ).where(Curriculum.ageGroup == ageGroup)
        total_lessons_count = (await session.execute(lesson_total_stmt)).scalar_one()

        current_user_stats = {
            "userId": user.id,
            "attendedLessons": user_attendance_count,
            "totalLessons": total_lessons_count,
            "attendanceRate": (
                round((user_attendance_count / total_lessons_count) * 100)
                if total_lessons_count > 0
                else 0
            ),
        }

    return {
        "userStats": user_stats,
        "lessonStats": lesson_stats,
        "currentUserStats": current_user_stats,
    }


# ── GET /points — 포인트 조회 ─────────────────────────────────────────
@router.get("/points")
async def list_points(
    limit: int = Query(50),
    pointType: str | None = None,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    stmt = select(StudentPoints).where(
        StudentPoints.tenantId == tenant_id, StudentPoints.userId == user.id
    )
    if pointType:
        stmt = stmt.where(StudentPoints.pointType == pointType)
    stmt = stmt.order_by(StudentPoints.earnedAt.desc()).limit(limit)
    points = (await session.execute(stmt)).scalars().all()

    recent_points = []
    for p in points:
        lesson_out = None
        if p.lessonId:
            lesson = await session.get(Lesson, p.lessonId)
            if lesson is not None:
                curriculum = await session.get(Curriculum, lesson.curriculumId)
                lesson_out = StudentPointsListLessonOut(
                    id=lesson.id,
                    title=lesson.title,
                    lessonNumber=lesson.lessonNumber,
                    curriculum=CurriculumBriefOut(
                        title=curriculum.title if curriculum else "",
                        ageGroup=curriculum.ageGroup if curriculum else "",
                    ),
                )
        recent_points.append(
            StudentPointsWithListLessonOut(**p.model_dump(), lesson=lesson_out).model_dump()
        )

    total_points = (
        await session.execute(
            select(func.coalesce(func.sum(StudentPoints.points), 0)).where(
                StudentPoints.tenantId == tenant_id, StudentPoints.userId == user.id
            )
        )
    ).scalar_one()

    by_type_rows = (
        await session.execute(
            select(
                StudentPoints.pointType,
                func.sum(StudentPoints.points),
                func.count(StudentPoints.id),
            )
            .where(StudentPoints.tenantId == tenant_id, StudentPoints.userId == user.id)
            .group_by(StudentPoints.pointType)
        )
    ).all()
    points_by_type = [
        {"pointType": row[0], "_sum": {"points": row[1] or 0}, "_count": {"id": row[2]}}
        for row in by_type_rows
    ]

    return {
        "totalPoints": total_points,
        "pointsByType": points_by_type,
        "recentPoints": recent_points,
    }


# ── POST /points — 포인트 부여 (내부 시스템용) ────────────────────────
@router.post("/points")
async def grant_points(
    body: PointsGrantRequest,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not body.pointType or not body.points:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "잘못된 요청 데이터입니다")

    rule = _POINT_RULES.get(body.pointType)
    if rule is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "유효하지 않은 포인트 타입입니다")

    actual_points = body.points if rule.get("dynamic") else rule["points"]

    if body.pointType in ("ATTENDANCE", "LESSON_COMPLETE", "RECITATION") and body.lessonId:
        existing_stmt = select(StudentPoints).where(
            StudentPoints.tenantId == tenant_id,
            StudentPoints.userId == user.id,
            StudentPoints.pointType == body.pointType,
            StudentPoints.lessonId == body.lessonId,
        )
        existing = (await session.execute(existing_stmt)).scalars().first()
        if existing is not None:
            return {
                "message": "이미 해당 활동에 대한 포인트를 받았습니다",
                "points": StudentPointsOut(**existing.model_dump()).model_dump(),
            }

    new_points = StudentPoints(
        tenantId=tenant_id,
        userId=user.id,
        pointType=body.pointType,
        points=actual_points,
        description=body.description or rule["description"],
        lessonId=body.lessonId,
    )
    session.add(new_points)
    await session.commit()
    await session.refresh(new_points)

    lesson_out = None
    if new_points.lessonId:
        lesson = await session.get(Lesson, new_points.lessonId)
        if lesson is not None:
            lesson_out = StudentPointsCreateLessonOut(
                title=lesson.title, lessonNumber=lesson.lessonNumber
            )

    return {
        "message": "포인트가 부여되었습니다",
        "points": StudentPointsWithCreateLessonOut(
            **new_points.model_dump(), lesson=lesson_out
        ).model_dump(),
    }


# ── POST /quiz — 퀴즈 제출 ─────────────────────────────────────────────
@router.post("/quiz")
async def submit_quiz(
    body: QuizSubmitRequest,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not body.lessonId or body.answers is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "잘못된 요청 데이터입니다")

    lesson_stmt = select(Lesson).where(
        Lesson.id == body.lessonId,
        Lesson.tenantId == tenant_id,
        Lesson.isActive == True,  # noqa: E712
        Lesson.publishedAt.is_not(None),
    )
    lesson = (await session.execute(lesson_stmt)).scalars().first()
    if lesson is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "유효하지 않은 레슨입니다")

    questions_stmt = select(Question).where(Question.lessonId == lesson.id).order_by(
        Question.questionNumber.asc()
    )
    questions = (await session.execute(questions_stmt)).scalars().all()
    questions_by_id = {q.id: q for q in questions}

    response_results: list[QuizResponse] = []
    for answer in body.answers:
        question = questions_by_id.get(answer.questionId)
        if question is None:
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR, "퀴즈 제출 처리 중 오류가 발생했습니다"
            )

        is_correct = question.correctAnswer == answer.userAnswer
        score = 10 if is_correct else 0

        existing_stmt = select(QuizResponse).where(
            QuizResponse.tenantId == tenant_id,
            QuizResponse.userId == user.id,
            QuizResponse.questionId == question.id,
        )
        existing = (await session.execute(existing_stmt)).scalars().first()
        if existing is not None:
            existing.userAnswer = answer.userAnswer
            existing.isCorrect = is_correct
            existing.score = score
            existing.submittedAt = utcnow()
            session.add(existing)
            response_results.append(existing)
        else:
            new_response = QuizResponse(
                tenantId=tenant_id,
                userId=user.id,
                questionId=question.id,
                userAnswer=answer.userAnswer,
                isCorrect=is_correct,
                score=score,
            )
            session.add(new_response)
            response_results.append(new_response)

    await session.flush()

    total_score = sum(r.score for r in response_results)
    max_score = len(questions) * 10
    percentage = round((total_score / max_score) * 100) if max_score > 0 else 0

    # 기존 퀴즈 포인트 삭제 (재시도 시)
    await session.execute(
        delete(StudentPoints).where(
            StudentPoints.tenantId == tenant_id,
            StudentPoints.userId == user.id,
            StudentPoints.pointType.in_(["QUIZ_PERFECT", "QUIZ_GOOD"]),
            StudentPoints.lessonId == body.lessonId,
        )
    )

    points_earned = 0
    if percentage == 100:
        session.add(
            StudentPoints(
                tenantId=tenant_id,
                userId=user.id,
                pointType="QUIZ_PERFECT",
                points=15,
                description=f"{lesson.title} 퀴즈 만점 포인트",
                lessonId=body.lessonId,
            )
        )
        points_earned = 15
    elif percentage >= 80:
        session.add(
            StudentPoints(
                tenantId=tenant_id,
                userId=user.id,
                pointType="QUIZ_GOOD",
                points=10,
                description=f"{lesson.title} 퀴즈 우수 포인트 ({percentage}%)",
                lessonId=body.lessonId,
            )
        )
        points_earned = 10

    await session.commit()
    for r in response_results:
        await session.refresh(r)

    return {
        "message": "퀴즈가 제출되었습니다",
        "results": {
            "totalQuestions": len(questions),
            "correctAnswers": sum(1 for r in response_results if r.isCorrect),
            "totalScore": total_score,
            "maxScore": max_score,
            "percentage": percentage,
            "pointsEarned": points_earned,
        },
        "responses": [QuizResponseOut(**r.model_dump()).model_dump() for r in response_results],
    }


# ── GET /quiz — 퀴즈 응답 조회 ─────────────────────────────────────────
@router.get("/quiz")
async def get_quiz_responses(
    lessonId: str | None = None,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not lessonId:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "lessonId가 필요합니다")

    stmt = (
        select(QuizResponse, Question)
        .join(Question, Question.id == QuizResponse.questionId)
        .where(
            QuizResponse.tenantId == tenant_id,
            QuizResponse.userId == user.id,
            Question.tenantId == tenant_id,
            Question.lessonId == lessonId,
        )
        .order_by(Question.questionNumber.asc())
    )
    rows = (await session.execute(stmt)).all()

    responses = [
        QuizResponseWithQuestionOut(
            **response.model_dump(),
            question=QuizAnswerQuestionOut(
                id=question.id,
                questionNumber=question.questionNumber,
                questionText=question.questionText,
                correctAnswer=question.correctAnswer,
                explanation=question.explanation,
            ),
        ).model_dump()
        for response, question in rows
    ]

    total_questions = (
        await session.execute(
            select(func.count(Question.id)).where(
                Question.lessonId == lessonId, Question.tenantId == tenant_id
            )
        )
    ).scalar_one()

    total_score = sum(r.score for r, _ in rows)
    max_score = total_questions * 10
    percentage = round((total_score / max_score) * 100) if total_questions > 0 else 0

    return {
        "responses": responses,
        "statistics": {
            "totalQuestions": total_questions,
            "answeredQuestions": len(rows),
            "correctAnswers": sum(1 for r, _ in rows if r.isCorrect),
            "totalScore": total_score,
            "maxScore": max_score,
            "percentage": percentage,
        },
    }


# ── GET /quiz/stats — 퀴즈 통계 조회 ───────────────────────────────────
@router.get("/quiz/stats")
async def quiz_stats(
    curriculumId: str | None = None,
    ageGroup: str | None = None,
    lessonId: str | None = None,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    stmt = (
        select(QuizResponse, Question, Lesson, Curriculum)
        .join(Question, Question.id == QuizResponse.questionId)
        .join(Lesson, Lesson.id == Question.lessonId)
        .join(Curriculum, Curriculum.id == Lesson.curriculumId)
        .where(QuizResponse.tenantId == tenant_id, QuizResponse.userId == user.id)
    )
    if lessonId:
        stmt = stmt.where(Question.lessonId == lessonId)
    elif curriculumId:
        stmt = stmt.where(Lesson.curriculumId == curriculumId)
    elif ageGroup:
        stmt = stmt.where(Curriculum.ageGroup == ageGroup)

    rows = (await session.execute(stmt)).all()

    lesson_stats: dict[str, dict] = {}
    for response, _question, lesson, curriculum in rows:
        stat = lesson_stats.get(lesson.id)
        if stat is None:
            stat = {
                "lesson": StudentPointsListLessonOut(
                    id=lesson.id,
                    title=lesson.title,
                    lessonNumber=lesson.lessonNumber,
                    curriculum=CurriculumBriefOut(
                        title=curriculum.title, ageGroup=curriculum.ageGroup
                    ),
                ).model_dump(),
                "totalQuestions": 0,
                "correctAnswers": 0,
                "totalScore": 0,
                "maxScore": 0,
            }
            lesson_stats[lesson.id] = stat
        stat["totalQuestions"] += 1
        stat["totalScore"] += response.score
        stat["maxScore"] += 10
        if response.isCorrect:
            stat["correctAnswers"] += 1

    for stat in lesson_stats.values():
        stat["percentage"] = (
            round((stat["totalScore"] / stat["maxScore"]) * 100) if stat["maxScore"] > 0 else 0
        )

    total_questions = len(rows)
    correct_answers = sum(1 for response, *_ in rows if response.isCorrect)
    total_score = sum(response.score for response, *_ in rows)
    max_score = total_questions * 10
    total_stats = {
        "totalLessons": len(lesson_stats),
        "totalQuestions": total_questions,
        "correctAnswers": correct_answers,
        "totalScore": total_score,
        "maxScore": max_score,
        "averagePercentage": round((total_score / max_score) * 100) if max_score > 0 else 0,
    }

    recent_rows = sorted(rows, key=lambda r: r[0].submittedAt, reverse=True)[:10]
    recent_responses = [
        QuizRecentResponseOut(
            **response.model_dump(),
            question=QuizRecentQuestionOut(
                questionNumber=question.questionNumber,
                questionText=question.questionText,
                lesson=QuizRecentLessonOut(title=lesson.title, lessonNumber=lesson.lessonNumber),
            ),
        ).model_dump()
        for response, question, lesson, _curriculum in recent_rows
    ]

    return {
        "totalStats": total_stats,
        "lessonStats": list(lesson_stats.values()),
        "recentResponses": recent_responses,
    }


# ── GET /ranking — 랭킹 조회 ───────────────────────────────────────────
@router.get("/ranking")
async def ranking(
    ageGroup: str | None = None,
    curriculumId: str | None = None,
    limit: int = Query(50),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    has_lesson_filter = bool((ageGroup and ageGroup != "all") or curriculumId)

    def _apply_lesson_filter(stmt, lesson_col):
        if not has_lesson_filter:
            return stmt
        stmt = stmt.join(Lesson, Lesson.id == lesson_col)
        if curriculumId:
            stmt = stmt.where(Lesson.curriculumId == curriculumId)
        if ageGroup and ageGroup != "all":
            stmt = stmt.join(Curriculum, Curriculum.id == Lesson.curriculumId).where(
                Curriculum.ageGroup == ageGroup
            )
        return stmt

    async def _point_breakdown(target_user_id: str) -> dict:
        stmt = _apply_lesson_filter(
            select(
                StudentPoints.pointType,
                func.sum(StudentPoints.points),
                func.count(StudentPoints.id),
            ).where(StudentPoints.tenantId == tenant_id, StudentPoints.userId == target_user_id),
            StudentPoints.lessonId,
        ).group_by(StudentPoints.pointType)
        rows = (await session.execute(stmt)).all()
        return {row[0]: {"points": row[1] or 0, "count": row[2]} for row in rows}

    ranking_stmt = _apply_lesson_filter(
        select(
            StudentPoints.userId,
            func.sum(StudentPoints.points),
            func.count(StudentPoints.id),
        ).where(StudentPoints.tenantId == tenant_id),
        StudentPoints.lessonId,
    )
    ranking_stmt = (
        ranking_stmt.group_by(StudentPoints.userId)
        .order_by(func.sum(StudentPoints.points).desc())
        .limit(limit)
    )
    ranking_rows = (await session.execute(ranking_stmt)).all()

    rankings = []
    for index, (ranking_user_id, total_points, total_count) in enumerate(ranking_rows):
        user_info = await session.get(User, ranking_user_id)
        point_breakdown = await _point_breakdown(ranking_user_id)

        attendance_stmt = _apply_lesson_filter(
            select(func.count(Attendance.id)).where(
                Attendance.tenantId == tenant_id,
                Attendance.userId == ranking_user_id,
                Attendance.isPresent == True,  # noqa: E712
            ),
            Attendance.lessonId,
        )
        attendance_count = (await session.execute(attendance_stmt)).scalar_one()

        quiz_stmt = _apply_lesson_filter(
            select(QuizResponse.isCorrect, func.count(QuizResponse.id))
            .join(Question, Question.id == QuizResponse.questionId)
            .where(
                QuizResponse.tenantId == tenant_id, QuizResponse.userId == ranking_user_id
            ),
            Question.lessonId,
        ).group_by(QuizResponse.isCorrect)
        quiz_rows = (await session.execute(quiz_stmt)).all()
        total_quiz_responses = sum(row[1] for row in quiz_rows)
        correct_answers = next((row[1] for row in quiz_rows if row[0]), 0)
        quiz_accuracy = (
            round((correct_answers / total_quiz_responses) * 100)
            if total_quiz_responses > 0
            else 0
        )

        recitation_stmt = _apply_lesson_filter(
            select(RecitationSubmission.status, func.count(RecitationSubmission.id)).where(
                RecitationSubmission.tenantId == tenant_id,
                RecitationSubmission.userId == ranking_user_id,
            ),
            RecitationSubmission.lessonId,
        ).group_by(RecitationSubmission.status)
        recitation_rows = (await session.execute(recitation_stmt)).all()
        approved_recitations = next(
            (row[1] for row in recitation_rows if row[0] == "APPROVED"), 0
        )
        total_recitations = sum(row[1] for row in recitation_rows)

        rankings.append(
            {
                "rank": index + 1,
                "user": (
                    {
                        "id": user_info.id,
                        "username": user_info.username,
                        "userid": user_info.userid,
                    }
                    if user_info
                    else None
                ),
                "totalPoints": total_points or 0,
                "totalActivities": total_count,
                "pointBreakdown": point_breakdown,
                "stats": {
                    "attendance": attendance_count,
                    "quiz": {
                        "totalResponses": total_quiz_responses,
                        "correctAnswers": correct_answers,
                        "accuracy": quiz_accuracy,
                    },
                    "recitation": {
                        "approved": approved_recitations,
                        "total": total_recitations,
                    },
                },
            }
        )

    current_user_rank = None
    current_user_ranking = next(
        (r for r in rankings if r["user"] and r["user"]["id"] == user.id), None
    )

    if current_user_ranking is None:
        all_ranking_stmt = _apply_lesson_filter(
            select(StudentPoints.userId, func.sum(StudentPoints.points)).where(
                StudentPoints.tenantId == tenant_id
            ),
            StudentPoints.lessonId,
        )
        all_ranking_stmt = all_ranking_stmt.group_by(StudentPoints.userId).order_by(
            func.sum(StudentPoints.points).desc()
        )
        all_rows = (await session.execute(all_ranking_stmt)).all()
        user_rank_index = next(
            (i for i, row in enumerate(all_rows) if row[0] == user.id), None
        )
        if user_rank_index is not None:
            user_points = all_rows[user_rank_index][1] or 0
            point_breakdown = await _point_breakdown(user.id)
            current_user_rank = {
                "rank": user_rank_index + 1,
                "user": {"id": user.id, "username": user.username, "userid": user.userid},
                "totalPoints": user_points,
                "pointBreakdown": point_breakdown,
            }

    total_users = (
        await session.execute(select(func.count(User.id)).where(User.tenantId == tenant_id))
    ).scalar_one()

    return {
        "rankings": rankings,
        "currentUserRank": current_user_rank if current_user_rank is not None else current_user_ranking,
        "totalUsers": total_users,
    }


# ── GET /stats — 전체 통계 조회 ───────────────────────────────────────
@router.get("/stats")
async def youth_night_stats(
    ageGroup: str | None = None,
    curriculumId: str | None = None,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    has_age_filter = bool(ageGroup and ageGroup != "all")
    has_curriculum_filter = bool(curriculumId)
    has_filter = has_age_filter or has_curriculum_filter

    def _apply_curriculum_filter(stmt, join_lesson: bool, lesson_col=None):
        if not has_filter:
            return stmt
        stmt = stmt.join(Lesson, Lesson.id == lesson_col) if join_lesson else stmt
        stmt = stmt.join(Curriculum, Curriculum.id == Lesson.curriculumId)
        if has_curriculum_filter:
            stmt = stmt.where(Curriculum.id == curriculumId)
        if has_age_filter:
            stmt = stmt.where(Curriculum.ageGroup == ageGroup)
        return stmt

    total_users = (
        await session.execute(select(func.count(User.id)).where(User.tenantId == tenant_id))
    ).scalar_one()

    curriculum_stmt = select(func.count(Curriculum.id)).where(
        Curriculum.tenantId == tenant_id,
        Curriculum.isActive == True,  # noqa: E712
        Curriculum.type == "YOUTH_NIGHT",
    )
    if has_age_filter:
        curriculum_stmt = curriculum_stmt.where(Curriculum.ageGroup == ageGroup)
    active_curriculums = (await session.execute(curriculum_stmt)).scalar_one()

    lesson_stmt = select(func.count(Lesson.id)).where(
        Lesson.tenantId == tenant_id,
        Lesson.isActive == True,  # noqa: E712
        Lesson.publishedAt.is_not(None),
    )
    lesson_stmt = _apply_curriculum_filter(lesson_stmt, join_lesson=False, lesson_col=None)
    total_lessons = (await session.execute(lesson_stmt)).scalar_one()

    attendance_stmt = select(func.count(Attendance.id)).where(
        Attendance.tenantId == tenant_id, Attendance.isPresent == True  # noqa: E712
    )
    attendance_stmt = _apply_curriculum_filter(
        attendance_stmt, join_lesson=True, lesson_col=Attendance.lessonId
    )
    total_attendance = (await session.execute(attendance_stmt)).scalar_one()

    quiz_stmt = (
        select(func.count(QuizResponse.id))
        .select_from(QuizResponse)
        .join(Question, Question.id == QuizResponse.questionId)
        .where(QuizResponse.tenantId == tenant_id)
    )
    quiz_stmt = _apply_curriculum_filter(quiz_stmt, join_lesson=True, lesson_col=Question.lessonId)
    total_quiz_responses = (await session.execute(quiz_stmt)).scalar_one()

    recitation_stmt = select(func.count(RecitationSubmission.id)).where(
        RecitationSubmission.tenantId == tenant_id
    )
    recitation_stmt = _apply_curriculum_filter(
        recitation_stmt, join_lesson=True, lesson_col=RecitationSubmission.lessonId
    )
    total_recitations = (await session.execute(recitation_stmt)).scalar_one()

    points_stmt = select(func.coalesce(func.sum(StudentPoints.points), 0)).where(
        StudentPoints.tenantId == tenant_id
    )
    points_stmt = _apply_curriculum_filter(
        points_stmt, join_lesson=True, lesson_col=StudentPoints.lessonId
    )
    total_points = (await session.execute(points_stmt)).scalar_one()

    point_dist_stmt = select(
        StudentPoints.pointType,
        func.sum(StudentPoints.points),
        func.count(StudentPoints.id),
    ).where(StudentPoints.tenantId == tenant_id)
    point_dist_stmt = _apply_curriculum_filter(
        point_dist_stmt, join_lesson=True, lesson_col=StudentPoints.lessonId
    )
    point_dist_rows = (
        await session.execute(point_dist_stmt.group_by(StudentPoints.pointType))
    ).all()
    point_distribution = [
        {"type": row[0], "totalPoints": row[1] or 0, "count": row[2]} for row in point_dist_rows
    ]

    top_learners_stmt = select(StudentPoints.userId, func.sum(StudentPoints.points)).where(
        StudentPoints.tenantId == tenant_id
    )
    top_learners_stmt = _apply_curriculum_filter(
        top_learners_stmt, join_lesson=True, lesson_col=StudentPoints.lessonId
    )
    top_learners_rows = (
        await session.execute(
            top_learners_stmt.group_by(StudentPoints.userId)
            .order_by(func.sum(StudentPoints.points).desc())
            .limit(5)
        )
    ).all()
    top_learners = []
    for learner_user_id, learner_points in top_learners_rows:
        learner_user = await session.get(User, learner_user_id)
        top_learners.append(
            {
                "user": (
                    {"id": learner_user.id, "username": learner_user.username}
                    if learner_user
                    else None
                ),
                "totalPoints": learner_points or 0,
            }
        )

    thirty_days_ago = utcnow() - timedelta(days=30)
    activity_union = union_all(
        select(Attendance.createdAt.label("activity_at")).where(
            Attendance.tenantId == tenant_id,
            Attendance.isPresent == True,  # noqa: E712
            Attendance.createdAt >= thirty_days_ago,
        ),
        select(QuizResponse.submittedAt.label("activity_at")).where(
            QuizResponse.tenantId == tenant_id,
            QuizResponse.submittedAt >= thirty_days_ago,
        ),
        select(RecitationSubmission.createdAt.label("activity_at")).where(
            RecitationSubmission.tenantId == tenant_id,
            RecitationSubmission.createdAt >= thirty_days_ago,
        ),
    ).subquery()
    date_col = func.date(activity_union.c.activity_at)
    daily_stmt = (
        select(date_col.label("date"), func.count().label("activities"))
        .group_by(date_col)
        .order_by(date_col.desc())
        .limit(30)
    )
    daily_rows = (await session.execute(daily_stmt)).all()
    daily_activity = [{"date": row.date, "activities": row.activities} for row in daily_rows]

    return {
        "overview": {
            "totalUsers": total_users,
            "activeCurriculums": active_curriculums,
            "totalLessons": total_lessons,
            "totalAttendance": total_attendance,
            "totalQuizResponses": total_quiz_responses,
            "totalRecitations": total_recitations,
            "totalPoints": total_points,
        },
        "dailyActivity": daily_activity,
        "pointDistribution": point_distribution,
        "topLearners": top_learners,
    }


async def _require_youth_manage(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CurrentUser:
    perms = await effective_permissions(user, session)
    if PERMISSIONS.YOUTH_MANAGE not in perms:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "암송 승인 권한이 없습니다")
    return user


async def _require_youth_manage_curriculum(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CurrentUser:
    perms = await effective_permissions(user, session)
    if PERMISSIONS.YOUTH_MANAGE not in perms:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "권한이 없습니다")
    return user


async def _require_youth_manage_admin(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CurrentUser:
    perms = await effective_permissions(user, session)
    if PERMISSIONS.YOUTH_MANAGE not in perms:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "관리자 권한이 필요합니다.")
    return user


async def _recitation_approver(
    session: AsyncSession, approved_by: str | None
) -> RecitationApproverOut | None:
    if not approved_by:
        return None
    approver = await session.get(User, approved_by)
    return RecitationApproverOut(username=approver.username) if approver else None


# ── POST /recitation — 암송 제출 ───────────────────────────────────────
@router.post("/recitation")
async def submit_recitation(
    body: RecitationSubmitRequest,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not body.lessonId or not body.bibleVerse:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "lessonId와 bibleVerse가 필요합니다")

    if not body.audioUrl and not body.videoUrl and not body.textContent:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "음성, 영상, 또는 텍스트 중 하나는 반드시 제출해야 합니다"
        )

    lesson_stmt = select(Lesson).where(
        Lesson.id == body.lessonId,
        Lesson.tenantId == tenant_id,
        Lesson.isActive == True,  # noqa: E712
        Lesson.publishedAt.is_not(None),
    )
    lesson = (await session.execute(lesson_stmt)).scalars().first()
    if lesson is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "유효하지 않은 레슨입니다")

    lesson_brief = RecitationLessonBriefOut(title=lesson.title, lessonNumber=lesson.lessonNumber)

    existing_stmt = select(RecitationSubmission).where(
        RecitationSubmission.tenantId == tenant_id,
        RecitationSubmission.userId == user.id,
        RecitationSubmission.lessonId == body.lessonId,
    )
    existing = (await session.execute(existing_stmt)).scalars().first()

    if existing is not None:
        existing.bibleVerse = body.bibleVerse
        existing.audioUrl = body.audioUrl
        existing.videoUrl = body.videoUrl
        existing.textContent = body.textContent
        existing.status = "PENDING"
        existing.rejectionReason = None
        existing.submittedAt = utcnow()
        session.add(existing)
        await session.commit()
        await session.refresh(existing)
        return {
            "message": "암송이 재제출되었습니다",
            "submission": RecitationWithLessonOut(
                **existing.model_dump(), lesson=lesson_brief
            ).model_dump(),
        }

    submission = RecitationSubmission(
        tenantId=tenant_id,
        userId=user.id,
        lessonId=body.lessonId,
        bibleVerse=body.bibleVerse,
        audioUrl=body.audioUrl,
        videoUrl=body.videoUrl,
        textContent=body.textContent,
    )
    session.add(submission)
    await session.commit()
    await session.refresh(submission)

    return {
        "message": "암송이 제출되었습니다",
        "submission": RecitationWithLessonOut(
            **submission.model_dump(), lesson=lesson_brief
        ).model_dump(),
    }


# ── GET /recitation — 암송 제출 목록/단건 조회 ─────────────────────────
@router.get("/recitation")
async def list_recitations(
    lessonId: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if lessonId:
        stmt = select(RecitationSubmission).where(
            RecitationSubmission.tenantId == tenant_id,
            RecitationSubmission.userId == user.id,
            RecitationSubmission.lessonId == lessonId,
        )
        submission = (await session.execute(stmt)).scalars().first()
        if submission is None:
            return {"submission": None}

        lesson = await session.get(Lesson, submission.lessonId)
        approver = await _recitation_approver(session, submission.approvedBy)
        return {
            "submission": RecitationWithLessonAndApproverOut(
                **submission.model_dump(),
                lesson=RecitationLessonBriefOut(
                    title=lesson.title if lesson else "",
                    lessonNumber=lesson.lessonNumber if lesson else 0,
                ),
                approver=approver,
            ).model_dump()
        }

    stmt = select(RecitationSubmission).where(
        RecitationSubmission.tenantId == tenant_id, RecitationSubmission.userId == user.id
    )
    if status_filter:
        stmt = stmt.where(RecitationSubmission.status == status_filter)
    stmt = stmt.order_by(RecitationSubmission.submittedAt.desc())
    submissions = (await session.execute(stmt)).scalars().all()

    out = []
    for s in submissions:
        lesson_brief = await _lesson_brief(session, s.lessonId)
        approver = await _recitation_approver(session, s.approvedBy)
        out.append(
            RecitationWithFullLessonAndApproverOut(
                **s.model_dump(), lesson=lesson_brief, approver=approver
            ).model_dump()
        )
    return {"submissions": out}


# ── POST /recitation/approve — 암송 승인/반려 ──────────────────────────
@router.post("/recitation/approve")
async def approve_recitation(
    body: RecitationApproveRequest,
    user: CurrentUser = Depends(_require_youth_manage),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not body.submissionId or body.action not in ("approve", "reject"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "잘못된 요청 데이터입니다")

    if body.action == "approve" and (body.score is None or body.score < 0 or body.score > 100):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "승인 시 0-100 사이의 점수가 필요합니다")

    if body.action == "reject" and not body.rejectionReason:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "반려 시 반려 사유가 필요합니다")

    submission_stmt = select(RecitationSubmission).where(
        RecitationSubmission.id == body.submissionId, RecitationSubmission.tenantId == tenant_id
    )
    submission = (await session.execute(submission_stmt)).scalars().first()
    if submission is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "제출 내용을 찾을 수 없습니다")

    if submission.status != "PENDING":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 처리된 제출입니다")

    lesson = await session.get(Lesson, submission.lessonId)
    submitter = await session.get(User, submission.userId)

    submission.status = "APPROVED" if body.action == "approve" else "REJECTED"
    submission.approvedBy = user.id
    submission.approvedAt = utcnow()
    submission.score = body.score if body.action == "approve" else 0
    submission.rejectionReason = body.rejectionReason if body.action == "reject" else None
    session.add(submission)
    await session.flush()

    points_awarded = 0
    if body.action == "approve":
        if body.score >= 95:
            points_to_award = 25
        elif body.score >= 85:
            points_to_award = 20
        elif body.score >= 75:
            points_to_award = 15
        else:
            points_to_award = 10

        session.add(
            StudentPoints(
                tenantId=tenant_id,
                userId=submission.userId,
                pointType="RECITATION",
                points=points_to_award,
                description=f"{lesson.title if lesson else ''} 암송 인증 ({body.score}점)",
                lessonId=submission.lessonId,
            )
        )
        points_awarded = points_to_award
    else:
        await session.execute(
            delete(StudentPoints).where(
                StudentPoints.tenantId == tenant_id,
                StudentPoints.userId == submission.userId,
                StudentPoints.pointType == "RECITATION",
                StudentPoints.lessonId == submission.lessonId,
            )
        )

    await session.commit()
    await session.refresh(submission)

    return {
        "message": "암송이 승인되었습니다" if body.action == "approve" else "암송이 반려되었습니다",
        "submission": RecitationWithLessonAndUserOut(
            **submission.model_dump(),
            lesson=RecitationLessonBriefOut(
                title=lesson.title if lesson else "",
                lessonNumber=lesson.lessonNumber if lesson else 0,
            ),
            user=RecitationUserBriefOut(username=submitter.username if submitter else ""),
        ).model_dump(),
        "pointsAwarded": points_awarded,
    }


# ── GET /recitation/approve — 승인 대기 중인 암송 목록 조회 ───────────
@router.get("/recitation/approve")
async def list_pending_recitations(
    status_filter: str = Query(default="PENDING", alias="status"),
    ageGroup: str | None = None,
    user: CurrentUser = Depends(_require_youth_manage),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    stmt = select(RecitationSubmission).where(
        RecitationSubmission.tenantId == tenant_id, RecitationSubmission.status == status_filter
    )
    if ageGroup:
        stmt = (
            stmt.join(Lesson, Lesson.id == RecitationSubmission.lessonId)
            .join(Curriculum, Curriculum.id == Lesson.curriculumId)
            .where(Curriculum.ageGroup == ageGroup)
        )
    stmt = stmt.order_by(RecitationSubmission.submittedAt.asc())
    submissions = (await session.execute(stmt)).scalars().all()

    out = []
    for s in submissions:
        submitter = await session.get(User, s.userId)
        lesson_brief = await _lesson_brief(session, s.lessonId)
        approver = await _recitation_approver(session, s.approvedBy)
        out.append(
            RecitationAdminListItemOut(
                **s.model_dump(),
                user=RecitationUserBriefOut(username=submitter.username if submitter else ""),
                lesson=lesson_brief,
                approver=approver,
            ).model_dump()
        )
    return {"submissions": out}


# ── 관리 — 커리큘럼/레슨/문제 (Y4) ────────────────────────────────────────


# ── POST /admin/curriculum — 커리큘럼+레슨 일괄 생성 ────────────────────
@router.post("/admin/curriculum")
async def create_curriculum(
    body: CurriculumWithLessonsCreateRequest,
    user: CurrentUser = Depends(_require_youth_manage_curriculum),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    curriculum = Curriculum(
        tenantId=tenant_id,
        title=body.curriculum.title,
        description=body.curriculum.description or None,
        type="YOUTH_NIGHT",
        ageGroup=body.curriculum.ageGroup,
        startDate=(
            datetime.fromisoformat(body.curriculum.startDate)
            if body.curriculum.startDate
            else None
        ),
        endDate=(
            datetime.fromisoformat(body.curriculum.endDate) if body.curriculum.endDate else None
        ),
        sortOrder=body.curriculum.sortOrder or 0,
        isActive=True,
    )
    session.add(curriculum)
    await session.flush()

    created_lessons: list[Lesson] = []
    for lesson_input in body.lessons:
        lesson = Lesson(
            tenantId=tenant_id,
            curriculumId=curriculum.id,
            title=lesson_input.title,
            description=lesson_input.description or None,
            bibleVerse=lesson_input.bibleVerse or None,
            keyPoint=lesson_input.keyPoint or None,
            content=lesson_input.content or None,
            lessonNumber=lesson_input.lessonNumber,
            isActive=True,
            publishedAt=None,
        )
        session.add(lesson)
        created_lessons.append(lesson)

    await session.commit()
    await session.refresh(curriculum)
    for lesson in created_lessons:
        await session.refresh(lesson)

    return {
        "curriculum": CurriculumOut(**curriculum.model_dump()).model_dump(),
        "lessons": [LessonOut(**lesson.model_dump()).model_dump() for lesson in created_lessons],
    }


# ── PUT /admin/curriculum — 커리큘럼 수정 ────────────────────────────────
@router.put("/admin/curriculum")
async def update_curriculum(
    body: CurriculumUpdateRequest,
    user: CurrentUser = Depends(_require_youth_manage_curriculum),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    data = body.model_dump(exclude_unset=True)
    curriculum_id = data.pop("curriculumId", None)

    stmt = select(Curriculum).where(Curriculum.id == curriculum_id, Curriculum.tenantId == tenant_id)
    curriculum = (await session.execute(stmt)).scalars().first()
    if curriculum is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "커리큘럼 수정에 실패했습니다")

    if "title" in data:
        curriculum.title = data["title"]
    if "description" in data:
        curriculum.description = data["description"] or None
    if "ageGroup" in data:
        curriculum.ageGroup = data["ageGroup"]
    if "startDate" in data:
        curriculum.startDate = datetime.fromisoformat(data["startDate"]) if data["startDate"] else None
    if "endDate" in data:
        curriculum.endDate = datetime.fromisoformat(data["endDate"]) if data["endDate"] else None
    if "sortOrder" in data:
        curriculum.sortOrder = data["sortOrder"]
    if "isActive" in data:
        curriculum.isActive = data["isActive"]

    session.add(curriculum)
    await session.commit()
    await session.refresh(curriculum)
    return CurriculumOut(**curriculum.model_dump()).model_dump()


# ── DELETE /admin/curriculum — 커리큘럼 삭제 ─────────────────────────────
@router.delete("/admin/curriculum")
async def delete_curriculum(
    body: CurriculumDeleteRequest,
    user: CurrentUser = Depends(_require_youth_manage_curriculum),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    stmt = select(Curriculum).where(
        Curriculum.id == body.curriculumId, Curriculum.tenantId == tenant_id
    )
    curriculum = (await session.execute(stmt)).scalars().first()
    if curriculum is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "커리큘럼 삭제에 실패했습니다")

    await session.delete(curriculum)
    await session.commit()
    return {"success": True}


# ── POST /admin/lesson — 레슨 생성 ───────────────────────────────────────
@router.post("/admin/lesson")
async def create_lesson(
    body: LessonAdminCreateRequest,
    user: CurrentUser = Depends(_require_youth_manage_curriculum),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not body.curriculumId or not body.title:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "커리큘럼과 제목은 필수입니다")

    count_stmt = select(func.count(Lesson.id)).where(
        Lesson.curriculumId == body.curriculumId, Lesson.tenantId == tenant_id
    )
    existing_lessons = (await session.execute(count_stmt)).scalar_one()
    next_lesson_number = existing_lessons + 1

    lesson = Lesson(
        tenantId=tenant_id,
        curriculumId=body.curriculumId,
        title=body.title,
        description=body.description or None,
        bibleVerse=body.bibleVerse or None,
        keyPoint=body.keyPoint or None,
        content=body.content or None,
        videoUrl=body.videoUrl or None,
        materialUrl=body.materialUrl or None,
        lessonNumber=next_lesson_number,
        isActive=True,
        publishedAt=None,
    )
    session.add(lesson)
    await session.commit()
    await session.refresh(lesson)

    curriculum = await session.get(Curriculum, lesson.curriculumId)
    return LessonWithCurriculumOut(
        **lesson.model_dump(),
        curriculum=LessonCurriculumBriefOut(
            id=curriculum.id if curriculum else "",
            title=curriculum.title if curriculum else "",
            ageGroup=curriculum.ageGroup if curriculum else "",
        ),
    ).model_dump()


# ── GET /admin/lesson — 레슨 상세 조회 ───────────────────────────────────
@router.get("/admin/lesson")
async def get_lesson_admin(
    lessonId: str | None = None,
    user: CurrentUser = Depends(_require_youth_manage_curriculum),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not lessonId:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "lessonId가 필요합니다")

    stmt = select(Lesson).where(Lesson.id == lessonId, Lesson.tenantId == tenant_id)
    lesson = (await session.execute(stmt)).scalars().first()
    if lesson is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "레슨을 찾을 수 없습니다")

    curriculum = await session.get(Curriculum, lesson.curriculumId)
    return LessonWithCurriculumOut(
        **lesson.model_dump(),
        curriculum=LessonCurriculumBriefOut(
            id=curriculum.id if curriculum else "",
            title=curriculum.title if curriculum else "",
            ageGroup=curriculum.ageGroup if curriculum else "",
        ),
    ).model_dump()


# ── PUT /admin/lesson — 레슨 수정 ────────────────────────────────────────
@router.put("/admin/lesson")
async def update_lesson(
    body: LessonAdminUpdateRequest,
    user: CurrentUser = Depends(_require_youth_manage_curriculum),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    data = body.model_dump(exclude_unset=True)
    lesson_id = data.pop("lessonId", None)

    stmt = select(Lesson).where(Lesson.id == lesson_id, Lesson.tenantId == tenant_id)
    lesson = (await session.execute(stmt)).scalars().first()
    if lesson is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "레슨 수정에 실패했습니다")

    if "curriculumId" in data and data["curriculumId"] != lesson.curriculumId:
        new_curriculum_id = data["curriculumId"]
        count_stmt = select(func.count(Lesson.id)).where(
            Lesson.curriculumId == new_curriculum_id, Lesson.tenantId == tenant_id
        )
        existing_lessons = (await session.execute(count_stmt)).scalar_one()
        lesson.curriculumId = new_curriculum_id
        lesson.lessonNumber = existing_lessons + 1

    if "publishedAt" in data:
        lesson.publishedAt = datetime.fromisoformat(data["publishedAt"]) if data["publishedAt"] else None
    if "title" in data:
        lesson.title = data["title"]
    if "description" in data:
        lesson.description = data["description"]
    if "bibleVerse" in data:
        lesson.bibleVerse = data["bibleVerse"]
    if "keyPoint" in data:
        lesson.keyPoint = data["keyPoint"]
    if "content" in data:
        lesson.content = data["content"]
    if "videoUrl" in data:
        lesson.videoUrl = data["videoUrl"]
    if "materialUrl" in data:
        lesson.materialUrl = data["materialUrl"]

    session.add(lesson)
    await session.commit()
    await session.refresh(lesson)
    return LessonOut(**lesson.model_dump()).model_dump()


# ── PATCH /admin/lesson — 레슨 순서 변경 ─────────────────────────────────
@router.patch("/admin/lesson")
async def reorder_lessons(
    body: LessonReorderRequest,
    user: CurrentUser = Depends(_require_youth_manage_curriculum),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not body.curriculumId or not body.lessonIds:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "curriculumId와 lessonIds 배열이 필요합니다"
        )

    for index, lesson_id in enumerate(body.lessonIds):
        await session.execute(
            update(Lesson)
            .where(Lesson.id == lesson_id, Lesson.tenantId == tenant_id)
            .values(lessonNumber=-(index + 1))
        )
    for index, lesson_id in enumerate(body.lessonIds):
        await session.execute(
            update(Lesson)
            .where(Lesson.id == lesson_id, Lesson.tenantId == tenant_id)
            .values(lessonNumber=index + 1)
        )
    await session.commit()

    lessons_stmt = (
        select(Lesson)
        .where(Lesson.curriculumId == body.curriculumId, Lesson.tenantId == tenant_id)
        .order_by(Lesson.lessonNumber.asc())
    )
    lessons = (await session.execute(lessons_stmt)).scalars().all()

    return {
        "success": True,
        "lessons": [
            LessonReorderItemOut(
                id=lesson.id,
                title=lesson.title,
                lessonNumber=lesson.lessonNumber,
                isActive=lesson.isActive,
                publishedAt=lesson.publishedAt,
            ).model_dump()
            for lesson in lessons
        ],
    }


# ── DELETE /admin/lesson — 레슨 삭제 ─────────────────────────────────────
@router.delete("/admin/lesson")
async def delete_lesson(
    body: LessonDeleteRequest,
    user: CurrentUser = Depends(_require_youth_manage_curriculum),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    stmt = select(Lesson).where(Lesson.id == body.lessonId, Lesson.tenantId == tenant_id)
    lesson = (await session.execute(stmt)).scalars().first()
    if lesson is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "레슨 삭제에 실패했습니다")

    await session.delete(lesson)
    await session.commit()
    return {"success": True}


# ── GET /admin/questions — 레슨별 퀴즈 문제 목록 조회 ────────────────────
@router.get("/admin/questions")
async def list_questions_admin(
    lessonId: str | None = None,
    user: CurrentUser = Depends(_require_youth_manage_admin),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not lessonId:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "lessonId가 필요합니다.")

    stmt = (
        select(Question)
        .where(Question.lessonId == lessonId, Question.tenantId == tenant_id)
        .order_by(Question.questionNumber.asc())
    )
    questions = (await session.execute(stmt)).scalars().all()
    return {"questions": [QuestionOut(**q.model_dump()).model_dump() for q in questions]}


# ── POST /admin/questions — 퀴즈 문제 추가 ───────────────────────────────
@router.post("/admin/questions", status_code=status.HTTP_201_CREATED)
async def create_question(
    body: QuestionAdminCreateRequest,
    user: CurrentUser = Depends(_require_youth_manage_admin),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not body.lessonId or not body.questionText or not body.correctAnswer:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "필수 필드가 누락되었습니다.")

    max_stmt = (
        select(Question.questionNumber)
        .where(Question.lessonId == body.lessonId, Question.tenantId == tenant_id)
        .order_by(Question.questionNumber.desc())
        .limit(1)
    )
    max_number = (await session.execute(max_stmt)).scalar_one_or_none()
    question_number = (max_number or 0) + 1

    question = Question(
        tenantId=tenant_id,
        lessonId=body.lessonId,
        questionText=body.questionText,
        questionType=body.questionType or "MULTIPLE_CHOICE",
        option1=body.option1,
        option2=body.option2,
        option3=body.option3,
        option4=body.option4,
        correctAnswer=body.correctAnswer,
        explanation=body.explanation,
        questionNumber=question_number,
    )
    session.add(question)
    await session.commit()
    await session.refresh(question)
    return {"question": QuestionOut(**question.model_dump()).model_dump()}


# ── PUT /admin/questions — 퀴즈 문제 수정 ────────────────────────────────
@router.put("/admin/questions")
async def update_question(
    body: QuestionAdminUpdateRequest,
    user: CurrentUser = Depends(_require_youth_manage_admin),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    data = body.model_dump(exclude_unset=True)
    question_id = data.pop("id", None)
    if not question_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "문제 ID가 필요합니다.")

    stmt = select(Question).where(Question.id == question_id, Question.tenantId == tenant_id)
    question = (await session.execute(stmt)).scalars().first()
    if question is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "퀴즈 수정에 실패했습니다.")

    for field in (
        "questionText",
        "questionType",
        "option1",
        "option2",
        "option3",
        "option4",
        "correctAnswer",
        "explanation",
    ):
        if field in data:
            setattr(question, field, data[field])

    session.add(question)
    await session.commit()
    await session.refresh(question)
    return {"question": QuestionOut(**question.model_dump()).model_dump()}


# ── DELETE /admin/questions — 퀴즈 문제 삭제 ─────────────────────────────
@router.delete("/admin/questions")
async def delete_question(
    id: str | None = None,
    user: CurrentUser = Depends(_require_youth_manage_admin),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "문제 ID가 필요합니다.")

    stmt = select(Question).where(Question.id == id, Question.tenantId == tenant_id)
    question = (await session.execute(stmt)).scalars().first()
    if question is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "퀴즈 삭제에 실패했습니다.")

    await session.delete(question)
    await session.commit()
    return {"success": True}


# ── POST /admin/questions/reorder — 퀴즈 문제 순서 변경 ──────────────────
@router.post("/admin/questions/reorder")
async def reorder_questions(
    body: QuestionReorderRequest,
    user: CurrentUser = Depends(_require_youth_manage_admin),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if body.questionIds is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "questionIds 배열이 필요합니다.")

    # 유니크 제약(lessonId, questionNumber) 충돌 방지를 위해 임시 음수 번호로 먼저 설정
    # (레슨 순서 변경과 동일한 2단계 기법)
    for index, question_id in enumerate(body.questionIds):
        await session.execute(
            update(Question)
            .where(Question.id == question_id, Question.tenantId == tenant_id)
            .values(questionNumber=-(index + 1))
        )
    for index, question_id in enumerate(body.questionIds):
        await session.execute(
            update(Question)
            .where(Question.id == question_id, Question.tenantId == tenant_id)
            .values(questionNumber=index + 1)
        )
    await session.commit()
    return {"success": True}
