"""사용자 목록·생성·상세·수정·비활성화 라우터.
(app/api/users/route.ts, app/api/users/[id]/route.ts 이전)
"""

import math
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.auth.permissions import ROLE_CODES, PERMISSIONS
from expense_api.core.db.session import get_session
from expense_api.core.dependencies.authz import require_permission
from expense_api.core.dependencies.tenant import require_tenant_id
from expense_api.core.models.user import Membership, Role, User, UserYearRole
from expense_api.core.security.jwt import hash_password

router = APIRouter()

DEFAULT_PASSWORD = "chc2026"


def _membership_role(role_code: str) -> str:
    return "TENANT_ADMIN" if role_code == "admin" else "MEMBER"


async def _get_role_by_code(session: AsyncSession, tenant_id: str, code: str) -> Role | None:
    stmt = (
        select(Role)
        .where(Role.tenantId == tenant_id, Role.code == code, Role.isActive == True)  # noqa: E712
        .order_by(Role.sortOrder)
    )
    return (await session.execute(stmt)).scalars().first()


async def _resolve_role_on_write(
    session: AsyncSession, tenant_id: str, role: str | None, role_id: str | None
) -> tuple[str | None, str | None]:
    """route 단 role/roleId 해석. roleId 만 있고 role 이 없으면 roleId 를 code 로 취급해 조회한다.

    (Next lib/services/user-service.ts 의 동일 동작을 그대로 재현 — roleId 인자를
    getRoleByCode 에 넘기는 부분은 원본의 의도된 동작이며 여기서 고치지 않는다.)
    """
    resolved_role = role
    resolved_role_id = role_id
    if role_id and not role:
        role_ref = await _get_role_by_code(session, tenant_id, role_id)
        if role_ref:
            resolved_role = role_ref.code
            resolved_role_id = role_ref.id
    return resolved_role, resolved_role_id


# ── 목록 ──────────────────────────────────────────────────────────────
@router.get("/users")
async def list_users(
    page: int = 1,
    pageSize: int = 20,
    role: str | None = None,
    isActive: str | None = None,
    search: str | None = None,
    includeRoleRef: bool = False,
    includeYearRoles: bool = False,
    year: int | None = None,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    target_year = year or datetime.now().year

    where = [User.tenantId == tenant_id]

    if role:
        if role == "admin":
            where.append(User.role == "admin")
        else:
            year_role_users = (
                await session.execute(
                    select(UserYearRole.userId).where(
                        UserYearRole.tenantId == tenant_id,
                        UserYearRole.role == role,
                        UserYearRole.year == target_year,
                    )
                )
            ).scalars().all()
            where.append(User.id.in_(list(year_role_users)))

    if isActive == "true":
        where.append(User.isActive == True)  # noqa: E712
    elif isActive == "false":
        where.append(User.isActive == False)  # noqa: E712

    if search:
        pattern = f"%{search}%"
        where.append(
            or_(
                User.userid.ilike(pattern),
                User.username.ilike(pattern),
                User.department.ilike(pattern),
            )
        )

    total = (
        await session.execute(select(func.count(User.id)).where(*where))
    ).scalar_one()

    skip = (page - 1) * pageSize
    stmt = (
        select(User)
        .where(*where)
        .order_by(User.role, User.username)
        .offset(skip)
        .limit(pageSize)
    )
    users = (await session.execute(stmt)).scalars().all()

    results = [u.model_dump() for u in users]

    if includeRoleRef:
        role_ids = {u.roleId for u in users if u.roleId}
        role_refs: dict[str, dict] = {}
        if role_ids:
            rows = (
                await session.execute(select(Role).where(Role.id.in_(role_ids)))
            ).scalars().all()
            role_refs = {r.id: r.model_dump() for r in rows}
        for u, out in zip(users, results):
            out["roleRef"] = role_refs.get(u.roleId) if u.roleId else None

    if includeYearRoles:
        user_ids = [u.id for u in users]
        year_roles_by_user: dict[str, list[dict]] = {uid: [] for uid in user_ids}
        if user_ids:
            rows = (
                await session.execute(
                    select(UserYearRole)
                    .where(UserYearRole.userId.in_(user_ids), UserYearRole.year == target_year)
                    .order_by(UserYearRole.role)
                )
            ).scalars().all()
            for yr in rows:
                year_roles_by_user.setdefault(yr.userId, []).append(yr.model_dump())
        for out in results:
            out["yearRoles"] = year_roles_by_user.get(out["id"], [])

    return {
        "users": results,
        "pagination": {
            "page": page,
            "pageSize": pageSize,
            "total": total,
            "totalPages": math.ceil(total / pageSize) if pageSize else 0,
        },
    }


# ── 생성 ──────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    userid: str | None = None
    username: str | None = None
    role: str | None = None
    roleId: str | None = None
    department: str | None = None
    password: str | None = None
    phoneNumber: str | None = None


@router.post("/users", status_code=201)
async def create_user(
    body: UserCreate,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
    _=Depends(require_permission(PERMISSIONS.USER_MANAGE)),
) -> dict:
    if not body.userid or not body.username:
        raise HTTPException(400, "userid and username are required")

    existing_by_userid = (
        await session.execute(
            select(User).where(User.tenantId == tenant_id, User.userid == body.userid)
        )
    ).scalars().first()
    if existing_by_userid:
        raise HTTPException(409, "User with this userid already exists")

    existing_by_username = (
        await session.execute(
            select(User).where(
                User.tenantId == tenant_id,
                User.username == body.username,
                User.isActive == True,  # noqa: E712
            )
        )
    ).scalars().first()
    if existing_by_username:
        raise HTTPException(409, "User with this username already exists")

    if body.role and body.role not in ROLE_CODES:
        raise HTTPException(400, "Invalid role")

    resolved_role, resolved_role_id = await _resolve_role_on_write(
        session, tenant_id, body.role, body.roleId
    )
    resolved_role = resolved_role or "user"

    if resolved_role and not resolved_role_id:
        role_ref = await _get_role_by_code(session, tenant_id, resolved_role)
        if role_ref:
            resolved_role_id = role_ref.id

    plain_password = body.password or DEFAULT_PASSWORD
    user = User(
        tenantId=tenant_id,
        userid=body.userid,
        username=body.username,
        role=resolved_role,
        roleId=resolved_role_id,
        department=body.department,
        phoneNumber=body.phoneNumber,
        password=hash_password(plain_password),
        mustChangePassword=True,
    )
    session.add(user)
    await session.flush()

    session.add(
        Membership(
            userId=user.id,
            tenantId=tenant_id,
            role=_membership_role(resolved_role),
            isDefault=True,
        )
    )
    await session.commit()
    await session.refresh(user)
    return user.model_dump()


# ── 상세 ──────────────────────────────────────────────────────────────
@router.get("/users/{user_id}")
async def get_user(
    user_id: str,
    includeRoleRef: bool = False,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await session.get(User, user_id)
    if user is None or user.tenantId != tenant_id:
        raise HTTPException(404, "User not found")

    result = user.model_dump()
    if includeRoleRef:
        role_ref = await session.get(Role, user.roleId) if user.roleId else None
        result["roleRef"] = role_ref.model_dump() if role_ref else None
    return result


# ── 수정 ──────────────────────────────────────────────────────────────
class UserUpdate(BaseModel):
    username: str | None = None
    role: str | None = None
    roleId: str | None = None
    department: str | None = None
    password: str | None = None
    phoneNumber: str | None = None
    isActive: bool | None = None
    canRegisterUsers: bool | None = None


@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    body: UserUpdate,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
    _=Depends(require_permission(PERMISSIONS.USER_MANAGE)),
) -> dict:
    user = await session.get(User, user_id)
    if user is None or user.tenantId != tenant_id:
        raise HTTPException(404, "User not found")

    fields = body.model_fields_set

    if "role" in fields and body.role and body.role not in ROLE_CODES:
        raise HTTPException(400, "Invalid role")

    resolved_role, resolved_role_id = await _resolve_role_on_write(
        session, tenant_id, body.role if "role" in fields else None, body.roleId if "roleId" in fields else None
    )

    if resolved_role and not resolved_role_id:
        role_ref = await _get_role_by_code(session, tenant_id, resolved_role)
        if role_ref:
            resolved_role_id = role_ref.id

    if "username" in fields:
        user.username = body.username
    if resolved_role:
        user.role = resolved_role
    if resolved_role_id:
        user.roleId = resolved_role_id
    if "department" in fields:
        user.department = body.department
    if "password" in fields and body.password:
        user.password = hash_password(body.password)
    if "phoneNumber" in fields:
        user.phoneNumber = body.phoneNumber
    if "isActive" in fields:
        user.isActive = body.isActive
    if "canRegisterUsers" in fields:
        user.canRegisterUsers = body.canRegisterUsers

    await session.commit()
    await session.refresh(user)
    return user.model_dump()


# ── 비활성화 (soft delete) ───────────────────────────────────────────
@router.delete("/users/{user_id}")
async def deactivate_user(
    user_id: str,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
    _=Depends(require_permission(PERMISSIONS.USER_MANAGE)),
) -> dict:
    user = await session.get(User, user_id)
    if user is None or user.tenantId != tenant_id:
        raise HTTPException(404, "User not found")

    user.isActive = False
    await session.commit()
    await session.refresh(user)

    return {"message": "User deactivated successfully", "user": user.model_dump()}
