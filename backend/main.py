from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import router as auth_router
from database import test_database_connection
from goods_receipts import router as goods_receipts_router
from inventory import router as inventory_router
from products import router as products_router
from purchase_orders import router as purchase_orders_router
from purchase_requests import router as purchase_requests_router
from stock_movements import router as stock_movements_router
from suppliers import router as suppliers_router
from users import router as users_router


app = FastAPI(
    title="GRIMORA API",
    description=(
        "Backend API for the GRIMORA Procurement "
        "and Inventory Management System."
    ),
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(suppliers_router)
app.include_router(products_router)
app.include_router(inventory_router)
app.include_router(stock_movements_router)
app.include_router(users_router)
app.include_router(purchase_requests_router)
app.include_router(purchase_orders_router)
app.include_router(goods_receipts_router)


@app.get("/")
def root():
    return {
        "application": "GRIMORA",
        "message": "GRIMORA API is running.",
        "version": "1.0.0",
    }


@app.get("/api/health")
def health_check():
    result = test_database_connection()

    if result["connected"]:
        return {
            "status": "healthy",
            "api": "online",
            "database": "connected",
            "database_name": result["database"],
        }

    return {
        "status": "unhealthy",
        "api": "online",
        "database": "disconnected",
        "error": result["error"],
    }