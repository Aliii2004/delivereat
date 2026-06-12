import os
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.models import OrderEvent
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class OrderCompletedData(BaseModel):
    orderId: str
    restaurantId: str
    courierId: str
    totalAmount: float
    deliveryTime: int

@router.post("/internal/order-completed")
async def order_completed(
    data: OrderCompletedData,
    x_internal_secret: str = Header(None)
):
    """Webhook от Server 1 когда заказ доставлен"""
    
    expected_secret = os.environ.get("INTERNAL_API_SECRET")
    if not expected_secret or x_internal_secret != expected_secret:
        logger.warning(f"Unauthorized webhook access attempt")
        raise HTTPException(status_code=403, detail="Forbidden")

    # Записать событие в БД
    async with AsyncSessionLocal() as db:
        event = OrderEvent(
            order_id=data.orderId,
            restaurant_id=data.restaurantId,
            courier_id=data.courierId,
            event_type="order_delivered",
            delivery_time=data.deliveryTime,
            total_amount=data.totalAmount,
            created_at=datetime.utcnow()
        )
        db.add(event)
        await db.commit()

    logger.info(f"✓ Order {data.orderId} recorded via webhook")
    return {"success": True, "message": "Order recorded"}
