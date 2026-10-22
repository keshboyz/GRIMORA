from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from models import Supplier
from schemas import SupplierCreate, SupplierResponse, SupplierUpdate


router = APIRouter(
    prefix="/api/suppliers",
    tags=["Suppliers"],
)


# =========================================================
# CREATE SUPPLIER
# =========================================================

@router.post(
    "",
    response_model=SupplierResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_supplier(
    supplier_data: SupplierCreate,
    db: Session = Depends(get_db),
):
    existing_supplier = (
        db.query(Supplier)
        .filter(Supplier.supplier_code == supplier_data.supplier_code)
        .first()
    )

    if existing_supplier:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A supplier with this supplier code already exists.",
        )

    new_supplier = Supplier(
        **supplier_data.model_dump()
    )

    try:
        db.add(new_supplier)
        db.commit()
        db.refresh(new_supplier)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to create supplier because of a database conflict.",
        )

    return new_supplier


# =========================================================
# GET ALL SUPPLIERS
# =========================================================

@router.get(
    "",
    response_model=List[SupplierResponse],
)
def get_suppliers(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    suppliers = (
        db.query(Supplier)
        .order_by(Supplier.id.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return suppliers


# =========================================================
# GET ONE SUPPLIER
# =========================================================

@router.get(
    "/{supplier_id}",
    response_model=SupplierResponse,
)
def get_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
):
    supplier = (
        db.query(Supplier)
        .filter(Supplier.id == supplier_id)
        .first()
    )

    if supplier is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found.",
        )

    return supplier


# =========================================================
# UPDATE SUPPLIER
# =========================================================

@router.put(
    "/{supplier_id}",
    response_model=SupplierResponse,
)
def update_supplier(
    supplier_id: int,
    supplier_data: SupplierUpdate,
    db: Session = Depends(get_db),
):
    supplier = (
        db.query(Supplier)
        .filter(Supplier.id == supplier_id)
        .first()
    )

    if supplier is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found.",
        )

    update_data = supplier_data.model_dump(
        exclude_unset=True
    )

    for field, value in update_data.items():
        setattr(supplier, field, value)

    try:
        db.commit()
        db.refresh(supplier)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to update supplier because of a database conflict.",
        )

    return supplier


# =========================================================
# DELETE SUPPLIER
# =========================================================

@router.delete(
    "/{supplier_id}",
)
def delete_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
):
    supplier = (
        db.query(Supplier)
        .filter(Supplier.id == supplier_id)
        .first()
    )

    if supplier is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found.",
        )

    try:
        db.delete(supplier)
        db.commit()

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This supplier cannot be deleted because "
                "it is already linked to procurement records."
            ),
        )

    return {
        "message": "Supplier deleted successfully."
    }