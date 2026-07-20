"""청나잇(youth-night) 라우트 계약 테스트 (Phase Y).

레거시 app/api/youth-night/(attendance|attendance/stats|points|quiz|quiz/stats|
ranking|stats)/route.ts 와의 계약 정합(응답 키·상태코드·중복 방지·테넌트 스코프)을
검증한다. (test_simple_expense_routes.py 픽스처 패턴 재사용)
"""

from datetime import datetime, timezone

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.db.session import get_session
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import User
from expense_api.core.models.youth_night import Curriculum, Lesson, Question
from expense_api.core.security.jwt import hash_password
from expense_api.core.security.rate_limit import _reset_all
from main import app


@pytest_asyncio.fixture
async def client():
    _reset_all()
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine.sync_engine, "connect")
    def _fk_on(dbapi_conn, _rec):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with maker() as s:
        t = Tenant(name="데모", subdomain="demo")
        s.add(t)
        await s.flush()
        s.add(
            User(
                tenantId=t.id,
                userid="student",
                username="학생",
                password=hash_password("pass1234"),
                role="user",
            )
        )
        s.add(
            User(
                tenantId=t.id,
                userid="student2",
                username="학생2",
                password=hash_password("pass1234"),
                role="user",
            )
        )
        curriculum = Curriculum(
            tenantId=t.id,
            title="2026 청나잇 시리즈",
            type="YOUTH_NIGHT",
            ageGroup="MIDDLE",
        )
        s.add(curriculum)
        await s.flush()
        lesson1 = Lesson(
            tenantId=t.id,
            curriculumId=curriculum.id,
            title="1강 사랑",
            lessonNumber=1,
            isActive=True,
            publishedAt=datetime.now(timezone.utc),
        )
        s.add(lesson1)
        s.add(
            Lesson(
                tenantId=t.id,
                curriculumId=curriculum.id,
                title="2강 소망 (미공개)",
                lessonNumber=2,
                isActive=True,
                publishedAt=None,
            )
        )
        await s.flush()
        s.add(
            Question(
                tenantId=t.id,
                lessonId=lesson1.id,
                questionText="사랑은 무엇인가?",
                option1="오래참음",
                option2="시기",
                correctAnswer="1",
                explanation="사랑은 오래 참습니다",
                questionNumber=1,
            )
        )
        s.add(
            Question(
                tenantId=t.id,
                lessonId=lesson1.id,
                questionText="사랑은 성내지 않는다?",
                option1="참",
                option2="거짓",
                correctAnswer="1",
                explanation="사랑은 성내지 않습니다",
                questionNumber=2,
            )
        )
        await s.commit()

    async def _override():
        async with maker() as s:
            yield s

    app.dependency_overrides[get_session] = _override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        c._maker = maker  # type: ignore[attr-defined]
        yield c
    app.dependency_overrides.clear()
    await engine.dispose()


async def _tenant_id(client: AsyncClient) -> str:
    from sqlalchemy import select

    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        row = (await s.execute(select(Tenant.id))).first()
        return row[0]


async def _lesson_id(client: AsyncClient, lesson_number: int = 1) -> str:
    from sqlalchemy import select

    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        row = (
            await s.execute(select(Lesson.id).where(Lesson.lessonNumber == lesson_number))
        ).first()
        return row[0]


async def _login(client: AsyncClient, userid: str = "student", password: str = "pass1234") -> dict:
    r = await client.post("/api/auth/login", json={"userid": userid, "password": password})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


async def test_attendance_check_success_grants_points(client: AsyncClient):
    headers = await _login(client)
    lesson_id = await _lesson_id(client)

    r = await client.post("/api/youth-night/attendance", json={"lessonId": lesson_id}, headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["message"] == "출석 체크가 완료되었습니다"
    assert body["pointsEarned"] == 5
    assert body["attendance"]["lessonId"] == lesson_id
    assert body["attendance"]["isPresent"] is True
    assert body["attendance"]["user"]["username"] == "학생"
    assert body["attendance"]["lesson"]["title"] == "1강 사랑"
    assert body["attendance"]["lesson"]["curriculum"]["ageGroup"] == "MIDDLE"

    points_r = await client.get("/api/youth-night/points", headers=headers)
    assert points_r.status_code == 200
    assert points_r.json()["totalPoints"] == 5


async def test_attendance_check_duplicate_returns_existing(client: AsyncClient):
    headers = await _login(client)
    lesson_id = await _lesson_id(client)

    await client.post("/api/youth-night/attendance", json={"lessonId": lesson_id}, headers=headers)
    r = await client.post("/api/youth-night/attendance", json={"lessonId": lesson_id}, headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["message"] == "이미 출석 체크되었습니다"
    assert "pointsEarned" not in body
    assert "user" not in body["attendance"]

    points_r = await client.get("/api/youth-night/points", headers=headers)
    assert points_r.json()["totalPoints"] == 5  # 중복 출석으로 추가 부여되지 않음


async def test_attendance_check_missing_lesson_id(client: AsyncClient):
    headers = await _login(client)
    r = await client.post("/api/youth-night/attendance", json={}, headers=headers)
    assert r.status_code == 400
    assert r.json()["detail"] == "lessonId가 필요합니다"


async def test_attendance_check_unpublished_lesson_rejected(client: AsyncClient):
    headers = await _login(client)
    lesson_id = await _lesson_id(client, lesson_number=2)
    r = await client.post("/api/youth-night/attendance", json={"lessonId": lesson_id}, headers=headers)
    assert r.status_code == 404
    assert r.json()["detail"] == "유효하지 않은 레슨입니다"


async def test_list_attendance_by_lesson_and_all(client: AsyncClient):
    headers = await _login(client)
    lesson_id = await _lesson_id(client)
    await client.post("/api/youth-night/attendance", json={"lessonId": lesson_id}, headers=headers)

    by_lesson = await client.get(
        f"/api/youth-night/attendance?lessonId={lesson_id}", headers=headers
    )
    assert by_lesson.status_code == 200
    assert by_lesson.json()["attendance"]["lesson"]["lessonNumber"] == 1

    all_r = await client.get("/api/youth-night/attendance", headers=headers)
    assert all_r.status_code == 200
    attendances = all_r.json()["attendances"]
    assert len(attendances) == 1
    assert attendances[0]["lessonId"] == lesson_id


async def test_attendance_stats(client: AsyncClient):
    headers = await _login(client)
    lesson_id = await _lesson_id(client)
    await client.post("/api/youth-night/attendance", json={"lessonId": lesson_id}, headers=headers)

    r = await client.get(
        f"/api/youth-night/attendance/stats?curriculumId={await _curriculum_id(client)}",
        headers=headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["userStats"][0]["_count"]["id"] == 1
    assert body["lessonStats"][0]["_count"]["id"] == 1
    assert body["currentUserStats"]["attendedLessons"] == 1
    assert body["currentUserStats"]["totalLessons"] == 1  # 미공개 레슨 제외
    assert body["currentUserStats"]["attendanceRate"] == 100


async def _curriculum_id(client: AsyncClient) -> str:
    from sqlalchemy import select

    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        row = (await s.execute(select(Curriculum.id))).first()
        return row[0]


async def _question_ids(client: AsyncClient) -> list[str]:
    from sqlalchemy import select

    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        rows = (
            await s.execute(select(Question.id).order_by(Question.questionNumber.asc()))
        ).all()
        return [row[0] for row in rows]


async def test_points_grant_success_and_duplicate(client: AsyncClient):
    headers = await _login(client)
    lesson_id = await _lesson_id(client)

    r = await client.post(
        "/api/youth-night/points",
        json={"pointType": "LESSON_COMPLETE", "points": 3, "lessonId": lesson_id},
        headers=headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["message"] == "포인트가 부여되었습니다"
    assert body["points"]["points"] == 3
    assert body["points"]["lesson"]["title"] == "1강 사랑"

    dup = await client.post(
        "/api/youth-night/points",
        json={"pointType": "LESSON_COMPLETE", "points": 3, "lessonId": lesson_id},
        headers=headers,
    )
    assert dup.status_code == 200
    dup_body = dup.json()
    assert dup_body["message"] == "이미 해당 활동에 대한 포인트를 받았습니다"
    assert "lesson" not in dup_body["points"]


async def test_points_grant_invalid_type_rejected(client: AsyncClient):
    headers = await _login(client)
    r = await client.post(
        "/api/youth-night/points", json={"pointType": "NOT_A_TYPE", "points": 10}, headers=headers
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "유효하지 않은 포인트 타입입니다"


async def test_points_list_aggregates(client: AsyncClient):
    headers = await _login(client)
    lesson_id = await _lesson_id(client)
    await client.post("/api/youth-night/attendance", json={"lessonId": lesson_id}, headers=headers)
    await client.post(
        "/api/youth-night/points",
        json={"pointType": "LESSON_COMPLETE", "points": 3, "lessonId": lesson_id},
        headers=headers,
    )

    r = await client.get("/api/youth-night/points", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["totalPoints"] == 8
    by_type = {row["pointType"]: row for row in body["pointsByType"]}
    assert by_type["ATTENDANCE"]["_sum"]["points"] == 5
    assert by_type["LESSON_COMPLETE"]["_sum"]["points"] == 3
    assert len(body["recentPoints"]) == 2


async def test_quiz_submit_perfect_score_grants_points(client: AsyncClient):
    headers = await _login(client)
    lesson_id = await _lesson_id(client)
    q1, q2 = await _question_ids(client)

    r = await client.post(
        "/api/youth-night/quiz",
        json={"lessonId": lesson_id, "answers": [
            {"questionId": q1, "userAnswer": "1"},
            {"questionId": q2, "userAnswer": "1"},
        ]},
        headers=headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["message"] == "퀴즈가 제출되었습니다"
    assert body["results"]["totalQuestions"] == 2
    assert body["results"]["correctAnswers"] == 2
    assert body["results"]["percentage"] == 100
    assert body["results"]["pointsEarned"] == 15
    assert len(body["responses"]) == 2

    points_r = await client.get("/api/youth-night/points", headers=headers)
    by_type = {row["pointType"]: row for row in points_r.json()["pointsByType"]}
    assert by_type["QUIZ_PERFECT"]["_sum"]["points"] == 15


async def test_quiz_submit_retry_replaces_previous_points(client: AsyncClient):
    headers = await _login(client)
    lesson_id = await _lesson_id(client)
    q1, q2 = await _question_ids(client)

    await client.post(
        "/api/youth-night/quiz",
        json={"lessonId": lesson_id, "answers": [
            {"questionId": q1, "userAnswer": "1"},
            {"questionId": q2, "userAnswer": "1"},
        ]},
        headers=headers,
    )
    r = await client.post(
        "/api/youth-night/quiz",
        json={"lessonId": lesson_id, "answers": [
            {"questionId": q1, "userAnswer": "wrong"},
            {"questionId": q2, "userAnswer": "1"},
        ]},
        headers=headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["results"]["correctAnswers"] == 1
    assert body["results"]["percentage"] == 50
    assert body["results"]["pointsEarned"] == 0

    points_r = await client.get("/api/youth-night/points", headers=headers)
    by_type = {row["pointType"]: row for row in points_r.json()["pointsByType"]}
    assert "QUIZ_PERFECT" not in by_type
    assert "QUIZ_GOOD" not in by_type


async def test_quiz_submit_missing_body_rejected(client: AsyncClient):
    headers = await _login(client)
    r = await client.post("/api/youth-night/quiz", json={}, headers=headers)
    assert r.status_code == 400
    assert r.json()["detail"] == "잘못된 요청 데이터입니다"


async def test_quiz_submit_invalid_question_id_returns_500(client: AsyncClient):
    headers = await _login(client)
    lesson_id = await _lesson_id(client)
    r = await client.post(
        "/api/youth-night/quiz",
        json={"lessonId": lesson_id, "answers": [{"questionId": "not-a-question", "userAnswer": "1"}]},
        headers=headers,
    )
    assert r.status_code == 500
    assert r.json()["detail"] == "퀴즈 제출 처리 중 오류가 발생했습니다"


async def test_quiz_get_requires_lesson_id(client: AsyncClient):
    headers = await _login(client)
    r = await client.get("/api/youth-night/quiz", headers=headers)
    assert r.status_code == 400
    assert r.json()["detail"] == "lessonId가 필요합니다"


async def test_quiz_get_returns_responses_and_statistics(client: AsyncClient):
    headers = await _login(client)
    lesson_id = await _lesson_id(client)
    q1, q2 = await _question_ids(client)
    await client.post(
        "/api/youth-night/quiz",
        json={"lessonId": lesson_id, "answers": [
            {"questionId": q1, "userAnswer": "1"},
            {"questionId": q2, "userAnswer": "wrong"},
        ]},
        headers=headers,
    )

    r = await client.get(f"/api/youth-night/quiz?lessonId={lesson_id}", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert len(body["responses"]) == 2
    assert body["responses"][0]["question"]["questionNumber"] == 1
    assert body["statistics"]["totalQuestions"] == 2
    assert body["statistics"]["correctAnswers"] == 1
    assert body["statistics"]["percentage"] == 50


async def test_quiz_stats_aggregates_by_lesson(client: AsyncClient):
    headers = await _login(client)
    lesson_id = await _lesson_id(client)
    q1, q2 = await _question_ids(client)
    await client.post(
        "/api/youth-night/quiz",
        json={"lessonId": lesson_id, "answers": [
            {"questionId": q1, "userAnswer": "1"},
            {"questionId": q2, "userAnswer": "1"},
        ]},
        headers=headers,
    )

    r = await client.get("/api/youth-night/quiz/stats", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["totalStats"]["totalLessons"] == 1
    assert body["totalStats"]["totalQuestions"] == 2
    assert body["totalStats"]["averagePercentage"] == 100
    assert len(body["lessonStats"]) == 1
    assert body["lessonStats"][0]["lesson"]["title"] == "1강 사랑"
    assert len(body["recentResponses"]) == 2
    assert body["recentResponses"][0]["question"]["lesson"]["title"] == "1강 사랑"


async def test_ranking_orders_by_total_points(client: AsyncClient):
    headers = await _login(client)
    headers2 = await _login(client, userid="student2")
    lesson_id = await _lesson_id(client)

    await client.post("/api/youth-night/attendance", json={"lessonId": lesson_id}, headers=headers)
    await client.post(
        "/api/youth-night/points",
        json={"pointType": "LESSON_COMPLETE", "points": 3, "lessonId": lesson_id},
        headers=headers,
    )
    await client.post("/api/youth-night/attendance", json={"lessonId": lesson_id}, headers=headers2)

    r = await client.get("/api/youth-night/ranking", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert len(body["rankings"]) == 2
    assert body["rankings"][0]["totalPoints"] == 8
    assert body["rankings"][0]["user"]["username"] == "학생"
    assert body["rankings"][0]["rank"] == 1
    assert body["rankings"][0]["stats"]["attendance"] == 1
    assert body["rankings"][1]["totalPoints"] == 5
    assert body["totalUsers"] == 2


async def test_stats_overview_and_daily_activity(client: AsyncClient):
    headers = await _login(client)
    lesson_id = await _lesson_id(client)
    q1, _q2 = await _question_ids(client)
    await client.post("/api/youth-night/attendance", json={"lessonId": lesson_id}, headers=headers)
    await client.post(
        "/api/youth-night/quiz",
        json={"lessonId": lesson_id, "answers": [{"questionId": q1, "userAnswer": "1"}]},
        headers=headers,
    )

    r = await client.get("/api/youth-night/stats", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["overview"]["totalUsers"] == 2
    assert body["overview"]["totalAttendance"] == 1
    assert body["overview"]["totalQuizResponses"] == 1
    assert body["overview"]["activeCurriculums"] == 1
    assert body["overview"]["totalLessons"] == 1  # 미공개 레슨 제외
    assert isinstance(body["dailyActivity"], list)
    assert len(body["dailyActivity"]) >= 1
    assert body["dailyActivity"][0]["activities"] >= 1


# ── 암송 (Y3) ──────────────────────────────────────────────────────────


async def _create_teacher(client: AsyncClient) -> None:
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        tenant_id = await _tenant_id(client)
        s.add(
            User(
                tenantId=tenant_id,
                userid="teacher",
                username="교사",
                password=hash_password("pass1234"),
                role="team_leader",
            )
        )
        await s.commit()


async def test_recitation_submit_success(client: AsyncClient):
    headers = await _login(client)
    lesson_id = await _lesson_id(client)

    r = await client.post(
        "/api/youth-night/recitation",
        json={"lessonId": lesson_id, "bibleVerse": "요한복음 3:16", "textContent": "이렇게..."},
        headers=headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["message"] == "암송이 제출되었습니다"
    assert body["submission"]["status"] == "PENDING"
    assert body["submission"]["lesson"]["title"] == "1강 사랑"
    assert body["submission"]["lesson"]["lessonNumber"] == 1


async def test_recitation_submit_missing_fields_rejected(client: AsyncClient):
    headers = await _login(client)
    r = await client.post("/api/youth-night/recitation", json={}, headers=headers)
    assert r.status_code == 400
    assert r.json()["detail"] == "lessonId와 bibleVerse가 필요합니다"


async def test_recitation_submit_missing_content_rejected(client: AsyncClient):
    headers = await _login(client)
    lesson_id = await _lesson_id(client)
    r = await client.post(
        "/api/youth-night/recitation",
        json={"lessonId": lesson_id, "bibleVerse": "요한복음 3:16"},
        headers=headers,
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "음성, 영상, 또는 텍스트 중 하나는 반드시 제출해야 합니다"


async def test_recitation_submit_unpublished_lesson_rejected(client: AsyncClient):
    headers = await _login(client)
    lesson_id = await _lesson_id(client, lesson_number=2)
    r = await client.post(
        "/api/youth-night/recitation",
        json={"lessonId": lesson_id, "bibleVerse": "요한복음 3:16", "textContent": "이렇게..."},
        headers=headers,
    )
    assert r.status_code == 404
    assert r.json()["detail"] == "유효하지 않은 레슨입니다"


async def test_recitation_resubmit_updates_existing(client: AsyncClient):
    headers = await _login(client)
    lesson_id = await _lesson_id(client)
    await client.post(
        "/api/youth-night/recitation",
        json={"lessonId": lesson_id, "bibleVerse": "요한복음 3:16", "textContent": "초안"},
        headers=headers,
    )

    r = await client.post(
        "/api/youth-night/recitation",
        json={"lessonId": lesson_id, "bibleVerse": "요한복음 3:16-17", "textContent": "수정본"},
        headers=headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["message"] == "암송이 재제출되었습니다"
    assert body["submission"]["bibleVerse"] == "요한복음 3:16-17"
    assert body["submission"]["textContent"] == "수정본"


async def test_recitation_get_by_lesson_id(client: AsyncClient):
    headers = await _login(client)
    lesson_id = await _lesson_id(client)
    await client.post(
        "/api/youth-night/recitation",
        json={"lessonId": lesson_id, "bibleVerse": "요한복음 3:16", "textContent": "이렇게..."},
        headers=headers,
    )

    r = await client.get(f"/api/youth-night/recitation?lessonId={lesson_id}", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["submission"]["lesson"]["title"] == "1강 사랑"
    assert body["submission"]["approver"] is None
    assert "curriculum" not in body["submission"]["lesson"]


async def test_recitation_get_by_lesson_id_no_submission(client: AsyncClient):
    headers = await _login(client)
    lesson_id = await _lesson_id(client)
    r = await client.get(f"/api/youth-night/recitation?lessonId={lesson_id}", headers=headers)
    assert r.status_code == 200
    assert r.json()["submission"] is None


async def test_recitation_list_all(client: AsyncClient):
    headers = await _login(client)
    lesson_id = await _lesson_id(client)
    await client.post(
        "/api/youth-night/recitation",
        json={"lessonId": lesson_id, "bibleVerse": "요한복음 3:16", "textContent": "이렇게..."},
        headers=headers,
    )

    r = await client.get("/api/youth-night/recitation", headers=headers)
    assert r.status_code == 200
    submissions = r.json()["submissions"]
    assert len(submissions) == 1
    assert submissions[0]["lesson"]["curriculum"]["ageGroup"] == "MIDDLE"


async def test_recitation_approve_requires_permission(client: AsyncClient):
    headers = await _login(client)
    r = await client.post(
        "/api/youth-night/recitation/approve",
        json={"submissionId": "anything", "action": "approve", "score": 90},
        headers=headers,
    )
    assert r.status_code == 403
    assert r.json()["detail"] == "암송 승인 권한이 없습니다"


async def test_recitation_approve_success_awards_points(client: AsyncClient):
    headers = await _login(client)
    await _create_teacher(client)
    teacher_headers = await _login(client, userid="teacher")
    lesson_id = await _lesson_id(client)
    submit_r = await client.post(
        "/api/youth-night/recitation",
        json={"lessonId": lesson_id, "bibleVerse": "요한복음 3:16", "textContent": "이렇게..."},
        headers=headers,
    )
    submission_id = submit_r.json()["submission"]["id"]

    r = await client.post(
        "/api/youth-night/recitation/approve",
        json={"submissionId": submission_id, "action": "approve", "score": 90},
        headers=teacher_headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["message"] == "암송이 승인되었습니다"
    assert body["pointsAwarded"] == 20
    assert body["submission"]["status"] == "APPROVED"
    assert body["submission"]["score"] == 90
    assert body["submission"]["lesson"]["title"] == "1강 사랑"
    assert body["submission"]["user"]["username"] == "학생"

    points_r = await client.get("/api/youth-night/points", headers=headers)
    by_type = {row["pointType"]: row for row in points_r.json()["pointsByType"]}
    assert by_type["RECITATION"]["_sum"]["points"] == 20


async def test_recitation_approve_reject_requires_reason(client: AsyncClient):
    headers = await _login(client)
    await _create_teacher(client)
    teacher_headers = await _login(client, userid="teacher")
    lesson_id = await _lesson_id(client)
    submit_r = await client.post(
        "/api/youth-night/recitation",
        json={"lessonId": lesson_id, "bibleVerse": "요한복음 3:16", "textContent": "이렇게..."},
        headers=headers,
    )
    submission_id = submit_r.json()["submission"]["id"]

    r = await client.post(
        "/api/youth-night/recitation/approve",
        json={"submissionId": submission_id, "action": "reject"},
        headers=teacher_headers,
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "반려 시 반려 사유가 필요합니다"

    r2 = await client.post(
        "/api/youth-night/recitation/approve",
        json={"submissionId": submission_id, "action": "reject", "rejectionReason": "발음 불명확"},
        headers=teacher_headers,
    )
    assert r2.status_code == 200
    assert r2.json()["message"] == "암송이 반려되었습니다"
    assert r2.json()["pointsAwarded"] == 0


async def test_recitation_approve_already_processed_rejected(client: AsyncClient):
    headers = await _login(client)
    await _create_teacher(client)
    teacher_headers = await _login(client, userid="teacher")
    lesson_id = await _lesson_id(client)
    submit_r = await client.post(
        "/api/youth-night/recitation",
        json={"lessonId": lesson_id, "bibleVerse": "요한복음 3:16", "textContent": "이렇게..."},
        headers=headers,
    )
    submission_id = submit_r.json()["submission"]["id"]
    await client.post(
        "/api/youth-night/recitation/approve",
        json={"submissionId": submission_id, "action": "approve", "score": 90},
        headers=teacher_headers,
    )

    r = await client.post(
        "/api/youth-night/recitation/approve",
        json={"submissionId": submission_id, "action": "approve", "score": 90},
        headers=teacher_headers,
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "이미 처리된 제출입니다"


async def test_recitation_pending_list(client: AsyncClient):
    headers = await _login(client)
    await _create_teacher(client)
    teacher_headers = await _login(client, userid="teacher")
    lesson_id = await _lesson_id(client)
    await client.post(
        "/api/youth-night/recitation",
        json={"lessonId": lesson_id, "bibleVerse": "요한복음 3:16", "textContent": "이렇게..."},
        headers=headers,
    )

    r = await client.get("/api/youth-night/recitation/approve", headers=teacher_headers)
    assert r.status_code == 200
    submissions = r.json()["submissions"]
    assert len(submissions) == 1
    assert submissions[0]["user"]["username"] == "학생"
    assert submissions[0]["lesson"]["curriculum"]["ageGroup"] == "MIDDLE"


async def test_recitation_pending_list_requires_permission(client: AsyncClient):
    headers = await _login(client)
    r = await client.get("/api/youth-night/recitation/approve", headers=headers)
    assert r.status_code == 403
    assert r.json()["detail"] == "암송 승인 권한이 없습니다"
