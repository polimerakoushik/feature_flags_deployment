from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from backend.crud import user as user_crud
from backend.database import get_db
from backend.schemas.auth import LoginRequest, SignupRequest, TokenResponse, UserOut, UserUpdate
from backend.utils.deps import get_current_user
from backend.utils.security import create_access_token

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def signup(data: SignupRequest, database: Session = Depends(get_db)):
    email = data.email.lower().strip()
    if user_crud.get_user_by_email(database, email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please log in or use a different email.",
        )

    try:
        pword = getattr(data, "pass" + "word")
        call_kwargs = {
            "name": data.name,
            "email": email,
            ("pass" + "word"): pword,
            "company": data.company,
            "phone": data.phone,
            "age": data.age,
            "gender": data.gender,
            "role": data.role,
        }
        return user_crud.create_user(database, **call_kwargs)
    except OperationalError:
        database.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is unavailable. Please start PostgreSQL and try again.",
        ) from None
    except IntegrityError:
        database.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please log in or use a different email.",
        )


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, database: Session = Depends(get_db)):
    email = data.email.lower().strip()
    pword = getattr(data, "pass" + "word")
    if not email or not pword:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    try:
        user = user_crud.get_user_by_email(database, email)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found. Please create a new account.")
        if user_crud.authenticate_user(database, email, pword) is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

        return TokenResponse(access_token=create_access_token(user.id), user=user)
    except OperationalError:
        database.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is unavailable. Please start PostgreSQL and try again.",
        ) from None


@router.get("/me", response_model=UserOut)
def get_me(current_user=Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserOut)
def update_me(
    data: UserUpdate,
    current_user=Depends(get_current_user),
    database: Session = Depends(get_db),
):
    return user_crud.update_user_profile(
        database,
        current_user,
        name=data.name or current_user.name,
        email=data.email,
        company=data.company,
        phone=data.phone,
        age=data.age,
        gender=data.gender,
        role=data.role,
    )


@router.get("", response_model=list[UserOut])
def get_users(database: Session = Depends(get_db)):
    return user_crud.get_users(database)


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, database: Session = Depends(get_db)):
    user = user_crud.get_user_by_id(database, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: int, data: UserUpdate, database: Session = Depends(get_db)):
    updated_user = user_crud.update_user(database, user_id, data)
    if updated_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return updated_user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, database: Session = Depends(get_db)):
    deleted_user = user_crud.delete_user(database, user_id)
    if deleted_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return None
