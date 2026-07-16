"""Phase 1 검증 — RBAC, 멀티테넌시 격리, 기능 모듈 폴백."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

# 모든 모델 로드 (metadata 등록)
import expense_api.core.models  # noqa: F401
from expense_api.core.auth import permissions as perm
from expense_api.core.models.enums import OrgType, default_modules_for
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import User
from expense_api.core.repository.user_repository import UserRepository


# ── RBAC ──────────────────────────────────────────────────────────────
def test_admin_preset_has_all_permissions():
    perms = perm.resolve_permissions(["admin"])
    assert perms == set(perm.ALL_PERMISSIONS)


def test_user_preset_minimal():
    perms = perm.resolve_permissions(["user"])
    assert perms == {perm.PERMISSIONS.EXPENSE_READ_OWN, perm.PERMISSIONS.EXPENSE_CREATE}


def test_multi_role_union():
    perms = perm.resolve_permissions(["user", "team_leader"])
    assert perm.PERMISSIONS.EXPENSE_APPROVE in perms  # team_leader 로부터


def test_db_resolver_empty_falls_back_to_preset():
    # Role.permissions 가 비어 있으면 코드 프리셋으로 폴백
    resolver = perm.make_db_resolver({"admin": []})
    perms = perm.resolve_permissions(["admin"], resolver=resolver)
    assert perms == set(perm.ALL_PERMISSIONS)


def test_db_resolver_explicit_overrides_preset():
    # DB 에 명시된 권한이 있으면 그것이 정본 (프리셋 무시)
    resolver = perm.make_db_resolver({"user": [perm.PERMISSIONS.EXPENSE_EXPORT]})
    perms = perm.resolve_permissions(["user"], resolver=resolver)
    assert perms == {
        perm.PERMISSIONS.EXPENSE_EXPORT
    }  # user 프리셋(read.own/create) 이 아니라 DB 값


def test_granted_added():
    perms = perm.resolve_permissions(["user"], granted=[perm.PERMISSIONS.USER_REGISTER])
    assert perm.PERMISSIONS.USER_REGISTER in perms


def test_derive_legacy_flags():
    flags = perm.derive_legacy_flags(["admin"])
    assert flags["canApprove"] and flags["canAccessAdmin"] and flags["canExportData"]
    flags_user = perm.derive_legacy_flags(["user"])
    assert not flags_user["canApprove"]


def test_sanitize_permissions_filters_unknown():
    assert perm.sanitize_permissions([perm.PERMISSIONS.EXPENSE_CREATE, "bogus:perm", 123]) == [
        perm.PERMISSIONS.EXPENSE_CREATE
    ]


# ── 기능 모듈 폴백 (§15.3) ────────────────────────────────────────────
def test_module_preset_company():
    mods = default_modules_for("COMPANY")
    assert "tax_invoice" in mods and "offering" not in mods


def test_module_preset_church():
    mods = default_modules_for(OrgType.CHURCH.value)
    assert "offering" in mods and "tax_invoice" not in mods


# ── 멀티테넌시 격리 ───────────────────────────────────────────────────

async def test_tenant_scoped_repo_isolates(session: AsyncSession):
    # 두 테넌트, 각각 사용자 1명
    t1 = Tenant(name="T1", subdomain="t1")
    t2 = Tenant(name="T2", subdomain="t2")
    session.add(t1)
    session.add(t2)
    await session.flush()

    u1 = User(tenantId=t1.id, userid="alice", username="Alice", role="user")
    u2 = User(tenantId=t2.id, userid="bob", username="Bob", role="user")
    session.add(u1)
    session.add(u2)
    await session.flush()

    repo1 = UserRepository(session, t1.id)

    # t1 리포지토리는 자기 사용자만 조회
    assert (await repo1.get(u1.id)) is not None
    assert (await repo1.get(u2.id)) is None  # ★ 타 테넌트 격리
    assert (await repo1.get_by_userid("bob")) is None
    assert (await repo1.count()) == 1


async def test_tenant_scoped_repo_injects_tenant_id(session: AsyncSession):
    t1 = Tenant(name="T1", subdomain="t1")
    session.add(t1)
    await session.flush()

    repo = UserRepository(session, t1.id)
    # tenantId 를 지정하지 않아도 리포지토리가 강제 주입
    created = await repo.add(User(userid="carol", username="Carol", role="user"))
    assert created.tenantId == t1.id


def test_tenant_scoped_repo_requires_tenant_id():
    with pytest.raises(ValueError):
        UserRepository(None, "")  # tenant_id 빈 값 → 거부
