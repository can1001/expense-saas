"""청나잇(youth-night) 라우트 계약 테스트 (Phase Y).

레거시 app/api/youth-night/(attendance|attendance/stats|points)/route.ts 와의
계약 정합(응답 키·상태코드·중복 방지·테넌트 스코프)을 검증한다.
(test_simple_expense_routes.py 픽스처 패턴 재사용)
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
from expense_api.core.models.youth_night import Curriculum, Lesson
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
        curriculum = Curriculum(
            tenantId=t.id,
            title="2026 청나잇 시리즈",
            type="YOUTH_NIGHT",
            ageGroup="MIDDLE",
        )
        s.add(curriculum)
        await s.flush()
        s.add(
            Lesson(
                tenantId=t.id,
                curriculumId=curriculum.id,
                title="1강 사랑",
                lessonNumber=1,
                isActive=True,
                publishedAt=datetime.now(timezone.utc),
            )
        )
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
