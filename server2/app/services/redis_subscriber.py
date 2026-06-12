import asyncio
import json
import logging
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.models import OrderEvent
from datetime import datetime

logger = logging.getLogger(__name__)

class RedisSubscriber:
    def __init__(self):
        self.redis = None
        self.pubsub = None
        self.running = False

    async def connect(self, redis_url: str):
        """Подключиться к Redis"""
        try:
            self.redis = Redis.from_url(redis_url, decode_responses=True)
            self.pubsub = self.redis.pubsub()
            logger.info("✓ Connected to Redis")
        except Exception as e:
            logger.error(f"Redis connection error: {e}")
            raise

    async def disconnect(self):
        """Отключиться от Redis"""
        if self.pubsub:
            await self.pubsub.close()
        if self.redis:
            await self.redis.close()
        logger.info("✓ Disconnected from Redis")

    def start(self):
        """Запустить подписчик"""
        self.running = True
        asyncio.create_task(self._listen())
        logger.info("✓ Redis subscriber started")

    async def _listen(self):
        """Слушать события"""
        await self.pubsub.subscribe("order.events")

        while self.running:
            try:
                message = await self.pubsub.get_message()

                if message and message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        await self._process_event(data)
                    except json.JSONDecodeError:
                        logger.error(f"Invalid JSON: {message['data']}")

                await asyncio.sleep(0.1)
            except Exception as e:
                logger.error(f"Redis listener error: {e}")
                await asyncio.sleep(1)

    async def _process_event(self, data: dict):
        """Обработать событие заказа"""
        event_type = data.get("type")
        logger.info(f"Processing event: {event_type}")

        async with AsyncSessionLocal() as db:
            if event_type == "order_created":
                await self._record_order_created(data, db)
            elif event_type == "order_delivered":
                await self._record_order_delivered(data, db)
            elif event_type == "order_cancelled":
                await self._record_order_cancelled(data, db)

    async def _record_order_created(self, data: dict, db: AsyncSession):
        """Записать создание заказа"""
        event = OrderEvent(
            order_id=data.get("orderId"),
            restaurant_id=data.get("restaurantId"),
            event_type="order_created",
            total_amount=data.get("totalAmount", 0),
            created_at=datetime.fromisoformat(data.get("timestamp", datetime.utcnow().isoformat()))
        )
        db.add(event)
        await db.commit()
        logger.info(f"Recorded order created: {data.get('orderId')}")

    async def _record_order_delivered(self, data: dict, db: AsyncSession):
        """Записать доставку заказа"""
        event = OrderEvent(
            order_id=data.get("orderId"),
            restaurant_id=data.get("restaurantId"),
            courier_id=data.get("courierId"),
            event_type="order_delivered",
            delivery_time=data.get("deliveryTime"),
            total_amount=data.get("totalAmount", 0),
            created_at=datetime.fromisoformat(data.get("timestamp", datetime.utcnow().isoformat()))
        )
        db.add(event)
        await db.commit()
        logger.info(f"Recorded order delivered: {data.get('orderId')}")

    async def _record_order_cancelled(self, data: dict, db: AsyncSession):
        """Записать отмену заказа"""
        event = OrderEvent(
            order_id=data.get("orderId"),
            restaurant_id=data.get("restaurantId"),
            event_type="order_cancelled",
            created_at=datetime.fromisoformat(data.get("timestamp", datetime.utcnow().isoformat()))
        )
        db.add(event)
        await db.commit()
        logger.info(f"Recorded order cancelled: {data.get('orderId')}")

redis_subscriber = RedisSubscriber()
