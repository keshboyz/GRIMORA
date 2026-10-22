
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


# =========================================================
# PURCHASE REQUEST ITEM SCHEMAS
# =========================================================

class PurchaseRequestItemCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)

    estimated_unit_price: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
    )

    specifications: Optional[str] = None


class PurchaseRequestItemResponse(BaseModel):
    id: int
    product_id: int
    product_code: str
    product_name: str
    quantity: int
    estimated_unit_price: Decimal
    estimated_total: Decimal
    specifications: Optional[str]

    model_config = ConfigDict(from_attributes=True)


# =========================================================
# PURCHASE REQUEST SCHEMAS
# =========================================================

class PurchaseRequestCreate(BaseModel):
    department: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    required_date: Optional[date] = None
    purpose: Optional[str] = None

    priority: str = Field(
        default="normal",
        max_length=20,
    )

    items: List[PurchaseRequestItemCreate] = Field(
        min_length=1,
    )


class PurchaseRequestResponse(BaseModel):
    id: int
    request_number: str
    requested_by: int
    requester_name: str
    department: Optional[str]
    request_date: date
    required_date: Optional[date]
    purpose: Optional[str]
    priority: str
    status: str
    approved_by: Optional[int]
    approved_at: Optional[datetime]
    rejection_reason: Optional[str]
    estimated_total: Decimal
    created_at: datetime
    updated_at: datetime
    items: List[PurchaseRequestItemResponse]


# =========================================================
# APPROVAL SCHEMAS
# =========================================================

class PurchaseRequestApproval(BaseModel):
    approved_by: int = Field(gt=0)


class PurchaseRequestRejection(BaseModel):
    rejection_reason: str = Field(
        min_length=3,
        max_length=500,
    )
