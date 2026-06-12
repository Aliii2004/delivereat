import os
from typing import Optional, Any

import strawberry
from strawberry.fastapi import GraphQLRouter
from strawberry.types import Info
from sqlalchemy.ext.asyncio import AsyncSession
from typing import AsyncGenerator

from app.database import AsyncSessionLocal
from app.services.stats_service import StatsService
from app.graphql.types import (
    RestaurantStatsType,
    BurndownPoint,
    CourierPerformanceType,
    OrderEventType,
    MutationResult,
)


# ─── CONTEXT ───────────────────────────────────────────────
# FIX: Dependency injection bilan to'g'ri session management

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    GraphQL resolver uchun DB session.
    Har bir so'rovda yangi session ochiladi va to'g'ri close qilinadi.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ─── QUERY ─────────────────────────────────────────────────

@strawberry.type
class Query:

    @strawberry.field(description="Restoran statistikasi (default: so'nggi 30 kun)")
    async def restaurant_stats(
        self,
        restaurant_id: str,
        days: Optional[int] = 30,
    ) -> RestaurantStatsType:
        # FIX: Har bir resolver o'z sessiyasini ochadi
        async with AsyncSessionLocal() as db:
            service = StatsService(db)
            data = await service.get_restaurant_stats(restaurant_id, days or 30)
            await db.commit()
            return RestaurantStatsType(**data)

    @strawberry.field(description="Kun bo'yicha burndown chart ma'lumotlari")
    async def burndown_chart(
        self,
        restaurant_id: str,
        days: Optional[int] = 14,
    ) -> list[BurndownPoint]:
        async with AsyncSessionLocal() as db:
            service = StatsService(db)
            data = await service.get_burndown(restaurant_id, days or 14)
            await db.commit()
            return [BurndownPoint(**item) for item in data]

    @strawberry.field(description="Kuryer samaradorlik hisoboti")
    async def courier_performance(
        self,
        courier_id: str,
        days: Optional[int] = 30,
    ) -> CourierPerformanceType:
        async with AsyncSessionLocal() as db:
            service = StatsService(db)
            data = await service.get_courier_performance(courier_id, days or 30)
            await db.commit()
            return CourierPerformanceType(**data)

    @strawberry.field(description="So'nggi hodisalar ro'yxati")
    async def recent_events(
        self,
        restaurant_id: str,
        limit: Optional[int] = 20,
    ) -> list[OrderEventType]:
        async with AsyncSessionLocal() as db:
            service = StatsService(db)
            data = await service.get_recent_events(restaurant_id, limit or 20)
            await db.commit()
            return [OrderEventType(**item) for item in data]


# ─── MUTATION ──────────────────────────────────────────────

@strawberry.type
class Mutation:
    @strawberry.mutation(description="Health check — server2 ishlayotganini tekshirish")
    async def ping(self) -> MutationResult:
        return MutationResult(success=True, message="pong")


# ─── SCHEMA ────────────────────────────────────────────────

schema = strawberry.Schema(query=Query, mutation=Mutation)

# FIX: GraphQLRouter — context endi kerak emas (har resolver o'z sessiyasini ochadi)
graphql_router = GraphQLRouter(
    schema,
    graphiql=os.environ.get("NODE_ENV") != "production",
)
