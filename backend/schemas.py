from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# =========================================================
# USER SCHEMAS
# =========================================================

class UserCreate(BaseModel):
    full_name: str = Field(
        min_length=2,
        max_length=150,
    )

    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=72,
    )

    role: str = Field(
        default="requester",
        max_length=50,
    )

    department: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    is_active: bool = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=150,
    )

    email: Optional[EmailStr] = None

    role: Optional[str] = Field(
        default=None,
        max_length=50,
    )

    department: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: str
    department: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =========================================================
# SUPPLIER SCHEMAS
# =========================================================

class SupplierBase(BaseModel):
    supplier_code: str = Field(min_length=2, max_length=30)
    supplier_name: str = Field(min_length=2, max_length=150)

    contact_person: Optional[str] = Field(
        default=None,
        max_length=150,
    )

    email: Optional[EmailStr] = None

    phone: Optional[str] = Field(
        default=None,
        max_length=30,
    )

    address: Optional[str] = None

    tax_number: Optional[str] = Field(
        default=None,
        max_length=50,
    )

    category: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    status: str = Field(
        default="active",
        max_length=30,
    )

    performance_rating: Optional[Decimal] = Field(
        default=None,
        ge=0,
        le=5,
    )


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    supplier_name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=150,
    )

    contact_person: Optional[str] = Field(
        default=None,
        max_length=150,
    )

    email: Optional[EmailStr] = None

    phone: Optional[str] = Field(
        default=None,
        max_length=30,
    )

    address: Optional[str] = None

    tax_number: Optional[str] = Field(
        default=None,
        max_length=50,
    )

    category: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    status: Optional[str] = Field(
        default=None,
        max_length=30,
    )

    performance_rating: Optional[Decimal] = Field(
        default=None,
        ge=0,
        le=5,
    )


class SupplierResponse(SupplierBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =========================================================
# PRODUCT SCHEMAS
# =========================================================

class ProductBase(BaseModel):
    product_code: str = Field(
        min_length=2,
        max_length=30,
    )

    product_name: str = Field(
        min_length=2,
        max_length=150,
    )

    description: Optional[str] = None

    category: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    unit_of_measure: str = Field(
        min_length=1,
        max_length=30,
    )

    unit_price: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
    )

    reorder_level: int = Field(
        default=0,
        ge=0,
    )

    is_active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    product_name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=150,
    )

    description: Optional[str] = None

    category: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    unit_of_measure: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=30,
    )

    unit_price: Optional[Decimal] = Field(
        default=None,
        ge=0,
    )

    reorder_level: Optional[int] = Field(
        default=None,
        ge=0,
    )

    is_active: Optional[bool] = None


class ProductResponse(ProductBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =========================================================
# INVENTORY SCHEMAS
# =========================================================

class InventoryCreate(BaseModel):
    product_id: int = Field(gt=0)

    quantity_on_hand: int = Field(
        default=0,
        ge=0,
    )

    quantity_reserved: int = Field(
        default=0,
        ge=0,
    )

    storage_location: Optional[str] = Field(
        default=None,
        max_length=100,
    )


class InventoryUpdate(BaseModel):
    quantity_on_hand: Optional[int] = Field(
        default=None,
        ge=0,
    )

    quantity_reserved: Optional[int] = Field(
        default=None,
        ge=0,
    )

    storage_location: Optional[str] = Field(
        default=None,
        max_length=100,
    )


class InventoryResponse(BaseModel):
    id: int
    product_id: int
    product_code: str
    product_name: str
    category: Optional[str]
    unit_of_measure: str
    unit_price: Decimal
    reorder_level: int
    quantity_on_hand: int
    quantity_reserved: int
    available_quantity: int
    storage_location: Optional[str]
    stock_status: str
    stock_value: Decimal
    last_updated: datetime

    model_config = ConfigDict(from_attributes=True)


# =========================================================
# STOCK MOVEMENT SCHEMAS
# =========================================================

class StockMovementCreate(BaseModel):
    product_id: int = Field(gt=0)

    movement_type: str = Field(
        min_length=1,
        max_length=30,
    )

    quantity: int = Field(gt=0)

    reference_type: Optional[str] = Field(
        default=None,
        max_length=30,
    )

    reference_id: Optional[int] = Field(
        default=None,
        gt=0,
    )

    performed_by: int = Field(gt=0)

    remarks: Optional[str] = None


class StockMovementResponse(BaseModel):
    id: int
    product_id: int
    movement_type: str
    quantity: int
    reference_type: Optional[str]
    reference_id: Optional[int]
    performed_by: int
    movement_date: datetime
    remarks: Optional[str]

    model_config = ConfigDict(from_attributes=True)