from typing import Optional

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.models.user import User
from backend.utils.security import get_password_hash, password_hash_needs_upgrade, verify_password


def get_user_by_id(
    database: Session,
    user_id: int,
) -> Optional[User]:
    """
    Get a user by primary key.
    """
    return (
        database.query(User)
        .filter(User.id == user_id)
        .first()
    )


def get_user_by_email(
    database: Session,
    email: str,
) -> Optional[User]:
    """
    Get a user by email address.

    Email comparison is normalized to lowercase so that:
    USER@EMAIL.COM and user@email.com are treated consistently.
    """
    normalized_email = email.strip().lower()

    return (
        database.query(User)
        .filter(User.email == normalized_email)
        .first()
    )


def create_user(
    database: Session,
    name: str,
    email: str,
    password: str,
    company: Optional[str] = None,
    phone: Optional[str] = None,
    age: Optional[int] = None,
    gender: Optional[str] = None,
    role: str = "Developer",
) -> User:
    """
    Create a new user.

    The plain-text password is never stored.
    It is converted into a secure password hash first.
    """

    normalized_email = email.strip().lower()

    # Never store a plain-text password.
    password_hash = get_password_hash(password)

    user = User(
        name=name.strip(),
        email=normalized_email,
        password_hash=password_hash,
        company=company.strip() if company else None,
        phone=phone.strip() if phone else None,
        age=age,
        gender=gender,
        role=role.strip() or "Developer",
    )

    database.add(user)

    try:
        database.commit()
        database.refresh(user)
        return user

    except SQLAlchemyError:
        database.rollback()
        raise


def authenticate_user(
    database: Session,
    email: str,
    password: str,
) -> Optional[User]:
    """
    Authenticate a user using email and password.

    Returns:
        User object when credentials are valid.
        None when credentials are invalid.
    """

    normalized_email = email.strip().lower()

    user = (
        database.query(User)
        .filter(User.email == normalized_email)
        .first()
    )

    if user is None:
        return None

    # Make sure the stored hash exists.
    stored_hash = getattr(user, "password_hash", None)

    if not stored_hash:
        return None

    try:
        password_valid = verify_password(
            password,
            stored_hash,
        )
    except Exception:
        # Never expose password hashing errors to the client.
        return None

    if not password_valid:
        return None

    if password_hash_needs_upgrade(stored_hash):
        user.password_hash = get_password_hash(password)
        try:
            database.commit()
            database.refresh(user)
        except SQLAlchemyError:
            database.rollback()
            raise

    return user


def update_user_profile(
    database: Session,
    user: User,
    name: Optional[str] = None,
    email: Optional[str] = None,
    company: Optional[str] = None,
    phone: Optional[str] = None,
    age: Optional[int] = None,
    gender: Optional[str] = None,
    role: Optional[str] = None,
) -> User:
    """
    Update the authenticated user's profile.
    """

    if name is not None:
        cleaned_name = name.strip()

        if cleaned_name:
            user.name = cleaned_name

    if email is not None:
        normalized_email = email.strip().lower()

        # Check whether another user already owns this email.
        existing_user = (
            database.query(User)
            .filter(
                User.email == normalized_email,
                User.id != user.id,
            )
            .first()
        )

        if existing_user:
            raise ValueError(
                "An account with this email already exists."
            )

        user.email = normalized_email

    if company is not None:
        user.company = company.strip()
    if phone is not None:
        user.phone = phone.strip() or None
    if age is not None:
        user.age = age
    if gender is not None:
        user.gender = gender.strip() or None
    if role is not None:
        user.role = role.strip() or user.role

    try:
        database.commit()
        database.refresh(user)
        return user

    except SQLAlchemyError:
        database.rollback()
        raise


def delete_user(
    database: Session,
    user: User,
) -> bool:
    """
    Delete a user.
    """

    try:
        database.delete(user)
        database.commit()
        return True

    except SQLAlchemyError:
        database.rollback()
        raise
