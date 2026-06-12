import { Request, Response, NextFunction } from 'express';
import { OrderStatus, CourierStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { redisService } from '../services/redis.service';
import { notifyOrderCompleted } from '../services/analytics.service';
import { getIO } from '../lib/socket.instance';
import { SurgeService } from '../services/surge.service';

// ─── TYPES ─────────────────────────────────────────────────

interface OrderItemInput {
  menuItemId: string;
  quantity: number;
  note?: string;
}

interface CreateOrderBody {
  restaurantId: string;
  addressId: string;
  items: OrderItemInput[];
  note?: string;
}

// ─── HELPER: Order status o'zgartirish va broadcast ────────
// OrderStatus enum ishlatiladi — runtime da noto'g'ri status yuborib bo'lmaydi

async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  extraData?: object
) {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status },
    include: { customer: true, restaurant: true, courier: { include: { user: true } } },
  });

  await redisService.setOrderStatus(order.id, status);

  getIO().to(`order:${order.id}`).emit('order:status', {
    orderId: order.id,
    status,
    ...extraData,
  });

  // FIX: Notification yaratish
  const statusMessages: Record<OrderStatus, string> = {
    CONFIRMED: 'Buyurtmangiz qabul qilindi',
    ACCEPTED: 'Restoran buyurtmangizni qabul qildi',
    PREPARING: 'Buyurtmangiz tayyorlanmoqda',
    READY: 'Buyurtmangiz tayyor',
    ON_THE_WAY: 'Kuryer buyurtmani olib ketdi',
    DELIVERED: 'Buyurtmangiz yetkazildi',
    CANCELLED: 'Buyurtmangiz bekor qilindi',
  };

  // Mijozga notification
  await prisma.notification.create({
    data: {
      userId: order.customerId,
      type: 'ORDER_STATUS',
      title: 'Buyurtma holati o\'zgardi',
      message: statusMessages[status] || 'Yangilanish',
      data: JSON.stringify({ orderId: order.id, status }),
    },
  });

  getIO().to(`user:${order.customerId}`).emit('notification', {
    type: 'ORDER_STATUS',
    title: 'Buyurtma holati o\'zgardi',
    message: statusMessages[status],
    orderId: order.id,
  });

  return order;
}

// ─── HELPER: Buyurtma topish yoki 404 ─────────────────────

async function findOrderOrThrow(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError('Buyurtma topilmadi', 404);
  return order;
}

// ─── HELPER: Restoran egasi tekshirish ───────────────────────

async function assertRestaurantOwner(restaurantId: string, userId: string) {
  const restaurant = await prisma.restaurant.findFirst({
    where: { id: restaurantId, ownerId: userId },
    select: { id: true },
  });
  if (!restaurant) {
    throw new AppError("Bu buyurtma sizning restoraningizga tegishli emas", 403);
  }
}

// ─── BUYURTMA YARATISH ─────────────────────────────────────

export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { restaurantId, addressId, items, note } =
      req.body as CreateOrderBody;
    const customerId = req.user!.userId;

    // Restoran ochiqligini tekshirish
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) throw new AppError('Restoran topilmadi', 404);
    if (restaurant.status === 'CLOSED') {
      throw new AppError('Restoran hozir yopiq', 400);
    }

    // Manzil foydalanuvchiga tegishliligini tekshirish
    // 'default' — fallback uchun birinchi manzilni ishlatish
    let address;
    if (addressId === 'default') {
      address = await prisma.address.findFirst({
        where: { userId: customerId },
        orderBy: { isDefault: 'desc' },
      });
    } else {
      address = await prisma.address.findFirst({
        where: { id: addressId, userId: customerId },
      });
    }
    if (!address) throw new AppError('Manzil topilmadi', 404);

    // Narxlarni DB dan olish — client dan kelgan narxga ishonmaslik
    const menuItemIds = items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        restaurantId,       // Faqat shu restoran taomlarini — cross-restaurant attack bloklanadi
        isAvailable: true,
      },
    });

    if (menuItems.length !== items.length) {
      throw new AppError(
        "Ba'zi taomlar mavjud emas yoki boshqa restoranga tegishli",
        400
      );
    }

    // Narx hisoblash
    let subtotal = 0;
    const orderItems = items.map((item) => {
      const menuItem = menuItems.find((m) => m.id === item.menuItemId)!;
      const linePrice = menuItem.price * item.quantity;
      subtotal += linePrice;
      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: menuItem.price, // Birlik narx — menyu narxi keyinchalik o'zgansa eski buyurtmalar ta'sirlanmaydi
        note: item.note,
      };
    });

    // FIX: Surge pricing qo'llash
    const surgeMultiplier = await SurgeService.getSurgeMultiplier(restaurantId);
    const deliveryFee = Math.round(15000 * surgeMultiplier);
    const totalAmount = subtotal + deliveryFee;

    const order = await prisma.order.create({
      data: {
        customerId,
        restaurantId,
        addressId: address.id,   // fallback case da to'g'ri ID
        note,
        totalAmount,
        deliveryFee,
        status: OrderStatus.CONFIRMED,
        items: { create: orderItems },
      },
      include: {
        items: { include: { menuItem: { select: { name: true, price: true } } } },
        restaurant: { select: { name: true, phone: true } },
        address: true,
      },
    });

    await redisService.setOrderStatus(order.id, OrderStatus.CONFIRMED);

    // Restoranga Socket.io xabar
    getIO().to(`restaurant:${restaurantId}`).emit('order:new', {
      orderId: order.id,
      totalAmount: order.totalAmount,
      itemsCount: orderItems.length,
      customerNote: note,
    });

    // FIX: Restoran egasiga notification
    await prisma.notification.create({
      data: {
        userId: restaurant.ownerId,
        type: 'NEW_ORDER',
        title: 'Yangi buyurtma',
        message: `${totalAmount.toLocaleString()} so'm - ${orderItems.length} ta taom`,
        data: JSON.stringify({ orderId: order.id }),
      },
    });

    getIO().to(`user:${restaurant.ownerId}`).emit('notification', {
      type: 'NEW_ORDER',
      title: 'Yangi buyurtma',
      message: `${totalAmount.toLocaleString()} so'm`,
      orderId: order.id,
    });

    await redisService.publish('order.events', {
      type: 'order_created',
      orderId: order.id,
      restaurantId,
      customerId,
      totalAmount,
      timestamp: new Date().toISOString(),
    });

    return res.status(201).json({ order });
  } catch (error) {
    next(error);
  }
};

// ─── BUYURTMALAR RO'YXATI ──────────────────────────────────

export const getMyOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, role } = req.user!;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // COURIER uchun: avval courier.id ni topamiz, keyin filter qilamiz
    let where: object = {};
    if (role === 'CUSTOMER') {
      where = { customerId: userId };
    } else if (role === 'COURIER') {
      const courier = await prisma.courier.findUnique({
        where: { userId },
        select: { id: true },
      });
      where = courier ? { courierId: courier.id } : { id: 'none' };
    } else if (role === 'RESTAURANT_OWNER') {
      where = { restaurant: { ownerId: userId } };
    }

    // count va orders parallel — ikkita alohida so'rov o'rniga bitta parallel
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          restaurant: { select: { name: true, logo: true } },
          items: { include: { menuItem: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return res.json({
      orders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// ─── BITTA BUYURTMA ────────────────────────────────────────
// FIX: restoran ownership to'liq tekshiruvi — shunchaki role emas, real ownerId

export const getOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, role } = req.user!;
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { menuItem: true } },
        restaurant: true,  // ownerId tekshirish uchun kerak
        courier: {
          include: { user: { select: { name: true, phone: true } } },
        },
        address: true,
      },
    });

    if (!order) throw new AppError('Buyurtma topilmadi', 404);

    const isCustomer        = order.customerId === userId;
    const isCourier         = role === 'COURIER' && order.courier?.userId === userId;
    const isRestaurantOwner = role === 'RESTAURANT_OWNER' &&
                              order.restaurant.ownerId === userId;
    const isAdmin           = role === 'ADMIN';

    if (!isCustomer && !isCourier && !isRestaurantOwner && !isAdmin) {
      throw new AppError("Ruxsat yo'q", 403);
    }

    // FIX: ETA calculation — real loyihada bo'lishi kerak
    const eta = calculateETA(order);

    return res.json({ order, eta });
  } catch (error) {
    next(error);
  }
};

// ─── ETA HISOBLASH ─────────────────────────────────────────
// Restaurant prep time + delivery time estimate

function calculateETA(order: any): { estimatedMinutes: number; estimatedTime: string } | null {
  // Faqat aktiv buyurtmalar uchun
  if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
    return null;
  }

  let estimatedMinutes = 0;

  // Restaurant preparation time
  if (order.status === 'CONFIRMED' || order.status === 'ACCEPTED' || order.status === 'PREPARING') {
    // Har bir item ning prep time + 10 min base
    const prepTime = order.items.reduce((sum: number, item: any) => {
      return sum + (item.menuItem?.preparationTime || 15);
    }, 0);
    estimatedMinutes += Math.min(prepTime, 45); // Max 45 min prep
  }

  // Delivery time (distance-based estimate)
  if (order.status !== 'READY') {
    // Simple estimate: 15-30 min delivery
    estimatedMinutes += 20;
  } else {
    // Tayyor, kuryer kutilmoqda
    estimatedMinutes += 25;
  }

  // Status ga qarab adjustment
  if (order.status === 'ON_THE_WAY') {
    estimatedMinutes = 15; // Kuryer yo'lda, 15 min qoldi
  }

  const estimatedTime = new Date(Date.now() + estimatedMinutes * 60000).toISOString();

  return { estimatedMinutes, estimatedTime };
}

// ─── RESTORAN QABUL QILDI ─────────────────────────────────

export const acceptOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const order = await findOrderOrThrow(req.params.orderId);
    await assertRestaurantOwner(order.restaurantId, req.user!.userId);

    if (order.status !== OrderStatus.CONFIRMED) {
      throw new AppError(`Buyurtma allaqachon "${order.status}" holatida`, 400);
    }

    const updated = await updateOrderStatus(order.id, OrderStatus.ACCEPTED);
    return res.json({ order: updated });
  } catch (error) {
    next(error);
  }
};

// ─── TAYYORLANMOQDA ────────────────────────────────────────

export const markPreparing = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const order = await findOrderOrThrow(req.params.orderId);
    await assertRestaurantOwner(order.restaurantId, req.user!.userId);

    if (order.status !== OrderStatus.ACCEPTED) {
      throw new AppError('Buyurtma avval qabul qilinishi kerak', 400);
    }

    const updated = await updateOrderStatus(order.id, OrderStatus.PREPARING);
    return res.json({ order: updated });
  } catch (error) {
    next(error);
  }
};

// ─── TAYYOR (KURYER KUTMOQDA) ──────────────────────────────

export const markReady = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const order = await findOrderOrThrow(req.params.orderId);
    await assertRestaurantOwner(order.restaurantId, req.user!.userId);

    if (order.status !== OrderStatus.PREPARING) {
      throw new AppError("Buyurtma avval tayyorlanish holatiga o'tishi kerak", 400);
    }

    const updated = await updateOrderStatus(order.id, OrderStatus.READY);
    return res.json({ order: updated });
  } catch (error) {
    next(error);
  }
};

// ─── KURYER OLDI ──────────────────────────────────────────
// FIX: atomic update — race condition hal qilindi
// Ikkita kuryer bir vaqtda olishga harakat qilsa, faqat biri muvaffaqiyatli bo'ladi

export const pickupOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { orderId } = req.params;
    const userId = req.user!.userId;

    // Courier profil topish yoki yaratish (upsert)
    const courier = await prisma.courier.upsert({
      where: { userId },
      update: {},
      create: { userId, vehicleType: 'bike', status: CourierStatus.AVAILABLE },
      select: { id: true },
    });

    // updateMany atomik — WHERE va UPDATE bitta DB tranzaksiyasida bajariladi
    const result = await prisma.order.updateMany({
      where: {
        id: orderId,
        status: OrderStatus.READY,
        courierId: null, // Boshqa kuryer olmaganligini tekshirish
      },
      data: {
        status: OrderStatus.ON_THE_WAY,
        courierId: courier.id, // Courier.id (userId emas!)
      },
    });

    if (result.count === 0) {
      throw new AppError(
        'Buyurtma hali tayyor emas yoki boshqa kuryer allaqachon oldi',
        409
      );
    }

    const updated = await prisma.order.findUnique({ where: { id: orderId } });

    await redisService.setOrderStatus(orderId, OrderStatus.ON_THE_WAY);

    getIO().to(`order:${orderId}`).emit('order:status', {
      orderId,
      status: OrderStatus.ON_THE_WAY,
      courierId: courier.id,
    });

    // Courier statusini BUSY ga o'zgartirish
    await prisma.courier.update({
      where: { id: courier.id },
      data: { status: CourierStatus.BUSY },
    });

    return res.json({ order: updated });
  } catch (error) {
    next(error);
  }
};

// ─── YETKAZILDI ───────────────────────────────────────────

export const deliverOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const order = await findOrderOrThrow(req.params.orderId);
    const userId = req.user!.userId;

    if (order.status !== OrderStatus.ON_THE_WAY) {
      throw new AppError("Buyurtma yo'lda emas", 400);
    }

    // Courier profil topish
    const courier = await prisma.courier.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!courier || order.courierId !== courier.id) {
      throw new AppError('Bu buyurtma sizga tegishli emas', 403);
    }

    const deliveryTime = Math.round(
      (Date.now() - order.createdAt.getTime()) / 60000
    );

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.DELIVERED },
    });

    await redisService.setOrderStatus(updated.id, OrderStatus.DELIVERED);

    getIO().to(`order:${updated.id}`).emit('order:status', {
      orderId: updated.id,
      status: OrderStatus.DELIVERED,
      deliveryTime,
    });

    // Kuryerni AVAILABLE ga qaytarish
    await prisma.courier.update({
      where: { id: courier.id },
      data: {
        status: CourierStatus.AVAILABLE,
        totalDeliveries: { increment: 1 },
      },
    });

    // S2 ga HTTP notification — analytics uchun, xato bo'lsa to'xtatmaydi
    await notifyOrderCompleted({
      orderId: updated.id,
      restaurantId: updated.restaurantId,
      courierId: courier.id,
      totalAmount: updated.totalAmount,
      deliveryTime,
    });

    await redisService.publish('order.events', {
      type: 'order_delivered',
      orderId: updated.id,
      restaurantId: updated.restaurantId,
      courierId: courier.id,
      deliveryTime,
      timestamp: new Date().toISOString(),
    });

    return res.json({ order: updated });
  } catch (error) {
    next(error);
  }
};

// ─── BEKOR QILISH ─────────────────────────────────────────

export const cancelOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, role } = req.user!;
    const { reason } = req.body;

    const order = await findOrderOrThrow(req.params.orderId);

    const cancellableStatuses: OrderStatus[] = [
      OrderStatus.CONFIRMED,
      OrderStatus.ACCEPTED,
      OrderStatus.PREPARING,
    ];

    if (!cancellableStatuses.includes(order.status)) {
      throw new AppError(
        `"${order.status}" holatidagi buyurtmani bekor qilib bo'lmaydi`,
        400
      );
    }

    if (role !== 'ADMIN') {
      if (role === 'CUSTOMER' && order.customerId !== userId) {
        throw new AppError("Ruxsat yo'q", 403);
      } else if (role === 'RESTAURANT_OWNER') {
        await assertRestaurantOwner(order.restaurantId, userId);
      } else if (role !== 'CUSTOMER') {
        throw new AppError("Ruxsat yo'q", 403);
      }
    }

    const updated = await updateOrderStatus(
      order.id,
      OrderStatus.CANCELLED,
      { reason }
    );

    await redisService.publish('order.events', {
      type: 'order_cancelled',
      orderId: updated.id,
      restaurantId: updated.restaurantId,
      reason,
      cancelledBy: userId,
      timestamp: new Date().toISOString(),
    });

    return res.json({ order: updated });
  } catch (error) {
    next(error);
  }
};
