from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from models import Product
from schemas import ProductCreate, ProductResponse, ProductUpdate


router = APIRouter(
    prefix="/api/products",
    tags=["Products"],
)


# =========================================================
# CREATE PRODUCT
# =========================================================

@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_product(
    product_data: ProductCreate,
    db: Session = Depends(get_db),
):
    existing_product = (
        db.query(Product)
        .filter(Product.product_code == product_data.product_code)
        .first()
    )

    if existing_product:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A product with this product code already exists.",
        )

    new_product = Product(
        **product_data.model_dump()
    )

    try:
        db.add(new_product)
        db.commit()
        db.refresh(new_product)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to create product because of a database conflict.",
        )

    return new_product


# =========================================================
# GET ALL PRODUCTS
# =========================================================

@router.get(
    "",
    response_model=List[ProductResponse],
)
def get_products(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    products = (
        db.query(Product)
        .order_by(Product.id.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return products


# =========================================================
# GET ONE PRODUCT
# =========================================================

@router.get(
    "/{product_id}",
    response_model=ProductResponse,
)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
):
    product = (
        db.query(Product)
        .filter(Product.id == product_id)
        .first()
    )

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )

    return product


# =========================================================
# UPDATE PRODUCT
# =========================================================

@router.put(
    "/{product_id}",
    response_model=ProductResponse,
)
def update_product(
    product_id: int,
    product_data: ProductUpdate,
    db: Session = Depends(get_db),
):
    product = (
        db.query(Product)
        .filter(Product.id == product_id)
        .first()
    )

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )

    update_data = product_data.model_dump(
        exclude_unset=True
    )

    for field, value in update_data.items():
        setattr(product, field, value)

    try:
        db.commit()
        db.refresh(product)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to update product because of a database conflict.",
        )

    return product


# =========================================================
# DELETE PRODUCT
# =========================================================

@router.delete(
    "/{product_id}",
)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
):
    product = (
        db.query(Product)
        .filter(Product.id == product_id)
        .first()
    )

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )

    try:
        db.delete(product)
        db.commit()

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This product cannot be deleted because "
                "it is already linked to procurement or inventory records."
            ),
        )

    return {
        "message": "Product deleted successfully."
    }