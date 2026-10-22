from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class PurchaseOrderItemCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)
    unit_price: Decimal = Field(ge=0)


class PurchaseOrderCreate(BaseModel):
    supplier_id: int = Field(gt=0)
    purchase_request_id: int = Field(gt=0)

    expected_delivery_date: Optional[date] = None
    delivery_address: Optional[str] = None

    payment_terms: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    notes: Optional[str] = None

    tax_amount: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
    )

    items: List[PurchaseOrderItemCreate] = Field(
        min_length=1,
    )


class PurchaseOrderItemResponse(BaseModel):
    id: int
    product_id: int
    product_code: str
    product_name: str
    quantity: int
    unit_price: Decimal
    line_total: Decimal
    quantity_received: int

    model_config = ConfigDict(from_attributes=True)


class PurchaseOrderResponse(BaseModel):
    id: int
    po_number: str

    supplier_id: int
    supplier_name: str

    purchase_request_id: Optional[int]
    request_number: Optional[str]

    created_by: int
    creator_name: str

    order_date: date
    expected_delivery_date: Optional[date]

    delivery_address: Optional[str]
    payment_terms: Optional[str]
    notes: Optional[str]

    status: str

    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal

    approved_by: Optional[int]
    approved_at: Optional[datetime]

    created_at: datetime
    updated_at: datetime

    items: List[PurchaseOrderItemResponse]