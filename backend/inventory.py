from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from models import Inventory, Product
from schemas import (
    InventoryCreate,
    InventoryResponse,
    InventoryUpdate,
)


router = APIRouter(
    prefix="/api/inventory",
    tags=["Inventory"],
)


# =========================================================
# HELPER FUNCTIONS
# =========================================================

def get_stock_status(
    quantity_on_hand: int,
    reorder_level: int,
) -> str:
    if quantity_on_hand == 0:
        return "Out of Stock"

    if quantity_on_hand <= reorder_level:
        return "Low Stock"

    return "In Stock"


def build_inventory_response(
    inventory: Inventory,
    product: Product,
) -> InventoryResponse:
    available_quantity = max(
        inventory.quantity_on_hand - inventory.quantity_reserved,
        0,
    )

    stock_status = get_stock_status(
        inventory.quantity_on_hand,
        product.reorder_level,
    )

    stock_value = (
        Decimal(inventory.quantity_on_hand)
        * Decimal(product.unit_price)
    )

    return InventoryResponse(
        id=inventory.id,
        product_id=product.id,
        product_code=product.product_code,
        product_name=product.product_name,
        category=product.category,
        unit_of_measure=product.unit_of_measure,
        unit_price=product.unit_price,
        reorder_level=product.reorder_level,
        quantity_on_hand=inventory.quantity_on_hand,
        quantity_reserved=inventory.quantity_reserved,
        available_quantity=available_quantity,
        storage_location=inventory.storage_location,
        stock_status=stock_status,
        stock_value=stock_value,
        last_updated=inventory.last_updated,
    )


# =========================================================
# CREATE INVENTORY RECORD
# =========================================================

@router.post(
    "",
    response_model=InventoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_inventory_record(
    inventory_data: InventoryCreate,
    db: Session = Depends(get_db),
):
    product = (
        db.query(Product)
        .filter(Product.id == inventory_data.product_id)
        .first()
    )

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )

    existing_inventory = (
        db.query(Inventory)
        .filter(
            Inventory.product_id
            == inventory_data.product_id
        )
        .first()
    )

    if existing_inventory:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "An inventory record already exists "
                "for this product."
            ),
        )

    if (
        inventory_data.quantity_reserved
        > inventory_data.quantity_on_hand
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Reserved quantity cannot exceed "
                "quantity on hand."
            ),
        )

    inventory = Inventory(
        product_id=inventory_data.product_id,
        quantity_on_hand=inventory_data.quantity_on_hand,
        quantity_reserved=inventory_data.quantity_reserved,
        storage_location=inventory_data.storage_location,
    )

    try:
        db.add(inventory)
        db.commit()
        db.refresh(inventory)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Unable to create inventory record "
                "because of a database conflict."
            ),
        )

    return build_inventory_response(
        inventory,
        product,
    )


# =========================================================
# GET ALL INVENTORY
# =========================================================

@router.get(
    "",
    response_model=List[InventoryResponse],
)
def get_inventory(
    db: Session = Depends(get_db),
):
    records = (
        db.query(Inventory, Product)
        .join(
            Product,
            Inventory.product_id == Product.id,
        )
        .order_by(Product.product_name.asc())
        .all()
    )

    return [
        build_inventory_response(
            inventory,
            product,
        )
        for inventory, product in records
    ]


# =========================================================
# GET ONE INVENTORY RECORD
# =========================================================

@router.get(
    "/{inventory_id}",
    response_model=InventoryResponse,
)
def get_inventory_record(
    inventory_id: int,
    db: Session = Depends(get_db),
):
    result = (
        db.query(Inventory, Product)
        .join(
            Product,
            Inventory.product_id == Product.id,
        )
        .filter(Inventory.id == inventory_id)
        .first()
    )

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory record not found.",
        )

    inventory, product = result

    return build_inventory_response(
        inventory,
        product,
    )


# =========================================================
# UPDATE INVENTORY RECORD
# =========================================================

@router.put(
    "/{inventory_id}",
    response_model=InventoryResponse,
)
def update_inventory_record(
    inventory_id: int,
    inventory_data: InventoryUpdate,
    db: Session = Depends(get_db),
):
    inventory = (
        db.query(Inventory)
        .filter(Inventory.id == inventory_id)
        .first()
    )

    if inventory is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory record not found.",
        )

    update_data = inventory_data.model_dump(
        exclude_unset=True
    )

    new_quantity_on_hand = update_data.get(
        "quantity_on_hand",
        inventory.quantity_on_hand,
    )

    new_quantity_reserved = update_data.get(
        "quantity_reserved",
        inventory.quantity_reserved,
    )

    if new_quantity_reserved > new_quantity_on_hand:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Reserved quantity cannot exceed "
                "quantity on hand."
            ),
        )

    for field, value in update_data.items():
        setattr(
            inventory,
            field,
            value,
        )

    try:
        db.commit()
        db.refresh(inventory)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Unable to update inventory record "
                "because of a database conflict."
            ),
        )

    product = (
        db.query(Product)
        .filter(Product.id == inventory.product_id)
        .first()
    )

    return build_inventory_response(
        inventory,
        product,
    )


# =========================================================
# DELETE INVENTORY RECORD
# =========================================================

@router.delete(
    "/{inventory_id}",
)
def delete_inventory_record(
    inventory_id: int,
    db: Session = Depends(get_db),
):
    inventory = (
        db.query(Inventory)
        .filter(Inventory.id == inventory_id)
        .first()
    )

    if inventory is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory record not found.",
        )

    try:
        db.delete(inventory)
        db.commit()

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This inventory record cannot be deleted "
                "because it is linked to other records."
            ),
        )

    return {
        "message": "Inventory record deleted successfully."
    }