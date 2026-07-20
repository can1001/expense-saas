"""지출 템플릿·저장된 계좌 라우터. (app/api/expense-templates*, app/api/bank-accounts* 이전, B5)

둘 다 본인(userId) 소유 리소스 — 목록은 userId 로 스코프하고, 개별 조작은
id+tenantId 로 조회한 뒤 소유자 불일치 시 403(미존재 시 404)을 반환한다.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.db.session import get_session
from expense_api.core.dependencies.auth import CurrentUser, get_current_user
from expense_api.core.dependencies.tenant import require_tenant_id
from expense_api.core.models.misc import ExpenseTemplate, SavedBankAccount
from expense_api.core.schemas.misc import (
    CreateExpenseTemplateRequest,
    CreateSavedBankAccountRequest,
    ExpenseTemplateListOut,
    ExpenseTemplateOut,
    SavedBankAccountListOut,
    SavedBankAccountOut,
    UpdateExpenseTemplateRequest,
    UpdateSavedBankAccountRequest,
)

expense_template_router = APIRouter()
bank_account_router = APIRouter()

MAX_TEMPLATES_PER_USER = 20


def _to_template_out(t: ExpenseTemplate) -> ExpenseTemplateOut:
    return ExpenseTemplateOut(
        id=t.id,
        tenantId=t.tenantId,
        userId=t.userId,
        name=t.name,
        budgetCategory=t.budgetCategory,
        budgetSubcategory=t.budgetSubcategory,
        budgetDetail=t.budgetDetail,
        description=t.description,
        defaultAmount=t.defaultAmount,
        usageCount=t.usageCount,
        createdAt=t.createdAt,
        updatedAt=t.updatedAt,
    )


def _to_account_out(a: SavedBankAccount) -> SavedBankAccountOut:
    return SavedBankAccountOut(
        id=a.id,
        tenantId=a.tenantId,
        userId=a.userId,
        bankName=a.bankName,
        accountNumber=a.accountNumber,
        accountHolder=a.accountHolder,
        nickname=a.nickname,
        isDefault=a.isDefault,
        createdAt=a.createdAt,
        updatedAt=a.updatedAt,
    )


async def _get_template(
    session: AsyncSession, tenant_id: str, template_id: str
) -> ExpenseTemplate | None:
    stmt = select(ExpenseTemplate).where(
        ExpenseTemplate.tenantId == tenant_id, ExpenseTemplate.id == template_id
    )
    return (await session.execute(stmt)).scalars().first()


@expense_template_router.get("", response_model=ExpenseTemplateListOut)
async def list_expense_templates(
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> ExpenseTemplateListOut:
    stmt = (
        select(ExpenseTemplate)
        .where(ExpenseTemplate.tenantId == tenant_id, ExpenseTemplate.userId == user.id)
        .order_by(ExpenseTemplate.usageCount.desc(), ExpenseTemplate.createdAt.desc())
    )
    templates = list((await session.execute(stmt)).scalars().all())
    return ExpenseTemplateListOut(templates=[_to_template_out(t) for t in templates])


@expense_template_router.post(
    "", response_model=ExpenseTemplateOut, status_code=status.HTTP_201_CREATED
)
async def create_expense_template(
    body: CreateExpenseTemplateRequest,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> ExpenseTemplateOut:
    existing_count = (
        await session.execute(
            select(func.count())
            .select_from(ExpenseTemplate)
            .where(ExpenseTemplate.tenantId == tenant_id, ExpenseTemplate.userId == user.id)
        )
    ).scalar_one()
    if existing_count >= MAX_TEMPLATES_PER_USER:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"최대 {MAX_TEMPLATES_PER_USER}개의 템플릿만 저장할 수 있습니다.",
        )

    template = ExpenseTemplate(
        tenantId=tenant_id,
        userId=user.id,
        name=body.name,
        budgetCategory=body.budgetCategory,
        budgetSubcategory=body.budgetSubcategory,
        budgetDetail=body.budgetDetail,
        description=body.description or None,
        defaultAmount=body.defaultAmount or None,
    )
    session.add(template)
    await session.commit()
    await session.refresh(template)
    return _to_template_out(template)


@expense_template_router.get("/{template_id}", response_model=ExpenseTemplateOut)
async def get_expense_template(
    template_id: str,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> ExpenseTemplateOut:
    template = await _get_template(session, tenant_id, template_id)
    if template is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "템플릿을 찾을 수 없습니다.")
    if template.userId != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "접근 권한이 없습니다.")
    return _to_template_out(template)


@expense_template_router.put("/{template_id}", response_model=ExpenseTemplateOut)
async def update_expense_template(
    template_id: str,
    body: UpdateExpenseTemplateRequest,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> ExpenseTemplateOut:
    template = await _get_template(session, tenant_id, template_id)
    if template is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "템플릿을 찾을 수 없습니다.")
    if template.userId != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "접근 권한이 없습니다.")

    if body.name:
        template.name = body.name
    if body.budgetCategory:
        template.budgetCategory = body.budgetCategory
    if body.budgetSubcategory:
        template.budgetSubcategory = body.budgetSubcategory
    if body.budgetDetail:
        template.budgetDetail = body.budgetDetail
    if body.description is not None:
        template.description = body.description
    if body.defaultAmount is not None:
        template.defaultAmount = body.defaultAmount

    session.add(template)
    await session.commit()
    await session.refresh(template)
    return _to_template_out(template)


@expense_template_router.delete("/{template_id}")
async def delete_expense_template(
    template_id: str,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    template = await _get_template(session, tenant_id, template_id)
    if template is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "템플릿을 찾을 수 없습니다.")
    if template.userId != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "접근 권한이 없습니다.")

    await session.delete(template)
    await session.commit()
    return {"success": True, "message": "템플릿이 성공적으로 삭제되었습니다."}


@expense_template_router.post("/{template_id}", response_model=ExpenseTemplateOut)
async def use_expense_template(
    template_id: str,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> ExpenseTemplateOut:
    template = await _get_template(session, tenant_id, template_id)
    if template is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "템플릿을 찾을 수 없습니다.")
    if template.userId != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "접근 권한이 없습니다.")

    template.usageCount += 1
    session.add(template)
    await session.commit()
    await session.refresh(template)
    return _to_template_out(template)


async def _get_bank_account(
    session: AsyncSession, tenant_id: str, account_id: str
) -> SavedBankAccount | None:
    stmt = select(SavedBankAccount).where(
        SavedBankAccount.tenantId == tenant_id, SavedBankAccount.id == account_id
    )
    return (await session.execute(stmt)).scalars().first()


@bank_account_router.get("", response_model=SavedBankAccountListOut)
async def list_bank_accounts(
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> SavedBankAccountListOut:
    stmt = (
        select(SavedBankAccount)
        .where(SavedBankAccount.tenantId == tenant_id, SavedBankAccount.userId == user.id)
        .order_by(SavedBankAccount.isDefault.desc(), SavedBankAccount.createdAt.desc())
    )
    accounts = list((await session.execute(stmt)).scalars().all())
    return SavedBankAccountListOut(accounts=[_to_account_out(a) for a in accounts])


@bank_account_router.post(
    "", response_model=SavedBankAccountOut, status_code=status.HTTP_201_CREATED
)
async def create_bank_account(
    body: CreateSavedBankAccountRequest,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> SavedBankAccountOut:
    existing_count = (
        await session.execute(
            select(func.count())
            .select_from(SavedBankAccount)
            .where(SavedBankAccount.tenantId == tenant_id, SavedBankAccount.userId == user.id)
        )
    ).scalar_one()

    duplicate = (
        (
            await session.execute(
                select(SavedBankAccount).where(
                    SavedBankAccount.tenantId == tenant_id,
                    SavedBankAccount.userId == user.id,
                    SavedBankAccount.accountNumber == body.accountNumber,
                )
            )
        )
        .scalars()
        .first()
    )
    if duplicate is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 등록된 계좌번호입니다.")

    should_be_default = existing_count == 0 or bool(body.isDefault)

    if should_be_default:
        existing_defaults = (
            (
                await session.execute(
                    select(SavedBankAccount).where(
                        SavedBankAccount.tenantId == tenant_id,
                        SavedBankAccount.userId == user.id,
                        SavedBankAccount.isDefault == True,  # noqa: E712
                    )
                )
            )
            .scalars()
            .all()
        )
        for acc in existing_defaults:
            acc.isDefault = False
            session.add(acc)

    account = SavedBankAccount(
        tenantId=tenant_id,
        userId=user.id,
        bankName=body.bankName,
        accountNumber=body.accountNumber,
        accountHolder=body.accountHolder,
        nickname=body.nickname or None,
        isDefault=should_be_default,
    )
    session.add(account)
    await session.commit()
    await session.refresh(account)
    return _to_account_out(account)


@bank_account_router.get("/{account_id}", response_model=SavedBankAccountOut)
async def get_bank_account(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> SavedBankAccountOut:
    account = await _get_bank_account(session, tenant_id, account_id)
    if account is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "저장된 계좌를 찾을 수 없습니다.")
    if account.userId != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "접근 권한이 없습니다.")
    return _to_account_out(account)


@bank_account_router.put("/{account_id}", response_model=SavedBankAccountOut)
async def update_bank_account(
    account_id: str,
    body: UpdateSavedBankAccountRequest,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> SavedBankAccountOut:
    account = await _get_bank_account(session, tenant_id, account_id)
    if account is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "저장된 계좌를 찾을 수 없습니다.")
    if account.userId != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "접근 권한이 없습니다.")

    if body.accountNumber and body.accountNumber != account.accountNumber:
        duplicate = (
            (
                await session.execute(
                    select(SavedBankAccount).where(
                        SavedBankAccount.tenantId == tenant_id,
                        SavedBankAccount.userId == user.id,
                        SavedBankAccount.accountNumber == body.accountNumber,
                        SavedBankAccount.id != account_id,
                    )
                )
            )
            .scalars()
            .first()
        )
        if duplicate is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "이미 등록된 계좌번호입니다.")

    if body.isDefault and not account.isDefault:
        others = (
            (
                await session.execute(
                    select(SavedBankAccount).where(
                        SavedBankAccount.tenantId == tenant_id,
                        SavedBankAccount.userId == user.id,
                        SavedBankAccount.isDefault == True,  # noqa: E712
                        SavedBankAccount.id != account_id,
                    )
                )
            )
            .scalars()
            .all()
        )
        for acc in others:
            acc.isDefault = False
            session.add(acc)

    if body.bankName:
        account.bankName = body.bankName
    if body.accountNumber:
        account.accountNumber = body.accountNumber
    if body.accountHolder:
        account.accountHolder = body.accountHolder
    if body.nickname is not None:
        account.nickname = body.nickname or None
    if body.isDefault is not None:
        account.isDefault = body.isDefault

    session.add(account)
    await session.commit()
    await session.refresh(account)
    return _to_account_out(account)


@bank_account_router.delete("/{account_id}")
async def delete_bank_account(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    account = await _get_bank_account(session, tenant_id, account_id)
    if account is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "저장된 계좌를 찾을 수 없습니다.")
    if account.userId != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "접근 권한이 없습니다.")

    await session.delete(account)
    await session.commit()
    return {"success": True, "message": "계좌가 성공적으로 삭제되었습니다."}
