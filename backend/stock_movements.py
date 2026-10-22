from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from models import Inventory, Product, StockMovement, User
from schemas import (
    StockMovementCreate,
    StockMovementResponse,
)


router = APIRouter(
    prefix="/api/stock-movements",
    tags=["Stock Movements"],
)


INCOMING_MOVEMENTS = {
    "receipt",
    "adjustment_in",
    "return_in",
}

OUTGOING_MOVEMENTS = {
    "issue",
    "adjustment_out",
    "return_out",
}

ALLOWED_MOVEMENTS = (
    INCOMING_MOVEMENTS | OUTGOING_MOVEMENTS
)


# =========================================================
# CREATE STOCK MOVEMENT
# =========================================================

@router.post(
    "",
    response_model=StockMovementResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_stock_movement(
    movement_data: StockMovementCreate,
    db: Session = Depends(get_db),
):
    movement_type = movement_data.movement_type.lower().strip()

    if movement_type not in ALLOWED_MOVEMENTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid movement type. Allowed values are: "
                "receipt, issue, adjustment_in, "
                "adjustment_out, return_in and return_out."
            ),
        )

    product = (
        db.query(Product)
        .filter(Product.id == movement_data.product_id)
        .first()
    )

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )

    inventory = (
        db.query(Inventory)
        .filter(
            Inventory.product_id
            == movement_data.product_id
        )
        .first()
    )

    if inventory is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Inventory record not found for this product."
            ),
        )

    user = (
        db.query(User)
        .filter(User.id == movement_data.performed_by)
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User performing the movement was not found.",
        )

    if movement_type in INCOMING_MOVEMENTS:
        new_quantity = (
            inventory.quantity_on_hand
            + movement_data.quantity
        )

    else:
        new_quantity = (
            inventory.quantity_on_hand
            - movement_data.quantity
        )

        if new_quantity < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Insufficient stock for this movement."
                ),
            )

        if new_quantity < inventory.quantity_reserved:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "This movement would reduce stock below "
                    "the quantity currently reserved."
                ),
            )

    movement = StockMovement(
        product_id=movement_data.product_id,
        movement_type=movement_type,
        quantity=movement_data.quantity,
        reference_type=movement_data.reference_type,
        reference_id=movement_data.reference_id,
        performed_by=movement_data.performed_by,
        remarks=movement_data.remarks,
    )

    try:
        inventory.quantity_on_hand = new_quantity

        db.add(movement)
        db.commit()
        db.refresh(movement)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Unable to record the stock movement "
                "because of a database conflict."
            ),
        )

    return movement


# =========================================================
# GET ALL STOCK MOVEMENTS
# =========================================================

@router.get(
    "",
    response_model=List[StockMovementResponse],
)
def get_stock_movements(
    db: Session = Depends(get_db),
):
    movements = (
        db.query(StockMovement)
        .order_by(
            StockMovement.movement_date.desc(),
            StockMovement.id.desc(),
        )
        .all()
    )

    return movements


# =========================================================
# GET MOVEMENTS FOR ONE PRODUCT
# =========================================================

@router.get(
    "/product/{product_id}",
    response_model=List[StockMovementResponse],
)
def get_product_stock_movements(
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

    movements = (
        db.query(StockMovement)
        .filter(
            StockMovement.product_id == product_id
        )
        .order_by(
            StockMovement.movement_date.desc(),
            StockMovement.id.desc(),
        )
        .all()
    )

    return movements