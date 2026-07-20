"""Cloudinary 업로드/삭제 서비스 (Next lib/cloudinary.ts 이전, B2).

cloudinary 파이썬 SDK 는 동기 API 라 asyncio.to_thread 로 감싼다. 실호출은 라우트에서
직접 하지 않고 이 모듈을 거치게 해 테스트에서 monkeypatch 로 대체하기 쉽게 한다.
"""

import io
from asyncio import to_thread
from time import time

import cloudinary
import cloudinary.uploader

from expense_api.core.config.settings import settings

CLOUDINARY_FOLDER = "expense-receipts"


class CloudinaryConfigError(Exception):
    """Cloudinary 미설정(환경변수 없음) — 라우트에서 503으로 매핑."""


def is_cloudinary_configured() -> bool:
    return bool(settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET)


def _configure() -> None:
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
    )


def _upload_sync(file_bytes: bytes, file_name: str) -> dict:
    _configure()
    return cloudinary.uploader.upload(
        io.BytesIO(file_bytes),
        folder=CLOUDINARY_FOLDER,
        resource_type="auto",
        public_id=f"{int(time() * 1000)}-{file_name}",
    )


def _destroy_sync(public_id: str) -> dict:
    _configure()
    return cloudinary.uploader.destroy(public_id)


async def upload_image(file_bytes: bytes, file_name: str) -> dict:
    if not is_cloudinary_configured():
        raise CloudinaryConfigError("이미지 업로드가 설정되지 않았습니다. 관리자에게 문의하세요.")
    return await to_thread(_upload_sync, file_bytes, file_name)


async def delete_image(public_id: str) -> dict:
    if not is_cloudinary_configured():
        raise CloudinaryConfigError("이미지 삭제가 설정되지 않았습니다. 관리자에게 문의하세요.")
    return await to_thread(_destroy_sync, public_id)
