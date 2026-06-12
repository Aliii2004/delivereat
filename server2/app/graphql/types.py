import strawberry


@strawberry.type
class RestaurantStatsType:
    restaurant_id: str
    period_days: int
    total_orders: int
    completed_orders: int
    cancelled_orders: int
    completion_rate: float
    total_revenue: float
    avg_delivery_time: float


@strawberry.type
class BurndownPoint:
    date: str
    total_orders: int
    completed_orders: int
    revenue: float


@strawberry.type
class CourierPerformanceType:
    courier_id: str
    period_days: int
    total_deliveries: int
    avg_delivery_time: float
    min_delivery_time: int
    max_delivery_time: int
    total_earnings: float


@strawberry.type
class OrderEventType:
    id: str
    order_id: str
    event_type: str
    total_amount: float | None
    delivery_time: int | None
    created_at: str


@strawberry.type
class MutationResult:
    success: bool
    message: str
