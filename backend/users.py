
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from auth import get_current_user
from database import get_db
from models import User
from security import hash_password


router = APIRouter(
    prefix="/api/users",
    tags=["User Management"],
)

UserRole = Literal[
    "admin",
    "procurement_officer",
    "requester",
    "approver",
    "storekeeper",
]


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    role: UserRole = "requester"
    department: Optional[str] = Field(default=None, max_length=100)


class UserRoleUpdate(BaseModel):
    role: UserRole


class UserStatusUpdate(BaseModel):
    is_active: bool


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: str
    department: Optional[str]
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


def require_admin(current_user: User):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access is required.",
        )


def get_user_or_404(user_id: int, db: Session):
    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )

    return user


@router.get("", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    return db.query(User).order_by(User.id.asc()).all()


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    email = str(user_data.email).strip().lower()
    full_name = user_data.full_name.strip()

    if len(full_name) < 2:
        raise HTTPException(
            status_code=400,
            detail="Full name must contain at least 2 characters.",
        )

    existing = db.query(User).filter(User.email == email).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        )

    user = User(
        full_name=full_name,
        email=email,
        password_hash=hash_password(user_data.password),
        role=user_data.role,
        department=(
            user_data.department.strip()
            if user_data.department
            else None
        ),
        is_active=True,
    )

    try:
        db.add(user)
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to create user. Email may already exist.",
        )

    return user


@router.patch("/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    role_data: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    user = get_user_or_404(user_id, db)

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot change your own administrator role.",
        )

    user.role = role_data.role
    db.commit()
    db.refresh(user)

    return user


@router.patch("/{user_id}/status", response_model=UserResponse)
def update_user_status(
    user_id: int,
    status_data: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    user = get_user_or_404(user_id, db)

    if user.id == current_user.id and not status_data.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot deactivate your own account.",
        )

    user.is_active = status_data.is_active
    db.commit()
    db.refresh(user)

    return user
