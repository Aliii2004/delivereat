import logging
import os
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.delivery_metric import DeliveryMetric
from app.models.order_event import OrderEvent
from sqlalchemy import select

from app.services.stats_service import StatsService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/internal", tags=["internal"])


# ─── IP GUARD ──────────────────────────────────────────────
# FIX: Shared secret bilan xavfsizlik

async def internal_only(request: Request) -> None:
    secret = request.headers.get("x-internal-secret", "")
    expected_secret = os.environ.get("INTERNAL_API_SECRET", "")
    
    if not expected_secret:
        logger.error("INTERNAL_API_SECRET environment variable not set")
        raise HTTPException(status_code=500, detail="Internal configuration error")
    
    if secret != expected_secret:
        logger.warning("Unauthorized internal API access attempt")
        raise HTTPException(status_code=403, detail="Forbidden")


# ─── SCHEMAS ───────────────────────────────────────────────

class OrderCompletedPayload(BaseModel):
    orderId: str     = Field(..., min_length=1)
    restaurantId: str = Field(..., min_length=1)
    courierId: str   = Field(..., min_length=1)
    totalAmount: float = Field(..., ge=0)
    deliveryTime: int  = Field(..., ge=0, le=1440)  # max 24 soat


# ─── ENDPOINTS ─────────────────────────────────────────────

@router.post("/order-completed")
async def order_completed(
    payload: OrderCompletedPayload,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[None, Depends(internal_only)],
) -> dict:
    """
    S1 (Express) → S2 (FastAPI): buyurtma yetkazildi.
    DeliveryMetric va RestaurantStat yangilanadi.
    """
    try:
        # DeliveryMetric — kuryer samaradorligi uchun
        # Upsert: bir xil order ikki marta kelmasa ham xavfsiz
        dup = await db.execute(
            select(DeliveryMetric).where(DeliveryMetric.order_id == payload.orderId)
        )
        existing = dup.scalar_one_or_none()
        if not existing:
            metric = DeliveryMetric(
                order_id=payload.orderId,
                restaurant_id=payload.restaurantId,
                courier_id=payload.courierId,
                total_amount=payload.totalAmount,
                delivery_time=payload.deliveryTime,
            )
            db.add(metric)

        # OrderEvent
        event = OrderEvent(
            order_id=payload.orderId,
            restaurant_id=payload.restaurantId,
            customer_id="",   # HTTP call da customer_id yo'q — pub/sub da keladi
            courier_id=payload.courierId,
            event_type="order_delivered_http",
            total_amount=payload.totalAmount,
            delivery_time=payload.deliveryTime,
        )
        db.add(event)

        # Kunlik statistika
        service = StatsService(db)
        await service.upsert_daily_stat(
            restaurant_id=payload.restaurantId,
            is_completed=True,
            is_cancelled=False,
            revenue=payload.totalAmount,
            delivery_time=payload.deliveryTime,
        )

        await db.commit()
        return {"success": True}

    except Exception as e:
        logger.error("order-completed handler error: %s", str(e))
        raise HTTPException(status_code=500, detail="Internal error")
