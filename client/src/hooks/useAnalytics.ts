import { gql, useQuery } from '@apollo/client';

// ─── GRAPHQL QUERIES ───────────────────────────────────────

const RESTAURANT_STATS = gql`
  query RestaurantStats($restaurantId: String!, $days: Int) {
    restaurantStats(restaurantId: $restaurantId, days: $days) {
      restaurantId
      periodDays
      totalOrders
      completedOrders
      cancelledOrders
      completionRate
      totalRevenue
      avgDeliveryTime
    }
  }
`;

const BURNDOWN_CHART = gql`
  query BurndownChart($restaurantId: String!, $days: Int) {
    burndownChart(restaurantId: $restaurantId, days: $days) {
      date
      totalOrders
      completedOrders
      revenue
    }
  }
`;

const COURIER_PERFORMANCE = gql`
  query CourierPerformance($courierId: String!, $days: Int) {
    courierPerformance(courierId: $courierId, days: $days) {
      courierId
      periodDays
      totalDeliveries
      avgDeliveryTime
      minDeliveryTime
      maxDeliveryTime
      totalEarnings
    }
  }
`;

const RECENT_EVENTS = gql`
  query RecentEvents($restaurantId: String!, $limit: Int) {
    recentEvents(restaurantId: $restaurantId, limit: $limit) {
      id
      orderId
      eventType
      totalAmount
      deliveryTime
      createdAt
    }
  }
`;

// ─── HOOKS ─────────────────────────────────────────────────

export function useRestaurantStats(restaurantId: string, days = 30) {
  return useQuery(RESTAURANT_STATS, {
    variables: { restaurantId, days },
    skip: !restaurantId,
  });
}

export function useBurndownChart(restaurantId: string, days = 14) {
  return useQuery(BURNDOWN_CHART, {
    variables: { restaurantId, days },
    skip: !restaurantId,
  });
}

export function useCourierPerformance(courierId: string, days = 30) {
  return useQuery(COURIER_PERFORMANCE, {
    variables: { courierId, days },
    skip: !courierId,
  });
}

export function useRecentEvents(restaurantId: string, limit = 20) {
  return useQuery(RECENT_EVENTS, {
    variables: { restaurantId, limit },
    skip: !restaurantId,
    pollInterval: 30000, // 30 sek da yangilanadi
  });
}
