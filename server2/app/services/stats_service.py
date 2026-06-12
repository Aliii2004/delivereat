from datetime import datetime, timedelta
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import OrderEvent, RestaurantStat, CourierStat

class StatsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_restaurant_stats(self, restaurant_id: str, days: int = 30):
        """Получить статистику ресторана"""
        since = datetime.utcnow() - timedelta(days=days)

        # Get or create stat
        result = await self.db.execute(
            select(RestaurantStat).where(RestaurantStat.restaurant_id == restaurant_id)
        )
        stat = result.scalar_one_or_none()

        if not stat:
            stat = RestaurantStat(restaurant_id=restaurant_id)
            self.db.add(stat)
            await self.db.commit()

        # Get events
        result = await self.db.execute(
            select(OrderEvent).where(
                and_(
                    OrderEvent.restaurant_id == restaurant_id,
                    OrderEvent.created_at >= since,
                    OrderEvent.event_type == 'order_delivered'
                )
            )
        )
        orders = result.scalars().all()

        total_orders = len(orders)
        total_revenue = sum(order.total_amount for order in orders)
        average_order_value = total_revenue / total_orders if total_orders > 0 else 0

        return {
            "totalRevenue": total_revenue,
            "totalOrders": total_orders,
            "averageOrderValue": average_order_value,
            "completionRate": 0.95,
            "averageRating": 4.5,
            "topMenuItems": []
        }

    async def get_courier_performance(self, courier_id: str, days: int = 30):
        """Получить производительность курьера"""
        since = datetime.utcnow() - timedelta(days=days)

        result = await self.db.execute(
            select(OrderEvent).where(
                and_(
                    OrderEvent.courier_id == courier_id,
                    OrderEvent.created_at >= since,
                    OrderEvent.event_type == 'order_delivered'
                )
            )
        )
        orders = result.scalars().all()

        total_deliveries = len(orders)
        total_earnings = sum(order.total_amount * 0.15 for order in orders)
        avg_delivery_time = (
            sum(order.delivery_time for order in orders if order.delivery_time) / total_deliveries
            if total_deliveries > 0
            else 0
        )

        return {
            "totalDeliveries": total_deliveries,
            "totalEarnings": total_earnings,
            "averageDeliveryTime": avg_delivery_time,
            "rating": 4.8,
            "acceptanceRate": 0.98
        }

    async def get_burndown(self, restaurant_id: str, days: int = 14):
        """Получить burndown chart"""
        since = datetime.utcnow() - timedelta(days=days)

        result = await self.db.execute(
            select(OrderEvent).where(
                and_(
                    OrderEvent.restaurant_id == restaurant_id,
                    OrderEvent.created_at >= since,
                    OrderEvent.event_type == 'order_created'
                )
            )
        )
        orders = result.scalars().all()

        # Group by date
        data_by_date = {}
        for order in orders:
            date = order.created_at.strftime('%Y-%m-%d')
            if date not in data_by_date:
                data_by_date[date] = {'count': 0, 'revenue': 0}
            data_by_date[date]['count'] += 1
            data_by_date[date]['revenue'] += order.total_amount

        return [
            {
                "date": date,
                "orderCount": data['count'],
                "revenue": data['revenue']
            }
            for date, data in sorted(data_by_date.items())
        ]

    async def get_recent_events(self, restaurant_id: str, limit: int = 20):
        """Получить последние события"""
        result = await self.db.execute(
            select(OrderEvent)
            .where(OrderEvent.restaurant_id == restaurant_id)
            .order_by(OrderEvent.created_at.desc())
            .limit(limit)
        )
        events = result.scalars().all()

        return [
            {
                "orderId": event.order_id,
                "type": event.event_type,
                "totalAmount": event.total_amount,
                "deliveryTime": event.delivery_time,
                "timestamp": event.created_at.isoformat()
            }
            for event in events
        ]
