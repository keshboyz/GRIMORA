from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from goods_receipt_schemas import (
    GoodsReceiptCreate,
    GoodsReceiptItemResponse,
    GoodsReceiptResponse,
)
from models import (
    GoodsReceipt,
    GoodsReceiptItem,
    Inventory,
    Product,
    PurchaseOrder,
    PurchaseOrderItem,
    StockMovement,
    User,
)


router = APIRouter(
    prefix="/api/goods-receipts",
    tags=["Goods Receiving"],
)


# =========================================================
# GENERATE GOODS RECEIPT NUMBER
# =========================================================

def generate_receipt_number(db: Session) -> str:
    year = date.today().year
    prefix = f"GRN-{year}-"

    latest_receipt = (
        db.query(GoodsReceipt)
        .filter(
            GoodsReceipt.receipt_number.like(
                f"{prefix}%"
            )
        )
        .order_by(GoodsReceipt.id.desc())
        .first()
    )

    if latest_receipt is None:
        next_number = 1
    else:
        try:
            current_number = int(
                latest_receipt.receipt_number.split("-")[-1]
            )
            next_number = current_number + 1
        except ValueError:
            next_number = latest_receipt.id + 1

    return f"{prefix}{next_number:04d}"


# =========================================================
# BUILD GOODS RECEIPT RESPONSE
# =========================================================

def build_receipt_response(
    receipt: GoodsReceipt,
    db: Session,
) -> GoodsReceiptResponse:

    purchase_order = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.id
            == receipt.purchase_order_id
        )
        .first()
    )

    receiver = (
        db.query(User)
        .filter(
            User.id
            == receipt.received_by
        )
        .first()
    )

    rows = (
        db.query(
            GoodsReceiptItem,
            Product,
        )
        .join(
            Product,
            GoodsReceiptItem.product_id
            == Product.id,
        )
        .filter(
            GoodsReceiptItem.goods_receipt_id
            == receipt.id
        )
        .order_by(
            GoodsReceiptItem.id.asc()
        )
        .all()
    )

    items = []

    for receipt_item, product in rows:
        items.append(
            GoodsReceiptItemResponse(
                id=receipt_item.id,
                purchase_order_item_id=(
                    receipt_item.purchase_order_item_id
                ),
                product_id=receipt_item.product_id,
                product_code=product.product_code,
                product_name=product.product_name,
                quantity_received=(
                    receipt_item.quantity_received
                ),
                accepted_quantity=(
                    receipt_item.accepted_quantity
                ),
                rejected_quantity=(
                    receipt_item.rejected_quantity
                ),
                remarks=receipt_item.remarks,
            )
        )

    return GoodsReceiptResponse(
        id=receipt.id,
        receipt_number=receipt.receipt_number,
        purchase_order_id=receipt.purchase_order_id,
        po_number=(
            purchase_order.po_number
            if purchase_order
            else "Unknown PO"
        ),
        received_by=receipt.received_by,
        receiver_name=(
            receiver.full_name
            if receiver
            else "Unknown User"
        ),
        receipt_date=receipt.receipt_date,
        delivery_note_number=(
            receipt.delivery_note_number
        ),
        invoice_number=receipt.invoice_number,
        remarks=receipt.remarks,
        status=receipt.status,
        created_at=receipt.created_at,
        items=items,
    )


# =========================================================
# CREATE GOODS RECEIPT
# =========================================================

@router.post(
    "",
    response_model=GoodsReceiptResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_goods_receipt(
    receipt_data: GoodsReceiptCreate,
    db: Session = Depends(get_db),
):

    # -----------------------------------------------------
    # VALIDATE PURCHASE ORDER
    # -----------------------------------------------------

    purchase_order = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.id
            == receipt_data.purchase_order_id
        )
        .first()
    )

    if purchase_order is None:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found.",
        )

    allowed_po_statuses = {
        "sent",
        "partially_received",
    }

    if purchase_order.status not in allowed_po_statuses:
        raise HTTPException(
            status_code=400,
            detail=(
                "Goods can only be received against "
                "a sent or partially received "
                "purchase order."
            ),
        )

    # -----------------------------------------------------
    # TEMPORARY RECEIVER
    # Later replaced by authenticated JWT user
    # -----------------------------------------------------

    receiver = (
        db.query(User)
        .filter(User.id == 1)
        .first()
    )

    if receiver is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "GRIMORA Administrator "
                "not found."
            ),
        )

    if not receiver.is_active:
        raise HTTPException(
            status_code=400,
            detail=(
                "The receiving user account "
                "is inactive."
            ),
        )

    # -----------------------------------------------------
    # PREVENT DUPLICATE PO ITEMS IN SAME RECEIPT
    # -----------------------------------------------------

    po_item_ids = [
        item.purchase_order_item_id
        for item in receipt_data.items
    ]

    if len(po_item_ids) != len(set(po_item_ids)):
        raise HTTPException(
            status_code=400,
            detail=(
                "The same purchase order item "
                "cannot appear more than once "
                "in a goods receipt."
            ),
        )

    # -----------------------------------------------------
    # VALIDATE EVERY RECEIPT ITEM BEFORE WRITING
    # -----------------------------------------------------

    validated_items = []

    for item_data in receipt_data.items:

        po_item = (
            db.query(PurchaseOrderItem)
            .filter(
                PurchaseOrderItem.id
                == item_data.purchase_order_item_id
            )
            .first()
        )

        if po_item is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Purchase order item "
                    f"{item_data.purchase_order_item_id} "
                    "was not found."
                ),
            )

        if (
            po_item.purchase_order_id
            != purchase_order.id
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "One or more receipt items "
                    "do not belong to the selected "
                    "purchase order."
                ),
            )

        if (
            item_data.accepted_quantity
            + item_data.rejected_quantity
            != item_data.quantity_received
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Accepted quantity plus rejected "
                    "quantity must equal the total "
                    "quantity received."
                ),
            )

        outstanding_quantity = (
            po_item.quantity
            - po_item.quantity_received
        )

        if outstanding_quantity <= 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    "This purchase order item "
                    "has already been fully received."
                ),
            )

        if (
            item_data.quantity_received
            > outstanding_quantity
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Quantity received cannot exceed "
                    "the outstanding purchase order "
                    "quantity."
                ),
            )

        product = (
            db.query(Product)
            .filter(
                Product.id
                == po_item.product_id
            )
            .first()
        )

        if product is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Product linked to purchase "
                    "order item was not found."
                ),
            )

        validated_items.append(
            {
                "input": item_data,
                "po_item": po_item,
                "product": product,
            }
        )

    # -----------------------------------------------------
    # CREATE RECEIPT AND ALL RELATED TRANSACTIONS
    # -----------------------------------------------------

    try:
        receipt = GoodsReceipt(
            receipt_number=(
                generate_receipt_number(db)
            ),
            purchase_order_id=(
                purchase_order.id
            ),
            received_by=receiver.id,
            delivery_note_number=(
                receipt_data.delivery_note_number
            ),
            invoice_number=(
                receipt_data.invoice_number
            ),
            remarks=receipt_data.remarks,

            # Allowed by existing DB constraint:
            # draft / completed / cancelled
            status="completed",
        )

        db.add(receipt)
        db.flush()

        for validated in validated_items:

            item_data = validated["input"]
            po_item = validated["po_item"]
            product = validated["product"]

            # ---------------------------------------------
            # CREATE GOODS RECEIPT ITEM
            # ---------------------------------------------

            receipt_item = GoodsReceiptItem(
                goods_receipt_id=receipt.id,
                purchase_order_item_id=po_item.id,
                product_id=product.id,
                quantity_received=(
                    item_data.quantity_received
                ),
                accepted_quantity=(
                    item_data.accepted_quantity
                ),
                rejected_quantity=(
                    item_data.rejected_quantity
                ),
                remarks=item_data.remarks,
            )

            db.add(receipt_item)

            # ---------------------------------------------
            # UPDATE PO QUANTITY RECEIVED
            #
            # Physical receipt quantity is used here.
            # Rejected goods remain recorded as received
            # but do not enter usable inventory.
            # ---------------------------------------------

            po_item.quantity_received += (
                item_data.quantity_received
            )

            # ---------------------------------------------
            # UPDATE INVENTORY USING ACCEPTED GOODS ONLY
            # ---------------------------------------------

            if item_data.accepted_quantity > 0:

                inventory = (
                    db.query(Inventory)
                    .filter(
                        Inventory.product_id
                        == product.id
                    )
                    .first()
                )

                if inventory is None:
                    inventory = Inventory(
                        product_id=product.id,
                        quantity_on_hand=0,
                        quantity_reserved=0,
                        storage_location=(
                            "Main Store"
                        ),
                    )

                    db.add(inventory)
                    db.flush()

                inventory.quantity_on_hand += (
                    item_data.accepted_quantity
                )

                # -----------------------------------------
                # CREATE STOCK MOVEMENT
                # -----------------------------------------

                movement = StockMovement(
                    product_id=product.id,
                    movement_type="receipt",
                    quantity=(
                        item_data.accepted_quantity
                    ),
                    reference_type=(
                        "goods_receipt"
                    ),
                    reference_id=receipt.id,
                    performed_by=receiver.id,
                    remarks=(
                        "Stock received through "
                        f"{receipt.receipt_number} "
                        f"against {purchase_order.po_number}."
                    ),
                )

                db.add(movement)

        # -------------------------------------------------
        # DETERMINE PURCHASE ORDER STATUS
        # -------------------------------------------------

        all_po_items = (
            db.query(PurchaseOrderItem)
            .filter(
                PurchaseOrderItem.purchase_order_id
                == purchase_order.id
            )
            .all()
        )

        fully_received = all(
            item.quantity_received >= item.quantity
            for item in all_po_items
        )

        if fully_received:
            purchase_order.status = "received"
        else:
            purchase_order.status = (
                "partially_received"
            )

        db.commit()
        db.refresh(receipt)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "Unable to record goods receipt "
                "because of a database conflict."
            ),
        )

    except Exception:
        db.rollback()
        raise

    return build_receipt_response(
        receipt,
        db,
    )


# =========================================================
# GET ALL GOODS RECEIPTS
# =========================================================

@router.get(
    "",
    response_model=list[GoodsReceiptResponse],
)
def get_goods_receipts(
    db: Session = Depends(get_db),
):

    receipts = (
        db.query(GoodsReceipt)
        .order_by(
            GoodsReceipt.id.desc()
        )
        .all()
    )

    return [
        build_receipt_response(
            receipt,
            db,
        )
        for receipt in receipts
    ]


# =========================================================
# GET ONE GOODS RECEIPT
# =========================================================

@router.get(
    "/{receipt_id}",
    response_model=GoodsReceiptResponse,
)
def get_goods_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
):

    receipt = (
        db.query(GoodsReceipt)
        .filter(
            GoodsReceipt.id
            == receipt_id
        )
        .first()
    )

    if receipt is None:
        raise HTTPException(
            status_code=404,
            detail="Goods receipt not found.",
        )

    return build_receipt_response(
        receipt,
        db,
    )