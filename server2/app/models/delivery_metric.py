import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DeliveryMetric(Base):
    """
    Har bir yetkazilgan buyurtma uchun metrika.
    Kuryer samaradorligi va yetkazish vaqti tahlili uchun.
    """

    __tablename__ = "delivery_metrics"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_id: Mapped[str]      = mapped_column(String(36), nullable=False, unique=True)
    restaurant_id: Mapped[str] = mapped_column(String(36), nullable=False)
    courier_id: Mapped[str]    = mapped_column(String(36), nullable=False)

    total_amount: Mapped[float]    = mapped_column(Float, nullable=False)
    delivery_fee: Mapped[float]    = mapped_column(Float, default=15000)
    delivery_time: Mapped[int]     = mapped_column(Integer, nullable=False)  # daqiqada

    delivered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_delivery_metrics_restaurant_id", "restaurant_id"),
        Index("ix_delivery_metrics_courier_id", "courier_id"),
        Index("ix_delivery_metrics_delivered_at", "delivered_at"),
    )
