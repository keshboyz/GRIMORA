from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class GoodsReceiptItemCreate(BaseModel):
    purchase_order_item_id: int = Field(gt=0)

    quantity_received: int = Field(gt=0)

    accepted_quantity: int = Field(ge=0)

    rejected_quantity: int = Field(ge=0)

    remarks: Optional[str] = None


class GoodsReceiptCreate(BaseModel):
    purchase_order_id: int = Field(gt=0)

    delivery_note_number: Optional[str] = Field(
        default=None,
        max_length=50,
    )

    invoice_number: Optional[str] = Field(
        default=None,
        max_length=50,
    )

    remarks: Optional[str] = None

    items: List[GoodsReceiptItemCreate] = Field(
        min_length=1,
    )


class GoodsReceiptItemResponse(BaseModel):
    id: int

    purchase_order_item_id: int

    product_id: int
    product_code: str
    product_name: str

    quantity_received: int
    accepted_quantity: int
    rejected_quantity: int

    remarks: Optional[str]

    model_config = ConfigDict(
        from_attributes=True
    )


class GoodsReceiptResponse(BaseModel):
    id: int
    receipt_number: str

    purchase_order_id: int
    po_number: str

    received_by: int
    receiver_name: str

    receipt_date: date

    delivery_note_number: Optional[str]
    invoice_number: Optional[str]
    remarks: Optional[str]

    status: str

    created_at: datetime

    items: List[
        GoodsReceiptItemResponse
    ]

    model_config = ConfigDict(
        from_attributes=True
    )