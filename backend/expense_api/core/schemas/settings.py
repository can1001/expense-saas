"""시스템 설정 요청/응답 스키마 (B6).

GET 응답은 쿼리(단일 key/복수 keys/전체)에 따라 형태가 달라 response_model 을
쓰지 않고 dict 로 직접 반환한다 (app/api/settings/route.ts GET 계약과 동일).
"""

from typing import Any

from pydantic import BaseModel


class UpdateSettingRequest(BaseModel):
    # key 는 Next 원본과 동일한 400(자체 메시지)을 내려주기 위해 required 로 강제하지 않고
    # 라우트 핸들러에서 수동 검증한다.
    key: str | None = None
    value: Any = None
    description: str | None = None


class UpdateSettingOut(BaseModel):
    key: str
    value: Any
    description: str | None


class UpdateSettingResponse(BaseModel):
    success: bool
    setting: UpdateSettingOut
