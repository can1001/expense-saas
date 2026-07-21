"""admin 헌금 라우트 계약 테스트. (app/api/admin/offerings(+[id]/batch/template) 컷오버 — D5)"""

from datetime import date

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.db.session import get_session
from expense_api.core.models.offering import Offering
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import User
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
        t2 = Tenant(name="다른테넌트", subdomain="other")
        s.add_all([t, t2])
        await s.flush()
        s.add(
            User(
                tenantId=t.id,
                userid="admin",
                username="관리자",
                password=hash_password("admin123"),
                role="admin",
            )
        )
        s.add(
            User(
                tenantId=t.id,
                userid="user1",
                username="사용자1",
                password=hash_password("user123"),
                role="user",
            )
        )
        s.add(
            User(
                tenantId=t2.id,
                userid="admin2",
                username="관리자2",
                password=hash_password("admin123"),
                role="admin",
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


async def _login(client: AsyncClient, userid: str = "admin", password: str = "admin123") -> dict:
    r = await client.post("/api/auth/login", json={"userid": userid, "password": password})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


async def test_create_offering_single_and_list(client: AsyncClient):
    headers = await _login(client)

    r = await client.post(
        "/api/admin/offerings",
        json={"date": "2026-03-31", "name": "홍길동", "type": "십일조", "amount": 500000},
        headers=headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["offering"]["type"] == "TITHE"
    assert body["offering"]["date"] == "2026-03-31"

    r = await client.get("/api/admin/offerings", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["pagination"]["total"] == 1
    assert data["summary"]["totalAmount"] == 500000
    assert data["summary"]["byType"]["TITHE"]["count"] == 1
    assert data["months"] == ["2026-03"]


async def test_create_offering_requires_required_fields(client: AsyncClient):
    headers = await _login(client)
    r = await client.post("/api/admin/offerings", json={"name": "홍길동"}, headers=headers)
    assert r.status_code == 400
    assert r.json()["detail"] == "날짜, 이름, 헌금종류, 금액은 필수입니다."


async def test_create_offering_batch(client: AsyncClient):
    headers = await _login(client)
    r = await client.post(
        "/api/admin/offerings",
        json={
            "offerings": [
                {"date": "2026-03-31", "name": "홍길동", "type": "TITHE", "amount": 500000},
                {"date": "2026-03-31", "name": "김철수", "type": "감사헌금", "amount": 100000, "memo": "감사"},
            ]
        },
        headers=headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body == {"success": True, "count": 2, "message": "2건의 헌금이 등록되었습니다."}

    r = await client.get("/api/admin/offerings", headers=headers)
    assert r.json()["pagination"]["total"] == 2


async def test_offering_get_update_delete(client: AsyncClient):
    headers = await _login(client)
    r = await client.post(
        "/api/admin/offerings",
        json={"date": "2026-03-31", "name": "홍길동", "type": "십일조", "amount": 500000},
        headers=headers,
    )
    offering_id = r.json()["offering"]["id"]

    r = await client.get(f"/api/admin/offerings/{offering_id}", headers=headers)
    assert r.status_code == 200
    assert r.json()["name"] == "홍길동"

    r = await client.put(
        f"/api/admin/offerings/{offering_id}",
        json={"amount": 600000, "memo": "수정됨"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["offering"]["amount"] == 600000
    assert r.json()["offering"]["memo"] == "수정됨"
    assert r.json()["offering"]["name"] == "홍길동"

    r = await client.delete(f"/api/admin/offerings/{offering_id}", headers=headers)
    assert r.status_code == 200
    assert r.json() == {"success": True, "message": "헌금이 삭제되었습니다."}

    r = await client.get(f"/api/admin/offerings/{offering_id}", headers=headers)
    assert r.status_code == 404
    assert r.json()["detail"] == "헌금 정보를 찾을 수 없습니다."


async def test_offerings_batch_group_and_delete_by_date(client: AsyncClient):
    headers = await _login(client)
    await client.post(
        "/api/admin/offerings",
        json={
            "offerings": [
                {"date": "2026-03-31", "name": "홍길동", "type": "TITHE", "amount": 500000},
                {"date": "2026-03-31", "name": "김철수", "type": "THANKSGIVING", "amount": 100000},
                {"date": "2026-04-05", "name": "이영희", "type": "SPECIAL", "amount": 200000},
            ]
        },
        headers=headers,
    )

    r = await client.get("/api/admin/offerings/batch", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["summary"]["totalBatches"] == 2
    assert data["summary"]["totalOfferings"] == 3
    march_batch = next(b for b in data["batches"] if b["date"] == "2026-03-31")
    assert march_batch["count"] == 2
    assert march_batch["totalAmount"] == 600000

    r = await client.request(
        "DELETE", "/api/admin/offerings/batch", json={"date": "2026-03-31"}, headers=headers
    )
    assert r.status_code == 200
    assert r.json()["deletedCount"] == 2

    r = await client.get("/api/admin/offerings", headers=headers)
    assert r.json()["pagination"]["total"] == 1


async def test_offerings_batch_delete_missing_date(client: AsyncClient):
    headers = await _login(client)
    r = await client.request("DELETE", "/api/admin/offerings/batch", json={}, headers=headers)
    assert r.status_code == 400
    assert r.json()["detail"] == "삭제할 날짜를 지정해주세요."

    r = await client.request(
        "DELETE", "/api/admin/offerings/batch", json={"date": "2026-01-01"}, headers=headers
    )
    assert r.status_code == 404
    assert r.json()["detail"] == "해당 날짜에 삭제할 헌금이 없습니다."


async def test_offerings_template_csv(client: AsyncClient):
    headers = await _login(client)
    r = await client.get("/api/admin/offerings/template", headers=headers)
    assert r.status_code == 200
    assert r.headers["content-type"] == "text/csv;charset=utf-8"
    assert "filename*=UTF-8''" in r.headers["content-disposition"]
    text = r.content.decode("utf-8-sig")
    assert text.startswith("날짜,이름,헌금종류,금액,메모")


async def test_offerings_require_permission(client: AsyncClient):
    headers = await _login(client, "user1", "user123")
    r = await client.get("/api/admin/offerings", headers=headers)
    assert r.status_code == 403
    assert r.json()["detail"] == "권한이 없습니다."


async def test_offering_not_visible_across_tenants(client: AsyncClient):
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        other_tid = (await s.execute(select(Tenant.id).where(Tenant.subdomain == "other"))).scalar_one()
        s.add(
            Offering(
                tenantId=other_tid, date=date(2026, 3, 31), name="타테넌트", type="TITHE", amount=1
            )
        )
        await s.commit()

    headers = await _login(client)
    r = await client.get("/api/admin/offerings", headers=headers)
    assert r.json()["pagination"]["total"] == 0

    async with maker() as s:
        other_offering_id = (
            await s.execute(select(Offering.id).where(Offering.name == "타테넌트"))
        ).scalar_one()

    r = await client.get(f"/api/admin/offerings/{other_offering_id}", headers=headers)
    assert r.status_code == 404
