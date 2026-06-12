from typing import List, Optional
import strawberry
from datetime import datetime

@strawberry.type
class MenuItemStat:
    name: str
    sold_count: int
    revenue: float

@strawberry.type
class RestaurantStatsType:
    total_revenue: float
    total_orders: int
    average_order_value: float
    completion_rate: float
    average_rating: float
    top_menu_items: List[MenuItemStat]

@strawberry.type
class BurndownPoint:
    date: str
    order_count: int
    revenue: float

@strawberry.type
class CourierPerformanceType:
    total_deliveries: int
    total_earnings: float
    average_delivery_time: float
    rating: float
    acceptance_rate: float

@strawberry.type
class OrderEventType:
    order_id: str
    type: str
    total_amount: float
    delivery_time: Optional[int] = None
    timestamp: str = ""

@strawberry.type
class Query:
    @strawberry.field
    async def restaurant_stats(self, restaurant_id: str, days: int = 30) -> RestaurantStatsType:
        """Получить статистику ресторана"""
        # Это будет реализовано в resolvers.py
        pass

    @strawberry.field
    async def courier_performance(self, courier_id: str, days: int = 30) -> CourierPerformanceType:
        """Получить производительность курьера"""
        pass

    @strawberry.field
    async def burndown_chart(self, restaurant_id: str, days: int = 14) -> List[BurndownPoint]:
        """Получить burndown chart"""
        pass

    @strawberry.field
    async def recent_events(self, restaurant_id: str, limit: int = 20) -> List[OrderEventType]:
        """Получить последние события"""
        pass

schema = strawberry.Schema(query=Query)
