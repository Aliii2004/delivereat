import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

// GET /api/addresses
export const getAddresses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user!.userId },
      orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    });
    return res.json({ addresses });
  } catch (e) { next(e); }
};

// POST /api/addresses
export const createAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { label, street, city, latitude, longitude, isDefault } = req.body;
    const userId = req.user!.userId;

    // Agar isDefault = true bo'lsa, boshqalarni false qilish
    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.create({
      data: {
        userId,
        label: label || 'Manzil',
        street,
        city: city || 'Toshkent',
        latitude: latitude || 41.2995,
        longitude: longitude || 69.2401,
        isDefault: isDefault ?? false,
      },
    });
    return res.status(201).json({ address });
  } catch (e) { next(e); }
};

// PATCH /api/addresses/:addressId
export const updateAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { addressId } = req.params;
    const userId = req.user!.userId;

    const existing = await prisma.address.findFirst({ where: { id: addressId, userId } });
    if (!existing) throw new AppError('Manzil topilmadi', 404);

    const { label, street, city, latitude, longitude, isDefault } = req.body;

    if (isDefault) {
      await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }

    const updated: Record<string, unknown> = {};
    if (label     !== undefined) updated.label     = label;
    if (street    !== undefined) updated.street    = street;
    if (city      !== undefined) updated.city      = city;
    if (latitude  !== undefined) updated.latitude  = latitude;
    if (longitude !== undefined) updated.longitude = longitude;
    if (isDefault !== undefined) updated.isDefault = isDefault;

    const address = await prisma.address.update({ where: { id: addressId }, data: updated });
    return res.json({ address });
  } catch (e) { next(e); }
};

// DELETE /api/addresses/:addressId
export const deleteAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { addressId } = req.params;
    const userId = req.user!.userId;

    const existing = await prisma.address.findFirst({ where: { id: addressId, userId } });
    if (!existing) throw new AppError('Manzil topilmadi', 404);

    await prisma.address.delete({ where: { id: addressId } });
    return res.json({ message: 'Manzil o\'chirildi' });
  } catch (e) { next(e); }
};

// PATCH /api/addresses/:addressId/default
export const setDefaultAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { addressId } = req.params;
    const userId = req.user!.userId;

    const existing = await prisma.address.findFirst({ where: { id: addressId, userId } });
    if (!existing) throw new AppError('Manzil topilmadi', 404);

    await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    const address = await prisma.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    });
    return res.json({ address });
  } catch (e) { next(e); }
};
