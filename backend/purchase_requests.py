
from datetime import date, datetime
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import (
    Product,
    PurchaseRequest,
    PurchaseRequestItem,
    User,
)
from purchase_request_schemas import (
    PurchaseRequestCreate,
    PurchaseRequestItemResponse,
    PurchaseRequestRejection,
    PurchaseRequestResponse,
)


router = APIRouter(
    prefix="/api/purchase-requests",
    tags=["Purchase Requests"],
)

ALLOWED_PRIORITIES = {
    "low",
    "normal",
    "high",
    "urgent",
}

CREATE_ROLES = {
    "admin",
    "procurement_officer",
    "requester",
}

APPROVAL_ROLES = {
    "admin",
    "approver",
}

VIEW_ALL_ROLES = {
    "admin",
    "procurement_officer",
    "approver",
}


# =========================================================
# AUTHORIZATION HELPERS
# =========================================================

def require_role(
    current_user: User,
    allowed_roles: set,
):
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "You do not have permission "
                "to perform this action."
            ),
        )


def can_view_request(
    current_user: User,
    purchase_request: PurchaseRequest,
) -> bool:
    return (
        current_user.role in VIEW_ALL_ROLES
        or purchase_request.requested_by == current_user.id
    )


def require_request_visibility(
    current_user: User,
    purchase_request: PurchaseRequest,
):
    if not can_view_request(current_user, purchase_request):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase request not found.",
        )


def require_separate_approver(
    current_user: User,
    purchase_request: PurchaseRequest,
):
    if purchase_request.requested_by == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Separation of duties violation: "
                "you cannot approve or reject "
                "a purchase request you created. "
                "Another authorized user must "
                "review this request."
            ),
        )


# =========================================================
# REQUEST NUMBER GENERATION
# =========================================================

def generate_request_number(db: Session) -> str:
    year = date.today().year
    prefix = f"PR-{year}-"

    latest_request = (
        db.query(PurchaseRequest)
        .filter(
            PurchaseRequest.request_number.like(
                f"{prefix}%"
            )
        )
        .order_by(PurchaseRequest.id.desc())
        .first()
    )

    if latest_request is None:
        next_number = 1
    else:
        try:
            current_number = int(
                latest_request.request_number.split("-")[-1]
            )
            next_number = current_number + 1
        except ValueError:
            next_number = latest_request.id + 1

    return f"{prefix}{next_number:04d}"


# =========================================================
# RESPONSE BUILDER
# =========================================================

def build_purchase_request_response(
    purchase_request: PurchaseRequest,
    db: Session,
) -> PurchaseRequestResponse:

    requester = (
        db.query(User)
        .filter(
            User.id == purchase_request.requested_by
        )
        .first()
    )

    request_items = (
        db.query(PurchaseRequestItem, Product)
        .join(
            Product,
            PurchaseRequestItem.product_id == Product.id,
        )
        .filter(
            PurchaseRequestItem.purchase_request_id
            == purchase_request.id
        )
        .order_by(PurchaseRequestItem.id.asc())
        .all()
    )

    items = []
    estimated_total = Decimal("0.00")

    for item, product in request_items:
        item_total = (
            Decimal(item.quantity)
            * Decimal(item.estimated_unit_price)
        )

        estimated_total += item_total

        items.append(
            PurchaseRequestItemResponse(
                id=item.id,
                product_id=product.id,
                product_code=product.product_code,
                product_name=product.product_name,
                quantity=item.quantity,
                estimated_unit_price=item.estimated_unit_price,
                estimated_total=item_total,
                specifications=item.specifications,
            )
        )

    return PurchaseRequestResponse(
        id=purchase_request.id,
        request_number=purchase_request.request_number,
        requested_by=purchase_request.requested_by,
        requester_name=(
            requester.full_name
            if requester
            else "Unknown User"
        ),
        department=purchase_request.department,
        request_date=purchase_request.request_date,
        required_date=purchase_request.required_date,
        purpose=purchase_request.purpose,
        priority=purchase_request.priority,
        status=purchase_request.status,
        approved_by=purchase_request.approved_by,
        approved_at=purchase_request.approved_at,
        rejection_reason=purchase_request.rejection_reason,
        estimated_total=estimated_total,
        created_at=purchase_request.created_at,
        updated_at=purchase_request.updated_at,
        items=items,
    )


# =========================================================
# REQUEST LOOKUP
# =========================================================

def get_request_or_404(
    request_id: int,
    db: Session,
):
    purchase_request = (
        db.query(PurchaseRequest)
        .filter(PurchaseRequest.id == request_id)
        .first()
    )

    if purchase_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase request not found.",
        )

    return purchase_request


# =========================================================
# CREATE PURCHASE REQUEST
# =========================================================

@router.post(
    "",
    response_model=PurchaseRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_purchase_request(
    request_data: PurchaseRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_role(current_user, CREATE_ROLES)

    priority = request_data.priority.lower().strip()

    if priority not in ALLOWED_PRIORITIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Priority must be low, normal, "
                "high or urgent."
            ),
        )

    if (
        request_data.required_date
        and request_data.required_date < date.today()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Required date cannot be in the past.",
        )

    product_ids = [
        item.product_id
        for item in request_data.items
    ]

    if len(product_ids) != len(set(product_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "The same product cannot appear "
                "more than once in a purchase request."
            ),
        )

    products = (
        db.query(Product)
        .filter(Product.id.in_(product_ids))
        .all()
    )

    if len(products) != len(product_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "One or more selected products "
                "could not be found."
            ),
        )

    department = (
        request_data.department
        or current_user.department
    )

    purchase_request = PurchaseRequest(
        request_number=generate_request_number(db),
        requested_by=current_user.id,
        department=department,
        required_date=request_data.required_date,
        purpose=request_data.purpose,
        priority=priority,
        status="submitted",
    )

    try:
        db.add(purchase_request)
        db.flush()

        for item_data in request_data.items:
            request_item = PurchaseRequestItem(
                purchase_request_id=purchase_request.id,
                product_id=item_data.product_id,
                quantity=item_data.quantity,
                estimated_unit_price=(
                    item_data.estimated_unit_price
                ),
                specifications=item_data.specifications,
            )

            db.add(request_item)

        db.commit()
        db.refresh(purchase_request)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Unable to create purchase request "
                "because of a database conflict."
            ),
        )

    return build_purchase_request_response(
        purchase_request,
        db,
    )


# =========================================================
# GET ALL VISIBLE PURCHASE REQUESTS
# =========================================================

@router.get(
    "",
    response_model=List[PurchaseRequestResponse],
)
def get_purchase_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(PurchaseRequest)

    if current_user.role not in VIEW_ALL_ROLES:
        query = query.filter(
            PurchaseRequest.requested_by == current_user.id
        )

    requests = (
        query
        .order_by(PurchaseRequest.id.desc())
        .all()
    )

    return [
        build_purchase_request_response(
            purchase_request,
            db,
        )
        for purchase_request in requests
    ]


# =========================================================
# APPROVE PURCHASE REQUEST
# =========================================================

@router.patch(
    "/{request_id}/approve",
    response_model=PurchaseRequestResponse,
)
def approve_purchase_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_role(current_user, APPROVAL_ROLES)

    purchase_request = get_request_or_404(
        request_id,
        db,
    )

    require_separate_approver(
        current_user,
        purchase_request,
    )

    if purchase_request.status != "submitted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only submitted purchase requests "
                "can be approved."
            ),
        )

    purchase_request.status = "approved"
    purchase_request.approved_by = current_user.id
    purchase_request.approved_at = datetime.now()
    purchase_request.rejection_reason = None

    db.commit()
    db.refresh(purchase_request)

    return build_purchase_request_response(
        purchase_request,
        db,
    )


# =========================================================
# REJECT PURCHASE REQUEST
# =========================================================

@router.patch(
    "/{request_id}/reject",
    response_model=PurchaseRequestResponse,
)
def reject_purchase_request(
    request_id: int,
    rejection_data: PurchaseRequestRejection,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_role(current_user, APPROVAL_ROLES)

    purchase_request = get_request_or_404(
        request_id,
        db,
    )

    require_separate_approver(
        current_user,
        purchase_request,
    )

    if purchase_request.status != "submitted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only submitted purchase requests "
                "can be rejected."
            ),
        )

    rejection_reason = (
        rejection_data.rejection_reason.strip()
    )

    if len(rejection_reason) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Rejection reason must contain "
                "at least 3 characters."
            ),
        )

    purchase_request.status = "rejected"
    purchase_request.approved_by = current_user.id
    purchase_request.approved_at = datetime.now()
    purchase_request.rejection_reason = rejection_reason

    db.commit()
    db.refresh(purchase_request)

    return build_purchase_request_response(
        purchase_request,
        db,
    )


# =========================================================
# GET ONE PURCHASE REQUEST
# =========================================================

@router.get(
    "/{request_id}",
    response_model=PurchaseRequestResponse,
)
def get_purchase_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    purchase_request = get_request_or_404(
        request_id,
        db,
    )

    require_request_visibility(
        current_user,
        purchase_request,
    )

    return build_purchase_request_response(
        purchase_request,
        db,
    )
