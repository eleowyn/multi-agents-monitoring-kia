from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from typing import Optional

from app.core.database import get_db
from app.core.config import settings
from app.core.security import verify_password, get_password_hash, create_access_token, ALGORITHM
from app.models.user import User, UserRole
from app.schemas.auth import Token, UserResponse, UserCreate, LoginRequest

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/token")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Kredensial autentikasi tidak valid",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(User).filter(User.username == username).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def seed_default_users(db: Session):
    """Seed akun awal Kader dan Admin jika database masih kosong."""
    if db.query(User).count() == 0:
        kader = User(
            username="kader1",
            email="kader1@posyandu-airmadidi.go.id",
            hashed_password=get_password_hash("kader123"),
            full_name="Kader Posyandu",
            role=UserRole.KADER,
            posyandu_name="Posyandu Mawar",
            village_name="Airmadidi Atas"
        )
        admin = User(
            username="admin",
            email="admin@puskesmas-airmadidi.go.id",
            hashed_password=get_password_hash("admin123"),
            full_name="Lana Admin Puskesmas",
            role=UserRole.ADMIN,
            posyandu_name="Puskesmas Airmadidi",
            village_name="Kecamatan Airmadidi"
        )
        db.add_all([kader, admin])
        db.commit()
        print(" [SEED] Akun demo Kader (kader1 / kader123) dan Admin (admin / admin123) berhasil dibuat.")


@router.post("/login", response_model=Token)
def login(login_req: LoginRequest, db: Session = Depends(get_db)):
    seed_default_users(db)
    user = db.query(User).filter(User.username == login_req.username).first()
    if not user or not verify_password(login_req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username atau password salah"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun Anda telah dinonaktifkan oleh Administrator Puskesmas. Silakan hubungi admin Puskesmas Airmadidi."
        )
    
    access_token = create_access_token(subject=user.username)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


@router.post("/token", response_model=Token)
def login_form(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    seed_default_users(db)
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username atau password salah"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun Anda telah dinonaktifkan oleh Administrator Puskesmas. Silakan hubungi admin Puskesmas Airmadidi."
        )
    
    access_token = create_access_token(subject=user.username)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

