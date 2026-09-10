from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from jwt import InvalidTokenError
import bcrypt

from backend.config import settings


# ============================================================
# JWT CONFIGURATION
# ============================================================

def hash_password(password: str) -> str:
    if not isinstance(password, str):
        raise TypeError("Password must be a string.")
    if not password:
        raise ValueError("Password cannot be empty.")
    salt = secrets.token_bytes(16)
    n = 2**14
    r = 8
    p = 1
    derived_key = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=n,
        r=r,
        p=p,
        dklen=64,
    )
    return "scrypt${}${}${}${}${}".format(
        n,
        r,
        p,
        base64.urlsafe_b64encode(salt).decode("ascii"),
        base64.urlsafe_b64encode(derived_key).decode("ascii"),
    )


def get_password_hash(password: str) -> str:
    return hash_password(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password:
        return False

    if hashed_password.startswith(("$2a$", "$2b$", "$2y$")):
        # Existing installations used bcrypt. Keep those accounts usable while
        # newly created passwords use scrypt without bcrypt's 72-byte limit.
        if len(plain_password.encode("utf-8")) > 72:
            return False
        try:
            return bcrypt.checkpw(
                plain_password.encode("utf-8"),
                hashed_password.encode("utf-8"),
            )
        except (TypeError, ValueError):
            return False

    try:
        algorithm, n, r, p, encoded_salt, encoded_key = hashed_password.split("$")
        if algorithm != "scrypt":
            return False
        salt = base64.urlsafe_b64decode(encoded_salt.encode("ascii"))
        stored_key = base64.urlsafe_b64decode(encoded_key.encode("ascii"))
        derived_key = hashlib.scrypt(
            plain_password.encode("utf-8"),
            salt=salt,
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(stored_key),
        )
        return hmac.compare_digest(derived_key, stored_key)
    except Exception:
        return False


def password_hash_needs_upgrade(hashed_password: str) -> bool:
    """Return whether a valid legacy bcrypt hash should be migrated to scrypt."""
    return hashed_password.startswith(("$2a$", "$2b$", "$2y$"))


# ============================================================
# JWT
# ============================================================

def create_access_token(user_id: Any, expires_delta: timedelta | None = None) -> str:
    if user_id is None:
        raise ValueError("user_id is required.")
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.algorithm)


def decode_token_payload(token: str) -> dict[str, Any] | None:
    if not token:
        return None
    try:
        return jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.algorithm],
        )
    except InvalidTokenError:
        return None


def decode_access_token(token: str) -> int | None:
    payload = decode_token_payload(token)
    if payload is None:
        return None
    subject = payload.get("sub")
    if subject is None:
        return None
    try:
        return int(subject)
    except (TypeError, ValueError):
        return None


def get_user_id_from_token(token: str) -> int | None:
    return decode_access_token(token)
