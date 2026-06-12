from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, Index
from app.database import Base
import uuid

class OrderEvent(Base):
    """Order events for analytics"""
    __tablename__ = "order_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String, nullable=False, index=True)
    restaurant_id = Column(String, nullable=False, index=True)
    courier_id = Column(String, nullable=True, index=True)
    event_type = Column(String, nullable=False)  # order_created, order_delivered, etc
    delivery_time = Column(Integer, nullable=True)  # minutes
    total_amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index('ix_order_events_restaurant_created', 'restaurant_id', 'created_at'),
        Index('ix_order_events_courier_created', 'courier_id', 'created_at'),
    )

class RestaurantStat(Base):
    """Restaurant statistics"""
    __tablename__ = "restaurant_stats"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id = Column(String, nullable=False, unique=True, index=True)
    total_revenue = Column(Float, default=0)
    total_orders = Column(Integer, default=0)
    average_order_value = Column(Float, default=0)
    completion_rate = Column(Float, default=0)
    average_rating = Column(Float, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CourierStat(Base):
    """Courier statistics"""
    __tablename__ = "courier_stats"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    courier_id = Column(String, nullable=False, unique=True, index=True)
    total_deliveries = Column(Integer, default=0)
    total_earnings = Column(Float, default=0)
    average_delivery_time = Column(Float, default=0)
    rating = Column(Float, default=0)
    acceptance_rate = Column(Float, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

__all__ = ['Base', 'OrderEvent', 'RestaurantStat', 'CourierStat']
