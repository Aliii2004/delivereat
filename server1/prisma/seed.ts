import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Test foydalanuvchilar
  const hash = await bcrypt.hash('password123', 12);

  const customer = await prisma.user.upsert({
    where: { email: 'customer@test.com' },
    update: {},
    create: { email: 'customer@test.com', password: hash, name: 'Test Mijoz', role: 'CUSTOMER' },
  });

  const owner = await prisma.user.upsert({
    where: { email: 'owner@test.com' },
    update: {},
    create: { email: 'owner@test.com', password: hash, name: 'Restoran Egasi', role: 'RESTAURANT_OWNER' },
  });

  const courierUser = await prisma.user.upsert({
    where: { email: 'courier@test.com' },
    update: {},
    create: { email: 'courier@test.com', password: hash, name: 'Test Kuryer', role: 'COURIER' },
  });

  // Kuryer profil
  await prisma.courier.upsert({
    where: { userId: courierUser.id },
    update: {},
    create: { userId: courierUser.id, vehicleType: 'bike', status: 'AVAILABLE' },
  });

  // Restoran
  const restaurant = await prisma.restaurant.upsert({
    where: { ownerId: owner.id },
    update: {},
    create: {
      ownerId: owner.id,
      name: 'Toshkent Oshxonasi',
      description: 'Milliy taomlar',
      address: 'Yunusobod tumani, 1-mavze',
      latitude: 41.3111,
      longitude: 69.2797,
      phone: '+998901234567',
      status: 'OPEN',
      isVerified: true,
    },
  });

  // Kategoriya va menyu
  const category = await prisma.category.create({
    data: { name: 'Asosiy taomlar', restaurantId: restaurant.id },
  });

  await prisma.menuItem.createMany({
    skipDuplicates: true,
    data: [
      { name: 'Osh', price: 35000, restaurantId: restaurant.id, categoryId: category.id, preparationTime: 20 },
      { name: 'Lag\'mon', price: 28000, restaurantId: restaurant.id, categoryId: category.id, preparationTime: 15 },
      { name: 'Shashlik', price: 45000, restaurantId: restaurant.id, categoryId: category.id, preparationTime: 25 },
    ],
  });

  // Mijoz manzili
  await prisma.address.create({
    data: {
      userId: customer.id,
      label: 'Uy',
      street: 'Amir Temur ko\'chasi 10',
      city: 'Toshkent',
      latitude: 41.2995,
      longitude: 69.2401,
      isDefault: true,
    },
  });

  console.log('✓ Seed completed');
  console.log('  customer@test.com / password123');
  console.log('  owner@test.com    / password123');
  console.log('  courier@test.com  / password123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
