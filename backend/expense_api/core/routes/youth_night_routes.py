"""청나잇(youth-night) 라우터. (app/api/youth-night/* 이전, Phase Y)

출석·포인트(Y1) → 퀴즈·랭킹(Y2) → 암송(Y3) → 관리자(Y4) 순으로 확장된다.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.db.session import get_session
from expense_api.core.dependencies.auth import CurrentUser, get_current_user
from expense_api.core.dependencies.tenant import require_tenant_id
from expense_api.core.models.youth_night import Attendance, Curriculum, Lesson, StudentPoints
from expense_api.core.schemas.youth_night import (
    AttendanceCheckRequest,
    AttendanceOut,
    AttendanceUserBriefOut,
    AttendanceWithLessonOut,
    AttendanceWithUserAndLessonOut,
    CurriculumBriefOut,
    LessonBriefOut,
    PointsGrantRequest,
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
