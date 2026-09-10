"""Compatibility authentication service.

All API routers must use the same JWT implementation as login.  Older code in
this project imported helpers from ``backend.services.auth`` while newer code
used ``backend.utils.security``/``backend.utils.deps``.  Re-export the canonical
helpers here so tokens created at login are accepted by evaluation, metrics,
targeting, versions, and membership endpoints as well.
"""

from backend.utils.deps import get_current_user
from backend.utils.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def verify_access_token(token: str) -> int:
    user_id = decode_access_token(token)
    if user_id is None:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session.",
        )
    return user_id


__all__ = [
    "get_current_user",
    "create_access_token",
    "decode_access_token",
    "verify_access_token",
    "hash_password",
    "verify_password",
]
