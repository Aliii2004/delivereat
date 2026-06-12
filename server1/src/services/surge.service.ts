import { prisma } from '../lib/prisma';
import { redisService } from './redis.service';

export class SurgeService {
  /**
   * Рассчитать surge multiplier на основе спроса и предложения
   * Спрос: кол-во активных заказов (не доставлены)
   * Предложение: кол-во доступных курьеров
   */
  static async calculateSurge(restaurantId: string): Promise<number> {
    try {
      // Активные заказы
      const activeOrders = await prisma.order.count({
        where: {
          restaurantId,
          status: { in: ['CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY', 'ON_THE_WAY'] },
        },
      });

      // Доступные курьеры
      const availableCouriers = await prisma.courier.count({
        where: { status: 'AVAILABLE' },
      });

      // Ratio
      const ratio = activeOrders / Math.max(availableCouriers, 1);

      // Multiplier
      let multiplier = 1.0;
      if (ratio >= 2.0) multiplier = 2.0;
      else if (ratio >= 1.5) multiplier = 1.5;
      else if (ratio >= 1.0) multiplier = 1.2;

      return multiplier;
    } catch (error) {
      console.error('Surge calculation error:', error);
      return 1.0;
    }
  }

  /**
   * Background job: мониторить surge каждые 5 минут
   */
  static startSurgeMonitoring(): NodeJS.Timeout {
    return setInterval(async () => {
      try {
        await this.checkAndNotifySurge();
      } catch (error) {
        console.error('Surge monitoring error:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Проверить surge и оповестить
   */
  static async checkAndNotifySurge(): Promise<void> {
    try {
      const restaurants = await prisma.restaurant.findMany({
        where: { status: 'OPEN' },
        select: { id: true, name: true, address: true },
      });

      for (const restaurant of restaurants) {
        const multiplier = await this.calculateSurge(restaurant.id);

        // Сохранить в Redis на час
        await redisService.set(
          `surge:restaurant:${restaurant.id}`,
          multiplier.toString(),
          3600
        );

        // Оповестить если surge высокий
        if (multiplier >= 1.5) {
          console.log(
            `⚠️ SURGE ALERT: ${restaurant.name} - multiplier ${multiplier}x`
          );

          await redisService.publish('surge.events', {
            type: 'surge_detected',
            restaurantId: restaurant.id,
            restaurantName: restaurant.name,
            zone: restaurant.address,
            multiplier,
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('checkAndNotifySurge error:', error);
    }
  }
}