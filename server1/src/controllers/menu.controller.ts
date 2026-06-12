import { Request, Response, NextFunction } from 'express';
import { RestaurantStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

// ─── O'Z RESTORANI ─────────────────────────────────────────

export const getMyRestaurant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { ownerId: req.user!.userId },
      include: { categories: true },
    });
    if (!restaurant) throw new AppError('Restoran topilmadi', 404);
    return res.json({ restaurant });
  } catch (error) { next(error); }
};



export const getRestaurants = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page   = Number(req.query.page)   || 1;
    const limit  = Number(req.query.limit)  || 20;
    const skip   = (page - 1) * limit;
    
    // FIX: Search & filters qo'shildi — real loyiha uchun zarur
    const search = (req.query.search as string)?.trim() || '';
    const minRating = req.query.minRating ? Number(req.query.minRating) : undefined;
    const status = req.query.status as string | undefined;
    const sortBy = (req.query.sortBy as string) || 'rating'; // rating, name

    // WHERE condition builder
    const where: any = { isVerified: true };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (minRating !== undefined && minRating >= 1 && minRating <= 5) {
      where.rating = { gte: minRating };
    }

    if (status && ['OPEN', 'CLOSED', 'BUSY'].includes(status)) {
      where.status = status;
    }

    // ORDER BY
    const orderBy: any = sortBy === 'name' 
      ? { name: 'asc' } 
      : { rating: 'desc' };

    const [restaurants, total] = await Promise.all([
      prisma.restaurant.findMany({
        where,
        select: {
          id: true, name: true, logo: true,
          rating: true, status: true, address: true, phone: true,
          latitude: true, longitude: true,
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.restaurant.count({ where }),
    ]);

    return res.json({
      restaurants,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) { next(error); }
};

// ─── BITTA RESTORAN ────────────────────────────────────────

export const getRestaurant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.params.restaurantId },
      include: { categories: true },
    });
    if (!restaurant) throw new AppError('Restoran topilmadi', 404);
    return res.json({ restaurant });
  } catch (error) { next(error); }
};

// ─── MENYU ─────────────────────────────────────────────────

export const getMenu = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const menuItems = await prisma.menuItem.findMany({
      where: { restaurantId: req.params.restaurantId, isAvailable: true },
      include: { category: { select: { id: true, name: true } } },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    });
    return res.json({ menuItems });
  } catch (error) { next(error); }
};

// ─── O'Z TAOMLARINI OLISH ──────────────────────────────────

export const getMyMenuItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { ownerId: req.user!.userId },
      select: { id: true },
    });
    if (!restaurant) throw new AppError('Restoran topilmadi', 404);

    const menuItems = await prisma.menuItem.findMany({
      where: { restaurantId: restaurant.id },
      include: { category: { select: { id: true, name: true } } },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    });
    return res.json({ menuItems });
  } catch (e) { next(e); }
};

// ─── KATEGORIYA YARATISH ───────────────────────────────────

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { ownerId: req.user!.userId },
      select: { id: true },
    });
    if (!restaurant) throw new AppError('Restoran topilmadi', 404);

    const { name } = req.body;
    const category = await prisma.category.create({
      data: { name, restaurantId: restaurant.id },
    });
    return res.status(201).json({ category });
  } catch (e) { next(e); }
};

// ─── KATEGORIYA O'CHIRISH ──────────────────────────────────

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { categoryId } = req.params;
    const restaurant = await prisma.restaurant.findUnique({
      where: { ownerId: req.user!.userId },
      select: { id: true },
    });
    if (!restaurant) throw new AppError('Restoran topilmadi', 404);

    const cat = await prisma.category.findFirst({
      where: { id: categoryId, restaurantId: restaurant.id },
    });
    if (!cat) throw new AppError('Kategoriya topilmadi', 404);

    // Kategoriya o'chirilsa taomlar null ga o'tadi
    await prisma.menuItem.updateMany({
      where: { categoryId },
      data: { categoryId: null },
    });
    await prisma.category.delete({ where: { id: categoryId } });
    return res.json({ message: 'Kategoriya o\'chirildi' });
  } catch (e) { next(e); }
};



export const createMenuItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { ownerId: req.user!.userId },
      select: { id: true },
    });
    if (!restaurant) throw new AppError('Restoran topilmadi', 404);

    // Faqat ruxsat etilgan maydonlar — mass assignment oldini olish
    const { name, description, price, categoryId, image, preparationTime } = req.body;

    const item = await prisma.menuItem.create({
      data: {
        name, description, price, image, preparationTime,
        categoryId: categoryId || null,
        restaurantId: restaurant.id,
      },
    });
    return res.status(201).json({ item });
  } catch (error) { next(error); }
};

// ─── TAOM YANGILASH ────────────────────────────────────────
// FIX: ownership tekshiruvi — faqat o'z restoraning taomini o'zgartira olasiz

export const updateMenuItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemId } = req.params;

    // Avval item mavjudligini va ownership ni tekshirish
    const existing = await prisma.menuItem.findFirst({
      where: {
        id: itemId,
        restaurant: { ownerId: req.user!.userId }, // ownership
      },
    });
    if (!existing) throw new AppError('Taom topilmadi yoki ruxsat yo\'q', 404);

    // Faqat ruxsat etilgan maydonlar — mass assignment oldini olish
    const { name, description, price, isAvailable, image, preparationTime } = req.body;
    const updateData: Record<string, unknown> = {};

    if (name             !== undefined) updateData.name             = name;
    if (description      !== undefined) updateData.description      = description;
    if (price            !== undefined) updateData.price            = price;
    if (isAvailable      !== undefined) updateData.isAvailable      = isAvailable;
    if (image            !== undefined) updateData.image            = image;
    if (preparationTime  !== undefined) updateData.preparationTime  = preparationTime;

    const item = await prisma.menuItem.update({
      where: { id: itemId },
      data: updateData,
    });
    return res.json({ item });
  } catch (error) { next(error); }
};

// ─── TAOM O'CHIRISH ────────────────────────────────────────
// FIX: ownership tekshiruvi

export const deleteMenuItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemId } = req.params;

    const existing = await prisma.menuItem.findFirst({
      where: {
        id: itemId,
        restaurant: { ownerId: req.user!.userId },
      },
    });
    if (!existing) throw new AppError('Taom topilmadi yoki ruxsat yo\'q', 404);

    // O'chirish o'rniga mavjud emasligi — soft delete
    // Bu eski buyurtmalardagi menuItem referansini saqlab qoladi
    await prisma.menuItem.update({
      where: { id: itemId },
      data: { isAvailable: false },
    });

    return res.json({ message: 'Taom menyudan olib tashlandi' });
  } catch (error) { next(error); }
};

// ─── RESTORAN HOLATI ───────────────────────────────────────

export const updateRestaurantStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body as { status: RestaurantStatus };

    const restaurant = await prisma.restaurant.findUnique({
      where: { ownerId: req.user!.userId },
    });
    if (!restaurant) throw new AppError('Restoran topilmadi', 404);

    const updated = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { status },
      select: { id: true, name: true, status: true },
    });
    return res.json({ restaurant: updated });
  } catch (error) { next(error); }
};
