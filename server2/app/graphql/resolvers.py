from sqlalchemy.ext.asyncio import AsyncSession
from app.services.stats_service import StatsService
from app.database import get_db

class QueryResolvers:
    @staticmethod
    async def restaurant_stats(restaurant_id: str, days: int = 30):
        """Resolve restaurant stats"""
        async for db in get_db():
            service = StatsService(db)
            return await service.get_restaurant_stats(restaurant_id, days)

    @staticmethod
    async def courier_performance(courier_id: str, days: int = 30):
        """Resolve courier performance"""
        async for db in get_db():
            service = StatsService(db)
            return await service.get_courier_performance(courier_id, days)

    @staticmethod
    async def burndown_chart(restaurant_id: str, days: int = 14):
        """Resolve burndown chart"""
        async for db in get_db():
            service = StatsService(db)
            return await service.get_burndown(restaurant_id, days)

    @staticmethod
    async def recent_events(restaurant_id: str, limit: int = 20):
        """Resolve recent events"""
        async for db in get_db():
            service = StatsService(db)
            return await service.get_recent_events(restaurant_id, limit)
