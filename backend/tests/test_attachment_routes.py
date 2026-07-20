"""지출결의서 복제·첨부파일·업로드 라우트 계약 테스트 (B2).

레거시 app/api/expenses/[id]/duplicate, [id]/attachments*, upload/* 와의 계약 정합을
검증한다. Cloudinary 실호출은 cloudinary_service 를 monkeypatch 해 대체한다.
(test_expense_admin_routes.py 픽스처 패턴 재사용)
"""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.db.session import get_session
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import User
from expense_api.core.security.jwt import hash_password
from expense_api.core.security.rate_limit import _reset_all
from expense_api.core.service import cloudinary_service
from main import app


@pytest_asyncio.fixture
async def client(monkeypatch):
    monkeypatch.setattr(cloudinary_service, "is_cloudinary_configured", lambda: True)

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
                userid="admin",
                username="관리자",
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


async def _tenant_id(client: AsyncClient) -> str:
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        row = (await s.execute(select(Tenant.id))).first()
        return row[0]


async def _login(client: AsyncClient, userid: str, password: str) -> dict:
    r = await client.post("/api/auth/login", json={"userid": userid, "password": password})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


async def _create_user(client: AsyncClient, tid: str, *, userid: str, username: str, role: str) -> str:
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        u = User(
            tenantId=tid,
            userid=userid,
            username=username,
            password=hash_password("pass1234"),
            role=role,
        )
        s.add(u)
        await s.commit()
        await s.refresh(u)
        return u.id


def _expense_body(*, committee: str, department: str, applicant: str, request_date: str) -> dict:
    return {
        "committee": committee,
        "department": department,
        "requestDate": request_date,
        "applicantName": applicant,
        "bankName": "국민",
        "accountNumber": "111-222-333",
        "accountHolder": applicant,
        "items": [
            {
                "budgetCategory": "운영비",
                "budgetSubcategory": "회의비",
                "budgetDetail": "다과비",
                "description": "간식 구입",
                "unitPrice": 10000,
                "quantity": 2,
            }
        ],
    }


async def _create_expense(client: AsyncClient, headers: dict, **kwargs) -> dict:
    r = await client.post("/api/expenses", json=_expense_body(**kwargs), headers=headers)
    assert r.status_code == 201
    return r.json()


def _attachment_body(**overrides) -> dict:
    body = {
        "publicId": "expense-receipts/abc123",
        "url": "http://res.cloudinary.com/demo/image/upload/abc123.jpg",
        "secureUrl": "https://res.cloudinary.com/demo/image/upload/abc123.jpg",
        "format": "jpg",
        "fileName": "receipt.jpg",
        "fileSize": 12345,
        "width": 800,
        "height": 600,
    }
    body.update(overrides)
    return body


# ── 복제 ──────────────────────────────────────────────────────────────


async def test_duplicate_copies_items_and_attachments_as_draft(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    expense = await _create_expense(
        client, headers, committee="기획위원회", department="재정팀", applicant="홍길동", request_date="2026-01-10"
    )

    r = await client.post(
        f"/api/expenses/{expense['id']}/attachments", json=_attachment_body(), headers=headers
    )
    assert r.status_code == 201

    r = await client.post(f"/api/expenses/{expense['id']}/duplicate", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["message"] == "지출결의서가 복제되었습니다."
    duplicated = data["expense"]
    assert duplicated["id"] != expense["id"]
    assert duplicated["status"] == "DRAFT"
    assert duplicated["expenseDate"] is None
    assert len(duplicated["items"]) == 1
    assert duplicated["items"][0]["budgetDetail"] == "다과비"
    assert len(duplicated["attachments"]) == 1
    assert duplicated["attachments"][0]["publicId"] == "expense-receipts/abc123"


async def test_duplicate_rejects_other_users_expense(client: AsyncClient):
    tid = await _tenant_id(client)
    admin_headers = await _login(client, "admin", "admin123")
    other_id = await _create_user(client, tid, userid="other", username="다른사람", role="user")
    expense = await _create_expense(
        client, admin_headers, committee="기획위원회", department="재정팀", applicant="홍길동", request_date="2026-01-10"
    )

    other_headers = await _login(client, "other", "pass1234")
    r = await client.post(f"/api/expenses/{expense['id']}/duplicate", headers=other_headers)
    assert r.status_code == 403
    assert r.json()["detail"] == "본인이 작성한 지출결의서만 복제할 수 있습니다."
    assert other_id  # 소유자가 아님을 확인하는 데만 사용


async def test_duplicate_missing_expense_returns_404(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    r = await client.post("/api/expenses/nonexistent-id/duplicate", headers=headers)
    assert r.status_code == 404


# ── 첨부파일 ──────────────────────────────────────────────────────────


async def test_add_and_list_attachments(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    expense = await _create_expense(
        client, headers, committee="기획위원회", department="재정팀", applicant="홍길동", request_date="2026-01-10"
    )

    r = await client.post(
        f"/api/expenses/{expense['id']}/attachments", json=_attachment_body(), headers=headers
    )
    assert r.status_code == 201
    created = r.json()
    assert created["fileName"] == "receipt.jpg"

    r = await client.get(f"/api/expenses/{expense['id']}/attachments", headers=headers)
    assert r.status_code == 200
    listed = r.json()
    assert len(listed) == 1
    assert listed[0]["id"] == created["id"]


async def test_add_attachment_rejects_invalid_format(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    expense = await _create_expense(
        client, headers, committee="기획위원회", department="재정팀", applicant="홍길동", request_date="2026-01-10"
    )
    r = await client.post(
        f"/api/expenses/{expense['id']}/attachments",
        json=_attachment_body(format="exe"),
        headers=headers,
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "유효하지 않은 이미지 형식입니다."


async def test_delete_attachment_removes_row_and_calls_cloudinary(client: AsyncClient, monkeypatch):
    calls = []

    async def _fake_delete(public_id):
        calls.append(public_id)
        return {"result": "ok"}

    monkeypatch.setattr(cloudinary_service, "delete_image", _fake_delete)

    headers = await _login(client, "admin", "admin123")
    expense = await _create_expense(
        client, headers, committee="기획위원회", department="재정팀", applicant="홍길동", request_date="2026-01-10"
    )
    r = await client.post(
        f"/api/expenses/{expense['id']}/attachments", json=_attachment_body(), headers=headers
    )
    attachment_id = r.json()["id"]

    r = await client.delete(
        f"/api/expenses/{expense['id']}/attachments/{attachment_id}", headers=headers
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["cloudinaryDeleted"] is True
    assert calls == ["expense-receipts/abc123"]

    r = await client.get(f"/api/expenses/{expense['id']}/attachments", headers=headers)
    assert r.json() == []


async def test_delete_attachment_not_owned_by_expense_returns_403(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    expense_a = await _create_expense(
        client, headers, committee="기획위원회", department="재정팀", applicant="홍길동", request_date="2026-01-10"
    )
    expense_b = await _create_expense(
        client, headers, committee="기획위원회", department="재정팀", applicant="홍길동", request_date="2026-01-11"
    )
    r = await client.post(
        f"/api/expenses/{expense_a['id']}/attachments", json=_attachment_body(), headers=headers
    )
    attachment_id = r.json()["id"]

    r = await client.delete(
        f"/api/expenses/{expense_b['id']}/attachments/{attachment_id}", headers=headers
    )
    assert r.status_code == 403
    assert r.json()["detail"] == "이 첨부파일은 해당 지출결의서에 속하지 않습니다."


# ── 업로드 ────────────────────────────────────────────────────────────


async def test_upload_file_success(client: AsyncClient, monkeypatch):
    async def _fake_upload(content, file_name):
        assert file_name == "receipt.jpg"
        return {
            "public_id": "expense-receipts/999-receipt.jpg",
            "url": "http://res.cloudinary.com/demo/image/upload/999.jpg",
            "secure_url": "https://res.cloudinary.com/demo/image/upload/999.jpg",
            "format": "jpg",
            "width": 100,
            "height": 100,
            "bytes": 4,
        }

    monkeypatch.setattr(cloudinary_service, "upload_image", _fake_upload)

    headers = await _login(client, "admin", "admin123")
    r = await client.post(
        "/api/upload",
        headers=headers,
        files={"file": ("receipt.jpg", b"jpeg", "image/jpeg")},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"]["publicId"] == "expense-receipts/999-receipt.jpg"
    assert body["data"]["fileName"] == "receipt.jpg"


async def test_upload_file_rejects_disallowed_mime_type(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    r = await client.post(
        "/api/upload",
        headers=headers,
        files={"file": ("virus.exe", b"MZ", "application/octet-stream")},
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "지원하지 않는 파일 형식입니다. 이미지 파일만 업로드 가능합니다."


async def test_upload_delete_success(client: AsyncClient, monkeypatch):
    async def _fake_delete(public_id):
        assert public_id == "expense-receipts/999-receipt.jpg"
        return {"result": "ok"}

    monkeypatch.setattr(cloudinary_service, "delete_image", _fake_delete)

    headers = await _login(client, "admin", "admin123")
    r = await client.request(
        "DELETE",
        "/api/upload/delete",
        headers=headers,
        json={"publicId": "expense-receipts/999-receipt.jpg"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["publicId"] == "expense-receipts/999-receipt.jpg"


async def test_upload_delete_not_found_returns_404(client: AsyncClient, monkeypatch):
    async def _fake_delete(public_id):
        return {"result": "not found"}

    monkeypatch.setattr(cloudinary_service, "delete_image", _fake_delete)

    headers = await _login(client, "admin", "admin123")
    r = await client.request(
        "DELETE",
        "/api/upload/delete",
        headers=headers,
        json={"publicId": "missing-id"},
    )
    assert r.status_code == 404
    assert r.json()["detail"] == "삭제할 이미지를 찾을 수 없습니다."
