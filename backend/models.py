from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.sql import func

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="requester")
    department = Column(String(100))
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True)
    supplier_code = Column(String(30), unique=True, nullable=False)
    supplier_name = Column(String(150), nullable=False)
    contact_person = Column(String(150))
    email = Column(String(150))
    phone = Column(String(30))
    address = Column(Text)
    tax_number = Column(String(50))
    category = Column(String(100))
    status = Column(String(30), nullable=False, default="active")
    performance_rating = Column(Numeric(3, 2))
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True)
    product_code = Column(String(30), unique=True, nullable=False)
    product_name = Column(String(150), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    unit_of_measure = Column(String(30), nullable=False)
    unit_price = Column(Numeric(14, 2), nullable=False, default=0)
    reorder_level = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())


class PurchaseRequest(Base):
    __tablename__ = "purchase_requests"

    id = Column(Integer, primary_key=True)
    request_number = Column(String(30), unique=True, nullable=False)

    requested_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    department = Column(String(100))
    request_date = Column(Date, nullable=False, server_default=func.current_date())
    required_date = Column(Date)
    purpose = Column(Text)
    priority = Column(String(20), nullable=False, default="normal")
    status = Column(String(30), nullable=False, default="draft")

    approved_by = Column(
        Integer,
        ForeignKey("users.id"),
    )

    approved_at = Column(DateTime)
    rejection_reason = Column(Text)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())


class PurchaseRequestItem(Base):
    __tablename__ = "purchase_request_items"

    id = Column(Integer, primary_key=True)

    purchase_request_id = Column(
        Integer,
        ForeignKey("purchase_requests.id", ondelete="CASCADE"),
        nullable=False,
    )

    product_id = Column(
        Integer,
        ForeignKey("products.id"),
        nullable=False,
    )

    quantity = Column(Integer, nullable=False)

    estimated_unit_price = Column(
        Numeric(14, 2),
        nullable=False,
        default=0,
    )

    specifications = Column(Text)
    created_at = Column(DateTime, nullable=False, server_default=func.now())


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True)
    po_number = Column(String(30), unique=True, nullable=False)

    supplier_id = Column(
        Integer,
        ForeignKey("suppliers.id"),
        nullable=False,
    )

    purchase_request_id = Column(
        Integer,
        ForeignKey("purchase_requests.id"),
    )

    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    order_date = Column(Date, nullable=False, server_default=func.current_date())
    expected_delivery_date = Column(Date)
    delivery_address = Column(Text)
    payment_terms = Column(String(100))
    notes = Column(Text)
    status = Column(String(30), nullable=False, default="draft")

    subtotal = Column(Numeric(14, 2), nullable=False, default=0)
    tax_amount = Column(Numeric(14, 2), nullable=False, default=0)
    total_amount = Column(Numeric(14, 2), nullable=False, default=0)

    approved_by = Column(
        Integer,
        ForeignKey("users.id"),
    )

    approved_at = Column(DateTime)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id = Column(Integer, primary_key=True)

    purchase_order_id = Column(
        Integer,
        ForeignKey("purchase_orders.id", ondelete="CASCADE"),
        nullable=False,
    )

    product_id = Column(
        Integer,
        ForeignKey("products.id"),
        nullable=False,
    )

    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(14, 2), nullable=False)
    line_total = Column(Numeric(14, 2), nullable=False)
    quantity_received = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, server_default=func.now())


class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True)

    product_id = Column(
        Integer,
        ForeignKey("products.id"),
        unique=True,
        nullable=False,
    )

    quantity_on_hand = Column(Integer, nullable=False, default=0)
    quantity_reserved = Column(Integer, nullable=False, default=0)
    storage_location = Column(String(100))
    last_updated = Column(DateTime, nullable=False, server_default=func.now())


class GoodsReceipt(Base):
    __tablename__ = "goods_receipts"

    id = Column(Integer, primary_key=True)
    receipt_number = Column(String(30), unique=True, nullable=False)

    purchase_order_id = Column(
        Integer,
        ForeignKey("purchase_orders.id"),
        nullable=False,
    )

    received_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    receipt_date = Column(Date, nullable=False, server_default=func.current_date())
    delivery_note_number = Column(String(50))
    invoice_number = Column(String(50))
    remarks = Column(Text)
    status = Column(String(30), nullable=False, default="completed")
    created_at = Column(DateTime, nullable=False, server_default=func.now())


class GoodsReceiptItem(Base):
    __tablename__ = "goods_receipt_items"

    id = Column(Integer, primary_key=True)

    goods_receipt_id = Column(
        Integer,
        ForeignKey("goods_receipts.id", ondelete="CASCADE"),
        nullable=False,
    )

    purchase_order_item_id = Column(
        Integer,
        ForeignKey("purchase_order_items.id"),
        nullable=False,
    )

    product_id = Column(
        Integer,
        ForeignKey("products.id"),
        nullable=False,
    )

    quantity_received = Column(Integer, nullable=False)
    accepted_quantity = Column(Integer, nullable=False, default=0)
    rejected_quantity = Column(Integer, nullable=False, default=0)
    remarks = Column(Text)
    created_at = Column(DateTime, nullable=False, server_default=func.now())


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True)

    product_id = Column(
        Integer,
        ForeignKey("products.id"),
        nullable=False,
    )

    movement_type = Column(String(30), nullable=False)
    quantity = Column(Integer, nullable=False)
    reference_type = Column(String(30))
    reference_id = Column(Integer)

    performed_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    movement_date = Column(DateTime, nullable=False, server_default=func.now())
    remarks = Column(Text)