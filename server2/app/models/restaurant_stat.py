import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RestaurantStat(Base):
    """
    Har bir restoran uchun kunlik statistika.
    Aggregate qilingan ma'lumotlar — GraphQL dashboard uchun.
    """

    __tablename__ = "restaurant_stats"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    restaurant_id: Mapped[str] = mapped_column(String(36), nullable=False)
    stat_date: Mapped[date]    = mapped_column(Date, nullable=False)

    total_orders: Mapped[int]     = mapped_column(Integer, default=0)
    completed_orders: Mapped[int] = mapped_column(Integer, default=0)
    cancelled_orders: Mapped[int] = mapped_column(Integer, default=0)
    total_revenue: Mapped[float]  = mapped_column(Float, default=0.0)
    avg_delivery_time: Mapped[float | None] = mapped_column(Float, nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        Index(
            "ix_restaurant_stats_unique",
            "restaurant_id",
            "stat_date",
            unique=True,  # Bir restoran uchun bir kunda faqat bitta yozuv
        ),
        Index("ix_restaurant_stats_date", "stat_date"),
    )
