"""initial schema

Revision ID: 0001
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ─── order_events ──────────────────────────────────────
    op.create_table(
        'order_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('order_id', sa.String(36), nullable=False),
        sa.Column('restaurant_id', sa.String(36), nullable=False),
        sa.Column('customer_id', sa.String(36), nullable=False),
        sa.Column('courier_id', sa.String(36), nullable=True),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('total_amount', sa.Float(), nullable=True),
        sa.Column('delivery_time', sa.Integer(), nullable=True),
        sa.Column('reason', sa.String(200), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
    )
    op.create_index('ix_order_events_restaurant_id', 'order_events', ['restaurant_id'])
    op.create_index('ix_order_events_created_at', 'order_events', ['created_at'])
    op.create_index('ix_order_events_event_type', 'order_events', ['event_type'])

    # ─── restaurant_stats ──────────────────────────────────
    op.create_table(
        'restaurant_stats',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('restaurant_id', sa.String(36), nullable=False),
        sa.Column('stat_date', sa.Date(), nullable=False),
        sa.Column('total_orders', sa.Integer(), default=0),
        sa.Column('completed_orders', sa.Integer(), default=0),
        sa.Column('cancelled_orders', sa.Integer(), default=0),
        sa.Column('total_revenue', sa.Float(), default=0.0),
        sa.Column('avg_delivery_time', sa.Float(), nullable=True),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
        ),
    )
    op.create_index(
        'ix_restaurant_stats_unique',
        'restaurant_stats',
        ['restaurant_id', 'stat_date'],
        unique=True,
    )
    op.create_index('ix_restaurant_stats_date', 'restaurant_stats', ['stat_date'])

    # ─── delivery_metrics ──────────────────────────────────
    op.create_table(
        'delivery_metrics',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('order_id', sa.String(36), nullable=False, unique=True),
        sa.Column('restaurant_id', sa.String(36), nullable=False),
        sa.Column('courier_id', sa.String(36), nullable=False),
        sa.Column('total_amount', sa.Float(), nullable=False),
        sa.Column('delivery_fee', sa.Float(), default=15000),
        sa.Column('delivery_time', sa.Integer(), nullable=False),
        sa.Column(
            'delivered_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
    )
    op.create_index('ix_delivery_metrics_restaurant_id', 'delivery_metrics', ['restaurant_id'])
    op.create_index('ix_delivery_metrics_courier_id', 'delivery_metrics', ['courier_id'])
    op.create_index('ix_delivery_metrics_delivered_at', 'delivery_metrics', ['delivered_at'])


def downgrade() -> None:
    op.drop_table('delivery_metrics')
    op.drop_table('restaurant_stats')
    op.drop_table('order_events')
