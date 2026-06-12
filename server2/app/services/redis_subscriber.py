import asyncio
import json
import logging
import os

import redis.asyncio as aioredis

from app.database import AsyncSessionLocal
from app.models.order_event import OrderEvent
from app.models.delivery_metric import DeliveryMetric
from app.services.stats_service import StatsService

logger = logging.getLogger(__name__)


class RedisSubscriber:
    """
    S1 dan keladigan order.events kanalini tinglaydi.
    Har bir event DB ga yoziladi va statistika yangilanadi.
    """

    def __init__(self):
        self._redis: aioredis.Redis | None = None
        self._pubsub = None
        self._task: asyncio.Task | None = None

    async def connect(self) -> None:
        redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
        self._redis = aioredis.from_url(redis_url, decode_responses=True)
        self._pubsub = self._redis.pubsub()
        await self._pubsub.subscribe("order.events")
        logger.info("✓ Redis subscriber connected — listening on 'order.events'")

    async def disconnect(self) -> None:
        if self._pubsub:
            await self._pubsub.unsubscribe("order.events")
        if self._redis:
            await self._redis.aclose()
        if self._task:
            self._task.cancel()

    def start(self) -> None:
        """Background task sifatida ishga tushirish"""
        self._task = asyncio.create_task(self._listen())

    async def _listen(self) -> None:
        """S1 dan keladigan eventlarni doimiy tinglaydigan loop"""
        if not self._pubsub:
            logger.error("Redis pubsub not initialized")
            return

        logger.info("Redis subscriber: listening for events...")
        async for message in self._pubsub.listen():
            if message["type"] != "message":
                continue
            try:
                data = json.loads(message["data"])
                await self._handle_event(data)
            except json.JSONDecodeError:
                logger.error("Invalid JSON from Redis: %s", message["data"])
            except Exception as e:
                logger.error("Event handling error: %s", str(e))

    async def _handle_event(self, data: dict) -> None:
        """
        Event type ga qarab tegishli handler chaqiriladi.
        Har bir handler o'z DB sessiyasini ochadi.
        """
        event_type = data.get("type")

        handlers = {
            "order_created":   self._on_order_created,
            "order_delivered": self._on_order_delivered,
            "order_cancelled": self._on_order_cancelled,
        }

        handler = handlers.get(event_type)
        if handler:
            await handler(data)
        # courier_location_updated — DB ga yozilmaydi, real-time only

    async def _on_order_created(self, data: dict) -> None:
        async with AsyncSessionLocal() as db:
            event = OrderEvent(
                order_id=data["orderId"],
                restaurant_id=data["restaurantId"],
                customer_id=data["customerId"],
                event_type="order_created",
                total_amount=data.get("totalAmount"),
            )
            db.add(event)

            service = StatsService(db)
            await service.upsert_daily_stat(
                restaurant_id=data["restaurantId"],
                is_completed=False,
                is_cancelled=False,
                revenue=0,
                delivery_time=None,
            )
            await db.commit()

    async def _on_order_delivered(self, data: dict) -> None:
        async with AsyncSessionLocal() as db:
            # FIX: Duplicate check — HTTP va pub/sub ikkalasidan kelishi mumkin
            from sqlalchemy import select as sa_select
            
            dup = await db.execute(
                sa_select(OrderEvent).where(
                    OrderEvent.order_id == data["orderId"],
                    OrderEvent.event_type == "order_delivered"
                )
            )
            if dup.scalar_one_or_none():
                logger.info(f"Duplicate order_delivered event skipped: {data['orderId']}")
                return  # Skip duplicate
            
            event = OrderEvent(
                order_id=data["orderId"],
                restaurant_id=data["restaurantId"],
                customer_id=data.get("customerId", ""),
                courier_id=data.get("courierId"),
                event_type="order_delivered",
                delivery_time=data.get("deliveryTime"),
            )
            db.add(event)

            # DeliveryMetric — kuryer samaradorligi uchun
            # FIX: duplicate tekshiruvi — HTTP va pub/sub ikkalasidan kelishi mumkin
            if data.get("courierId") and data.get("deliveryTime"):
                from sqlalchemy import select as sa_select
                dup = await db.execute(
                    sa_select(DeliveryMetric).where(
                        DeliveryMetric.order_id == data["orderId"]
                    )
                )
                if not dup.scalar_one_or_none():
                    metric = DeliveryMetric(
                        order_id=data["orderId"],
                        restaurant_id=data["restaurantId"],
                        courier_id=data["courierId"],
                        total_amount=data.get("totalAmount", 0),
                        delivery_time=data["deliveryTime"],
                    )
                    db.add(metric)

            service = StatsService(db)
            await service.upsert_daily_stat(
                restaurant_id=data["restaurantId"],
                is_completed=True,
                is_cancelled=False,
                revenue=data.get("totalAmount", 0),
                delivery_time=data.get("deliveryTime"),
            )
            await db.commit()

    async def _on_order_cancelled(self, data: dict) -> None:
        async with AsyncSessionLocal() as db:
            event = OrderEvent(
                order_id=data["orderId"],
                restaurant_id=data["restaurantId"],
                customer_id=data.get("cancelledBy", ""),
                event_type="order_cancelled",
                reason=data.get("reason"),
            )
            db.add(event)

            service = StatsService(db)
            await service.upsert_daily_stat(
                restaurant_id=data["restaurantId"],
                is_completed=False,
                is_cancelled=True,
                revenue=0,
                delivery_time=None,
            )
            await db.commit()


# Singleton instance
redis_subscriber = RedisSubscriber()
