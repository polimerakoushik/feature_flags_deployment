from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String

from backend.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    # Personal Information
    name = Column(String(100), nullable=False)
    email = Column(String(120), unique=True, nullable=False, index=True)
    phone = Column(String(15), nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String(20), nullable=True)

    # Organization
    company = Column(String(100), nullable=True)
    role = Column(String(50), nullable=False, default="Developer")

    # Authentication
    password_hash = Column(String, nullable=False)

    # Profile
    profile_image = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)

    # Audit
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )