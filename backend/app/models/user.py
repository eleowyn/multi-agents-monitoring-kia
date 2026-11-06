import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.sql import func
from app.core.database import Base


class UserRole(str, enum.Enum):
    KADER = "KADER"
    ADMIN = "ADMIN"
    DOKTER = "DOKTER"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.KADER, nullable=False)
    posyandu_name = Column(String(100), nullable=True)  # e.g., Posyandu Mawar, Posyandu Melati di Airmadidi
    village_name = Column(String(100), nullable=True)   # 9 desa/kelurahan di Airmadidi
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
