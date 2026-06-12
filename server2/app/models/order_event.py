import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class OrderEvent(Base):
    """
    S1 dan Redis pub/sub yoki HTTP orqali keladigan
    har bir buyurtma hodisasi yoziladi.
    GraphQL analytics uchun asosiy manba.
    """

    __tablename__ = "order_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # S1 PostgreSQL dagi order ID (foreign key emas — boshqa DB)
    order_id: Mapped[str] = mapped_column(String(36), nullable=False)
    restaurant_id: Mapped[str] = mapped_column(String(36), nullable=False)
    customer_id: Mapped[str] = mapped_column(String(36), nullable=False)
    courier_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # order_created | order_delivered | order_cancelled | courier_location_updated

    total_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    delivery_time: Mapped[int | None] = mapped_column(nullable=True)  # daqiqada
    reason: Mapped[str | None] = mapped_column(String(200), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_order_events_restaurant_id", "restaurant_id"),
        Index("ix_order_events_created_at", "created_at"),
        Index("ix_order_events_event_type", "event_type"),
        # FIX: Duplicate event prevention
        Index("ix_order_events_unique", "order_id", "event_type", unique=True),
    )
