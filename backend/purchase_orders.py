from datetime import date
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from models import (
    Product,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseRequest,
    Supplier,
    User,
)
from purchase_order_schemas import (
    PurchaseOrderCreate,
    PurchaseOrderItemResponse,
    PurchaseOrderResponse,
)


router = APIRouter(
    prefix="/api/purchase-orders",
    tags=["Purchase Orders"],
)


# =========================================================
# GENERATE PURCHASE ORDER NUMBER
# =========================================================

def generate_po_number(db: Session) -> str:
    year = date.today().year
    prefix = f"PO-{year}-"

    latest_po = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.po_number.like(
                f"{prefix}%"
            )
        )
        .order_by(PurchaseOrder.id.desc())
        .first()
    )

    if latest_po is None:
        next_number = 1
    else:
        try:
            current_number = int(
                latest_po.po_number.split("-")[-1]
            )
            next_number = current_number + 1

        except ValueError:
            next_number = latest_po.id + 1

    return f"{prefix}{next_number:04d}"


# =========================================================
# BUILD PURCHASE ORDER RESPONSE
# =========================================================

def build_po_response(
    purchase_order: PurchaseOrder,
    db: Session,
) -> PurchaseOrderResponse:

    supplier = (
        db.query(Supplier)
        .filter(
            Supplier.id
            == purchase_order.supplier_id
        )
        .first()
    )

    creator = (
        db.query(User)
        .filter(
            User.id
            == purchase_order.created_by
        )
        .first()
    )

    purchase_request = None

    if purchase_order.purchase_request_id:
        purchase_request = (
            db.query(PurchaseRequest)
            .filter(
                PurchaseRequest.id
                == purchase_order.purchase_request_id
            )
            .first()
        )

    rows = (
        db.query(
            PurchaseOrderItem,
            Product,
        )
        .join(
            Product,
            PurchaseOrderItem.product_id
            == Product.id,
        )
        .filter(
            PurchaseOrderItem.purchase_order_id
            == purchase_order.id
        )
        .order_by(
            PurchaseOrderItem.id.asc()
        )
        .all()
    )

    items = []

    for item, product in rows:
        items.append(
            PurchaseOrderItemResponse(
                id=item.id,
                product_id=product.id,
                product_code=(
                    product.product_code
                ),
                product_name=(
                    product.product_name
                ),
                quantity=item.quantity,
                unit_price=item.unit_price,
                line_total=item.line_total,
                quantity_received=(
                    item.quantity_received
                ),
            )
        )

    return PurchaseOrderResponse(
        id=purchase_order.id,
        po_number=purchase_order.po_number,

        supplier_id=(
            purchase_order.supplier_id
        ),

        supplier_name=(
            supplier.supplier_name
            if supplier
            else "Unknown Supplier"
        ),

        purchase_request_id=(
            purchase_order.purchase_request_id
        ),

        request_number=(
            purchase_request.request_number
            if purchase_request
            else None
        ),

        created_by=(
            purchase_order.created_by
        ),

        creator_name=(
            creator.full_name
            if creator
            else "Unknown User"
        ),

        order_date=(
            purchase_order.order_date
        ),

        expected_delivery_date=(
            purchase_order.expected_delivery_date
        ),

        delivery_address=(
            purchase_order.delivery_address
        ),

        payment_terms=(
            purchase_order.payment_terms
        ),

        notes=purchase_order.notes,

        status=purchase_order.status,

        subtotal=purchase_order.subtotal,

        tax_amount=(
            purchase_order.tax_amount
        ),

        total_amount=(
            purchase_order.total_amount
        ),

        approved_by=(
            purchase_order.approved_by
        ),

        approved_at=(
            purchase_order.approved_at
        ),

        created_at=(
            purchase_order.created_at
        ),

        updated_at=(
            purchase_order.updated_at
        ),

        items=items,
    )


# =========================================================
# CREATE PURCHASE ORDER
# =========================================================

@router.post(
    "",
    response_model=PurchaseOrderResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_purchase_order(
    order_data: PurchaseOrderCreate,
    db: Session = Depends(get_db),
):

    # -----------------------------------------------------
    # VALIDATE SUPPLIER
    # -----------------------------------------------------

    supplier = (
        db.query(Supplier)
        .filter(
            Supplier.id
            == order_data.supplier_id
        )
        .first()
    )

    if supplier is None:
        raise HTTPException(
            status_code=404,
            detail="Supplier not found.",
        )

    if supplier.status.lower() != "active":
        raise HTTPException(
            status_code=400,
            detail=(
                "Purchase orders can only be "
                "issued to active suppliers."
            ),
        )

    # -----------------------------------------------------
    # VALIDATE PURCHASE REQUEST
    # -----------------------------------------------------

    purchase_request = (
        db.query(PurchaseRequest)
        .filter(
            PurchaseRequest.id
            == order_data.purchase_request_id
        )
        .first()
    )

    if purchase_request is None:
        raise HTTPException(
            status_code=404,
            detail="Purchase request not found.",
        )

    if purchase_request.status != "approved":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only approved purchase requests "
                "can be converted into "
                "purchase orders."
            ),
        )

    # -----------------------------------------------------
    # PREVENT DUPLICATE PO
    # -----------------------------------------------------

    existing_po = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.purchase_request_id
            == purchase_request.id
        )
        .first()
    )

    if existing_po:
        raise HTTPException(
            status_code=409,
            detail=(
                "A purchase order already exists "
                "for this purchase request."
            ),
        )

    # -----------------------------------------------------
    # TEMPORARY CREATOR
    # User ID 1 will later be replaced by JWT user
    # -----------------------------------------------------

    creator = (
        db.query(User)
        .filter(User.id == 1)
        .first()
    )

    if creator is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "GRIMORA Administrator "
                "not found."
            ),
        )

    if not creator.is_active:
        raise HTTPException(
            status_code=400,
            detail=(
                "The current user account "
                "is inactive."
            ),
        )

    # -----------------------------------------------------
    # VALIDATE DELIVERY DATE
    # -----------------------------------------------------

    if (
        order_data.expected_delivery_date
        and order_data.expected_delivery_date
        < date.today()
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Expected delivery date "
                "cannot be in the past."
            ),
        )

    # -----------------------------------------------------
    # VALIDATE PRODUCTS
    # -----------------------------------------------------

    product_ids = [
        item.product_id
        for item in order_data.items
    ]

    if len(product_ids) != len(set(product_ids)):
        raise HTTPException(
            status_code=400,
            detail=(
                "The same product cannot "
                "appear more than once in "
                "a purchase order."
            ),
        )

    products = (
        db.query(Product)
        .filter(
            Product.id.in_(product_ids)
        )
        .all()
    )

    if len(products) != len(product_ids):
        raise HTTPException(
            status_code=404,
            detail=(
                "One or more selected "
                "products were not found."
            ),
        )

    # -----------------------------------------------------
    # CALCULATE TOTALS
    # -----------------------------------------------------

    subtotal = Decimal("0.00")

    for item in order_data.items:
        subtotal += (
            Decimal(item.quantity)
            * Decimal(item.unit_price)
        )

    tax_amount = Decimal(
        order_data.tax_amount
    )

    total_amount = (
        subtotal + tax_amount
    )

    # -----------------------------------------------------
    # CREATE PURCHASE ORDER
    #
    # Database permits:
    # draft
    # pending_approval
    # approved
    # sent
    # partially_received
    # received
    # cancelled
    #
    # Since the linked PR is already approved and the PO
    # is being issued to the supplier, its initial status
    # is "sent".
    # -----------------------------------------------------

    purchase_order = PurchaseOrder(
        po_number=generate_po_number(db),

        supplier_id=(
            order_data.supplier_id
        ),

        purchase_request_id=(
            order_data.purchase_request_id
        ),

        created_by=creator.id,

        expected_delivery_date=(
            order_data.expected_delivery_date
        ),

        delivery_address=(
            order_data.delivery_address
        ),

        payment_terms=(
            order_data.payment_terms
        ),

        notes=order_data.notes,

        status="sent",

        subtotal=subtotal,

        tax_amount=tax_amount,

        total_amount=total_amount,
    )

    # -----------------------------------------------------
    # SAVE PO HEADER AND ITEMS
    # -----------------------------------------------------

    try:
        db.add(purchase_order)
        db.flush()

        for item_data in order_data.items:

            line_total = (
                Decimal(item_data.quantity)
                * Decimal(
                    item_data.unit_price
                )
            )

            order_item = PurchaseOrderItem(
                purchase_order_id=(
                    purchase_order.id
                ),

                product_id=(
                    item_data.product_id
                ),

                quantity=(
                    item_data.quantity
                ),

                unit_price=(
                    item_data.unit_price
                ),

                line_total=line_total,

                quantity_received=0,
            )

            db.add(order_item)

        db.commit()
        db.refresh(purchase_order)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "Unable to create purchase order "
                "because of a database conflict."
            ),
        )

    return build_po_response(
        purchase_order,
        db,
    )


# =========================================================
# GET ALL PURCHASE ORDERS
# =========================================================

@router.get(
    "",
    response_model=List[
        PurchaseOrderResponse
    ],
)
def get_purchase_orders(
    db: Session = Depends(get_db),
):

    purchase_orders = (
        db.query(PurchaseOrder)
        .order_by(
            PurchaseOrder.id.desc()
        )
        .all()
    )

    return [
        build_po_response(
            purchase_order,
            db,
        )
        for purchase_order
        in purchase_orders
    ]


# =========================================================
# GET ONE PURCHASE ORDER
# =========================================================

@router.get(
    "/{order_id}",
    response_model=PurchaseOrderResponse,
)
def get_purchase_order(
    order_id: int,
    db: Session = Depends(get_db),
):

    purchase_order = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.id
            == order_id
        )
        .first()
    )

    if purchase_order is None:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found.",
        )

    return build_po_response(
        purchase_order,
        db,
    )