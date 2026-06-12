from datetime import date, timedelta

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.delivery_metric import DeliveryMetric
from app.models.order_event import OrderEvent
from app.models.restaurant_stat import RestaurantStat


class StatsService:

    def __init__(self, db: AsyncSession):
        self.db = db

    # ─── RESTORAN STATISTIKASI ────────────────────────────

    async def get_restaurant_stats(
        self, restaurant_id: str, days: int = 30
    ) -> dict:
        since = date.today() - timedelta(days=days)

        result = await self.db.execute(
            select(
                func.coalesce(func.sum(RestaurantStat.total_orders), 0).label("total_orders"),
                func.coalesce(func.sum(RestaurantStat.completed_orders), 0).label("completed_orders"),
                func.coalesce(func.sum(RestaurantStat.cancelled_orders), 0).label("cancelled_orders"),
                func.coalesce(func.sum(RestaurantStat.total_revenue), 0.0).label("total_revenue"),
                func.avg(RestaurantStat.avg_delivery_time).label("avg_delivery_time"),
            ).where(
                RestaurantStat.restaurant_id == restaurant_id,
                RestaurantStat.stat_date >= since,
            )
        )
        row = result.one()

        # FIX: coalesce ishlatildi — row.one() da None bo'lmaydi
        total = int(row.total_orders)
        completed = int(row.completed_orders)

        return {
            "restaurant_id": restaurant_id,
            "period_days": days,
            "total_orders": total,
            "completed_orders": completed,
            "cancelled_orders": int(row.cancelled_orders),
            "completion_rate": round(completed / total * 100, 1) if total > 0 else 0.0,
            "total_revenue": round(float(row.total_revenue), 2),
            "avg_delivery_time": round(float(row.avg_delivery_time or 0), 1),
        }

    # ─── BURNDOWN (kun bo'yicha) ──────────────────────────

    async def get_burndown(self, restaurant_id: str, days: int = 14) -> list[dict]:
        since = date.today() - timedelta(days=days)

        result = await self.db.execute(
            select(
                RestaurantStat.stat_date,
                RestaurantStat.total_orders,
                RestaurantStat.completed_orders,
                RestaurantStat.total_revenue,
            )
            .where(
                RestaurantStat.restaurant_id == restaurant_id,
                RestaurantStat.stat_date >= since,
            )
            .order_by(RestaurantStat.stat_date)
        )

        return [
            {
                "date": str(row.stat_date),
                "total_orders": row.total_orders,
                "completed_orders": row.completed_orders,
                "revenue": round(float(row.total_revenue), 2),
            }
            for row in result.all()
        ]

    # ─── KURYER SAMARADORLIGI ─────────────────────────────

    async def get_courier_performance(
        self, courier_id: str, days: int = 30
    ) -> dict:
        since = date.today() - timedelta(days=days)

        result = await self.db.execute(
            select(
                func.count(DeliveryMetric.id).label("total_deliveries"),
                func.avg(DeliveryMetric.delivery_time).label("avg_time"),
                func.min(DeliveryMetric.delivery_time).label("min_time"),
                func.max(DeliveryMetric.delivery_time).label("max_time"),
                func.coalesce(func.sum(DeliveryMetric.delivery_fee), 0.0).label("total_earnings"),
            ).where(
                DeliveryMetric.courier_id == courier_id,
                DeliveryMetric.delivered_at >= since,
            )
        )
        row = result.one()

        return {
            "courier_id": courier_id,
            "period_days": days,
            "total_deliveries": int(row.total_deliveries or 0),
            "avg_delivery_time": round(float(row.avg_time or 0), 1),
            "min_delivery_time": int(row.min_time or 0),
            "max_delivery_time": int(row.max_time or 0),
            "total_earnings": round(float(row.total_earnings), 2),
        }

    # ─── SO'NGI HODISALAR ─────────────────────────────────

    async def get_recent_events(
        self, restaurant_id: str, limit: int = 20
    ) -> list[dict]:
        result = await self.db.execute(
            select(OrderEvent)
            .where(OrderEvent.restaurant_id == restaurant_id)
            .order_by(OrderEvent.created_at.desc())
            .limit(min(limit, 100))
        )
        events = result.scalars().all()

        return [
            {
                "id": str(e.id),
                "order_id": e.order_id,
                "event_type": e.event_type,
                "total_amount": e.total_amount,
                "delivery_time": e.delivery_time,
                "created_at": e.created_at.isoformat(),
            }
            for e in events
        ]

    # ─── UPSERT KUNLIK STATISTIKA ─────────────────────────
    # FIX: PostgreSQL UPSERT bilan race condition hal qilindi

    async def upsert_daily_stat(
        self,
        restaurant_id: str,
        is_completed: bool,
        is_cancelled: bool,
        revenue: float,
        delivery_time: int | None,
    ) -> None:
        from sqlalchemy.dialects.postgresql import insert
        
        today = date.today()

        # Agar yangi yozuv bo'lsa
        if not is_completed and not is_cancelled:
            # order_created
            stmt = insert(RestaurantStat).values(
                restaurant_id=restaurant_id,
                stat_date=today,
                total_orders=1,
                completed_orders=0,
                cancelled_orders=0,
                total_revenue=0.0,
                avg_delivery_time=None,
            ).on_conflict_do_update(
                index_elements=['restaurant_id', 'stat_date'],
                set_={
                    'total_orders': RestaurantStat.total_orders + 1,
                }
            )
        elif is_completed:
            # order_delivered
            # Avg delivery time hisoblash uchun avval mavjud stat ni olish kerak
            existing = await self.db.execute(
                select(RestaurantStat).where(
                    RestaurantStat.restaurant_id == restaurant_id,
                    RestaurantStat.stat_date == today,
                )
            )
            stat = existing.scalar_one_or_none()
            
            if stat:
                # Mavjud stat bor — avg ni qayta hisoblash
                n = stat.completed_orders + 1
                if stat.avg_delivery_time is None:
                    new_avg = float(delivery_time) if delivery_time else None
                else:
                    new_avg = (
                        (stat.avg_delivery_time * stat.completed_orders + (delivery_time or 0)) / n
                    )
                
                stmt = insert(RestaurantStat).values(
                    restaurant_id=restaurant_id,
                    stat_date=today,
                    total_orders=1,
                    completed_orders=1,
                    cancelled_orders=0,
                    total_revenue=revenue,
                    avg_delivery_time=new_avg,
                ).on_conflict_do_update(
                    index_elements=['restaurant_id', 'stat_date'],
                    set_={
                        'completed_orders': RestaurantStat.completed_orders + 1,
                        'total_revenue': RestaurantStat.total_revenue + revenue,
                        'avg_delivery_time': new_avg,
                    }
                )
            else:
                # Yangi stat
                stmt = insert(RestaurantStat).values(
                    restaurant_id=restaurant_id,
                    stat_date=today,
                    total_orders=1,
                    completed_orders=1,
                    cancelled_orders=0,
                    total_revenue=revenue,
                    avg_delivery_time=float(delivery_time) if delivery_time else None,
                )
        else:
            # order_cancelled
            stmt = insert(RestaurantStat).values(
                restaurant_id=restaurant_id,
                stat_date=today,
                total_orders=1,
                completed_orders=0,
                cancelled_orders=1,
                total_revenue=0.0,
                avg_delivery_time=None,
            ).on_conflict_do_update(
                index_elements=['restaurant_id', 'stat_date'],
                set_={
                    'cancelled_orders': RestaurantStat.cancelled_orders + 1,
                }
            )
        
        await self.db.execute(stmt)
