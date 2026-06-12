import { prisma } from '../lib/prisma';
import { redisService } from './redis.service';
import { getIO } from '../lib/socket.instance';

// ─── SURGE PRICING SERVICE ─────────────────────────────────
// Yuqori talab davrida narxlarni avtomatik oshirish

interface SurgeZone {
  zone: string;
  multiplier: number; // 1.0 = normal, 1.5 = 50% oshgan, 2.0 = 2x
  activeOrders: number;
  availableCouriers: number;
}

export class SurgeService {
  // Surge multiplier ni hisoblash
  static async calculateSurge(restaurantId: string): Promise<number> {
    // So'nggi 15 daqiqadagi aktiv buyurtmalar
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    const activeOrders = await prisma.order.count({
      where: {
        restaurantId,
        createdAt: { gte: fifteenMinutesAgo },
        status: { in: ['CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY', 'ON_THE_WAY'] },
      },
    });

    // Mavjud kuryerlar soni
    const availableCouriers = await prisma.courier.count({
      where: { status: 'AVAILABLE' },
    });

    // Surge logic: agar buyurtmalar/kuryerlar nisbati yuqori bo'lsa
    let multiplier = 1.0;

    if (availableCouriers === 0 && activeOrders > 0) {
      multiplier = 2.0; // Hech kuryer yo'q
    } else if (availableCouriers > 0) {
      const ratio = activeOrders / availableCouriers;
      
      if (ratio > 3) {
        multiplier = 2.0; // 3+ buyurtma / 1 kuryer
      } else if (ratio > 2) {
        multiplier = 1.5;
      } else if (ratio > 1) {
        multiplier = 1.2;
      }
    }

    // Redis da saqlash (1 daqiqa TTL)
    await redisService.set(
      `surge:${restaurantId}`,
      multiplier.toString(),
      60
    );

    return multiplier;
  }

  // Surge multiplier ni olish (cache first)
  static async getSurgeMultiplier(restaurantId: string): Promise<number> {
    const cached = await redisService.get(`surge:${restaurantId}`);
    if (cached) {
      return parseFloat(cached);
    }

    return this.calculateSurge(restaurantId);
  }

  // Barcha zonalar uchun surge alert yuborish
  static async checkAndNotifySurge(): Promise<void> {
    // Top 5 restaurant by active orders
    const restaurants = await prisma.restaurant.findMany({
      where: { status: 'OPEN' },
      select: { id: true, name: true, address: true },
      take: 5,
    });

    for (const restaurant of restaurants) {
      const multiplier = await this.calculateSurge(restaurant.id);

      if (multiplier >= 1.5) {
        // Kuryerlarga surge alert
        getIO().to('all-zones').emit('surge:alert', {
          zone: restaurant.name,
          address: restaurant.address,
          multiplier,
          message: `Yuqori talab! ${multiplier}x to'lov`,
        });
      }
    }
  }

  // Har 5 daqiqada surge tekshiruvi (cron job)
  static startSurgeMonitoring(): NodeJS.Timeout {
    return setInterval(() => {
      this.checkAndNotifySurge().catch((err) =>
        console.error('Surge monitoring error:', err)
      );
    }, 5 * 60 * 1000); // 5 daqiqa
  }
}
