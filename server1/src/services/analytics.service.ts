import axios from 'axios';

interface OrderCompletedData {
  orderId: string;
  restaurantId: string;
  courierId: string;
  totalAmount: number;
  deliveryTime: number;
}

/**
 * Отправить webhook на Server 2 для аналитики
 * Это резервный способ синхронной доставки данных
 */
export const notifyOrderCompleted = async (data: OrderCompletedData): Promise<void> => {
  try {
    const server2Url = process.env.SERVER2_URL || 'http://localhost:8000';
    const internalSecret = process.env.INTERNAL_API_SECRET || '';

    if (!internalSecret) {
      console.warn('INTERNAL_API_SECRET не установлен, webhook не отправлен');
      return;
    }

    const response = await axios.post(
      `${server2Url}/internal/order-completed`,
      {
        orderId: data.orderId,
        restaurantId: data.restaurantId,
        courierId: data.courierId,
        totalAmount: data.totalAmount,
        deliveryTime: data.deliveryTime,
      },
      {
        headers: {
          'X-Internal-Secret': internalSecret,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    );

    console.log(`✓ Analytics webhook sent for order ${data.orderId}`);
    return response.data;
  } catch (error) {
    console.error('Analytics webhook error:', error);
    // Не выбрасываем ошибку — Redis Pub/Sub уже отправил данные
  }
};