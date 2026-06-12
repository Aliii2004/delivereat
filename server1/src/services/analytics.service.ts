import axios from 'axios';

const SERVER2_URL = process.env.SERVER2_INTERNAL_URL || 'http://server2:8000';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || '';

// Buyurtma yakunlanganda S2 ga xabar berish
export const notifyOrderCompleted = async (data: {
  orderId: string;
  restaurantId: string;
  courierId: string;
  totalAmount: number;
  deliveryTime: number; // daqiqada
}) => {
  try {
    await axios.post(`${SERVER2_URL}/internal/order-completed`, data, {
      timeout: 3000, // 3 sek timeout — S2 sekin bo'lsa S1 ni bloklamas
      headers: {
        'X-Internal-Secret': INTERNAL_SECRET,
      },
    });
  } catch (error) {
    // Analytics xatosi asosiy jarayonni to'xtatmasin
    console.error('Analytics notification failed (non-critical):', error);
  }
};
