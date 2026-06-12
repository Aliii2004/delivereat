# DeliverEat — Loyiha Taqdimoti

## Loyiha haqida umumiy ma'lumot

DeliverEat — bu real-time ovqat yetkazib berish platformasi. Foydalanuvchilar restorandan ovqat buyurtma qiladi, restoran egasi uni tayyorlaydi, kuryer yetkazib beradi. Har bir qadam real vaqtda ko'rinadi.

---

## Arxitektura: Microservices

Loyiha 3 ta alohida servisdan iborat:

```
[Browser / Client]
       |
   [Nginx] ← reverse proxy, 80-port
   /     \
[Server1] [Server2]
Express   FastAPI
  |          |
[PostgreSQL] [PostgreSQL]   [Redis]
(asosiy DB)  (analytics DB)  (cache + pubsub)
```

### Nima uchun microservices?

- **Server1 (Express/Node.js)** — CRUD operatsiyalar, real-time Socket.io, autentifikatsiya
- **Server2 (FastAPI/Python)** — GraphQL analytics, statistika, burndown chartlar
- **Nginx** — bitta entry point, load balancing, SSL
- **Redis** — kuryer GPS ni cache da saqlash, orderlar o'rtasida Pub/Sub xabarlashuv
- **PostgreSQL** — ikki alohida database (asosiy va analytics)

---

## Texnologiyalar va ularning roli

### Backend (Server1) — Express + TypeScript
- **JWT authentication** — access token (15 min) + refresh token (7 kun)
- **Prisma ORM** — type-safe database queries, SQL injection himoya
- **Socket.io** — real-time bidirectional communication
- **Redis** — GPS location caching, event publishing

### Backend (Server2) — FastAPI + Python
- **GraphQL (Strawberry)** — flexible analytics queries
- **SQLAlchemy** — Python database ORM
- **Internal API** — Server1 dan HTTP webhook qabul qiladi (INTERNAL_API_SECRET bilan himoyalangan)

### Frontend — Next.js + TypeScript
- **React Query** — server state management, caching
- **Zustand** — client state (auth, cart)
- **Socket.io-client** — real-time updates qabul qilish
- **Leaflet** — interaktiv map, kuryer joylashuvini ko'rsatish
- **Tailwind CSS** — utility-first styling

### Infrastructure
- **Docker + Docker Compose** — barcha servislar konteynerda
- **Nginx** — reverse proxy, `/api` → Server1, `/graphql` → Server2

---

## Ma'lumotlar bazasi sxemasi

### Asosiy modellar (PostgreSQL):

```
User (id, email, password[hashed], name, phone, role)
  ├── Address (label, street, city, lat, lng)
  ├── Restaurant (name, address, status, rating)
  │     ├── Category (name)
  │     └── MenuItem (name, price, preparationTime, isAvailable)
  ├── Order (status, totalAmount, deliveryFee, surgeMultiplier)
  │     └── OrderItem (menuItemId, quantity, price)
  ├── Courier (status, vehicleType, totalDeliveries, rating)
  ├── Review (restaurantRating, courierRating, comment)
  └── Notification (type, title, message, isRead)
```

### Order status flow:
```
CONFIRMED → ACCEPTED → PREPARING → READY → ON_THE_WAY → DELIVERED
                                           ↓
                                       CANCELLED
```

---

## Xavfsizlik

### 1. JWT Authentication
```typescript
// Access token: 15 daqiqada expire
// Refresh token: 7 kunda expire
// Token blacklist: logout qilinganda token Redis ga qo'yiladi
```

### 2. Price Tampering himoya
Mijoz tomonidan narx yuborilmaydi — narxlar database dan olinadi:
```typescript
// BAD: items.price (client dan kelgan — manipulyatsiya mumkin)
// GOOD: menuItem.price (database dan)
const menuItems = await prisma.menuItem.findMany({
  where: { id: { in: menuItemIds }, restaurantId } // cross-restaurant attack himoya
});
```

### 3. Race Condition (atomic pickup)
Ikki kuryer bir vaqtda bir orderni olishga harakat qilsa:
```typescript
// updateMany atomik — faqat biri muvaffaqiyatli bo'ladi
const result = await prisma.order.updateMany({
  where: { id: orderId, status: 'READY', courierId: null },
  data: { status: 'ON_THE_WAY', courierId: courier.id }
});
if (result.count === 0) throw new Error('Boshqa kuryer oldi');
```

### 4. Ownership validation
Har bir endpoint da foydalanuvchi faqat o'z ma'lumotlarini ko'ra/o'zgartira olishi tekshiriladi.

### 5. Internal API Secret
Server2 faqat to'g'ri `X-Internal-Secret` header bilan Server1 dan xabar qabul qiladi.

---

## Real-time (Socket.io)

### Qanday ishlaydi:

```
Mijoz → join:order (orderId) → order xonasiga qo'shiladi
Restoran → join:restaurant (id) → yangi orderlarni ko'radi
Kuryer → join:all-zones → surge alertlarni ko'radi

Server → order:status → barcha order xonasiga yuboradi
Server → courier:moved → mijozga kuryer joylashuvini yuboradi
Server → surge:alert → barcha kuryerlarga yuboradi
Server → notification → foydalanuvchiga shaxsiy xabar
```

### Real-time scenario:
1. Mijoz buyurtma beradi
2. Server → Restoranga `order:new` event
3. Restoran qabul qiladi → Server → Mijozga `order:status: ACCEPTED`
4. Restoran tayyorlab bo'ldi → `READY`
5. Kuryer oladi → `ON_THE_WAY`
6. Kuryer GPS yuboradi → Mijoz xaritada kuryer harakatini ko'radi
7. Yetkazildi → `DELIVERED` → Mijozga notification

---

## GraphQL Analytics (Server2)

### Restaurant statistikasi:
```graphql
query {
  restaurantStats(restaurantId: "uuid", days: 30) {
    totalOrders      # Jami buyurtmalar
    totalRevenue     # Jami daromad
    averageOrderValue # O'rtacha buyurtma qiymati
    averageDeliveryTime # O'rtacha yetkazish vaqti
  }

  burndownChart(restaurantId: "uuid", days: 14) {
    date
    completedOrders
    cancelledOrders
    revenue
  }
}
```

### Kuryer statistikasi:
```graphql
query {
  courierPerformance(courierId: "uuid", days: 30) {
    totalDeliveries
    totalEarnings
    averageDeliveryTime
    rating
  }
}
```

---

## Surge Pricing (dinamik narxlash)

Talabga qarab delivery fee avtomatik oshadi:

```typescript
// Logika:
if (availableCouriers === 0 && activeOrders > 0) multiplier = 2.0; // 2x
else if (ratio > 3) multiplier = 2.0;  // 3+ buyurtma / 1 kuryer
else if (ratio > 2) multiplier = 1.5;  // 1.5x
else if (ratio > 1) multiplier = 1.2;  // 1.2x
else multiplier = 1.0;                 // Normal

// Redis da 1 daqiqa cache
// Har 5 daqiqada background monitoring
// Socket.io orqali kuryerlarga alert
```

---

## Geo-filtering (Haversine formula)

Kuryer faqat yaqin atrofidagi orderlarni ko'radi:

```typescript
function calculateDistance(lat1, lng1, lat2, lng2): number {
  const R = 6371; // Yer radiusi km
  // Haversine formula — ikki GPS nuqta orasidagi masofa
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)² + cos(lat1) * cos(lat2) * Math.sin(dLng/2)²;
  return R * 2 * Math.atan2(√a, √(1-a));
}
// Faqat radius (50km) ichidagi orderlar ko'rsatiladi
```

---

## ETA hisoblash

```typescript
// Status ga qarab taxminiy vaqt:
CONFIRMED/ACCEPTED/PREPARING: preparationTime + 20 min (yetkazish)
READY:                        25 min (kuryer kutilmoqda)
ON_THE_WAY:                   15 min (kuryer yo'lda)
DELIVERED/CANCELLED:          null
```

---

## Foydalanuvchi rollari

### CUSTOMER (Mijoz)
- Restoranlarni ko'rish, qidirish, filter qilish
- Menyu ko'rish, savatga qo'shish
- Buyurtma berish (surge pricing avtomatik)
- Real-time tracking (xarita + status)
- Bekor qilish (READY bo'lguncha)
- Review qoldirish (1 marta)
- Notifications

### RESTAURANT_OWNER (Restoran egasi)
- Menyu boshqaruv (CRUD)
- Kategoriya boshqaruv
- Buyurtmalarni qabul qilish: CONFIRMED → ACCEPTED → PREPARING → READY
- Restaurant status: OPEN / CLOSED / BUSY
- GraphQL analytics: daromad, buyurtmalar, o'rtacha qiymat

### COURIER (Kuryer)
- Status: AVAILABLE / OFFLINE
- Geo-filtered orderlar ko'rish (radius ichida)
- Buyurtma olish (atomic — race condition yo'q)
- GPS location yuborish (real-time)
- Yetkazib berish → avtomatik AVAILABLE
- Surge alert qabul qilish

---

## Docker Compose

```yaml
services:
  nginx:     # Reverse proxy (80-port)
  server1:   # Express API (4000-port)
  server2:   # FastAPI GraphQL (8000-port)
  client:    # Next.js frontend (3000-port)
  db1:       # PostgreSQL asosiy
  db2:       # PostgreSQL analytics
  redis:     # Cache + Pub/Sub
```

---

## API Endpoints (asosiylar)

### Authentication
| Method | Endpoint | Kim |
|--------|----------|-----|
| POST | /api/auth/register | Hamma |
| POST | /api/auth/login | Hamma |
| POST | /api/auth/logout | Auth |
| POST | /api/auth/refresh | Auth |

### Orders
| Method | Endpoint | Kim |
|--------|----------|-----|
| POST | /api/orders | Customer |
| GET | /api/orders | Rol bo'yicha filter |
| GET | /api/orders/:id | Ownership check |
| PATCH | /api/orders/:id/accept | Restaurant |
| PATCH | /api/orders/:id/preparing | Restaurant |
| PATCH | /api/orders/:id/ready | Restaurant |
| PATCH | /api/orders/:id/pickup | Courier |
| PATCH | /api/orders/:id/deliver | Courier |
| PATCH | /api/orders/:id/cancel | Customer |

### Menu
| Method | Endpoint | Kim |
|--------|----------|-----|
| GET | /api/menu/restaurants | Public |
| GET | /api/menu/restaurants/:id/menu | Public |
| POST | /api/menu/items | Restaurant |
| PATCH | /api/menu/items/:id | Restaurant |
| DELETE | /api/menu/items/:id | Restaurant |

### Courier
| Method | Endpoint | Kim |
|--------|----------|-----|
| GET | /api/couriers/available-orders | Courier |
| PATCH | /api/couriers/status | Courier |
| PATCH | /api/couriers/location | Courier |

---

## Demo scenario (ustozga ko'rsatish uchun)

### 1. Mijoz sifatida:
1. Register → CUSTOMER roli
2. Restoranlar ro'yxati (search "oshxona")
3. Menyu ochish → taom qo'shish
4. Checkout → buyurtma berish
5. Tracking sahifasi → ETA ko'rish

### 2. Restoran egasi sifatida (parallel tab):
1. Login → RESTAURANT_OWNER
2. Buyurtmalar sahifasi → yangi buyurtma ko'rinadi (real-time!)
3. "Qabul qilish" → "Tayyorlanmoqda" → "Tayyor"

### 3. Kuryer sifatida (parallel tab):
1. Login → COURIER
2. "Faol" tugmasini bosish
3. Buyurtma ro'yxatida ko'rinadi
4. "Buyurtmani oldim" → GPS yuboriladi
5. Mijoz xaritada kuryer harakatini ko'radi
6. "Yetkazib berdim"

### 4. Analytics (GraphQL):
```
http://localhost/graphql → Playground
restaurantStats(...) → Ko'rsatish
```

---

## Qilingan texnik ishlar

### 1. Database schema
- 9 ta model: User, Address, Restaurant, Category, MenuItem, Order, OrderItem, Courier, Review, Notification
- Enum types: UserRole, OrderStatus, CourierStatus, RestaurantStatus
- Indexlar: performance uchun
- Cascade delete: bog'liq ma'lumotlar

### 2. Authentication tizimi
- bcrypt bilan password hashing
- SHA-256 bilan token hashing (Redis da)
- Access + Refresh token pattern
- Token blacklist (logout da)
- Middleware: role-based access control

### 3. Real-time (Socket.io)
- JWT bilan socket autentifikatsiya
- Room-based messaging (order room, restaurant room, zones)
- Ownership validation (foydalanuvchi faqat o'z order xonasiga kira oladi)
- Redis Pub/Sub: servislar orasida event broadcasting

### 4. Microservice communication
- Server1 → Server2: HTTP POST (order_completed webhook)
- Server2 → DB2: SQLAlchemy orqali analytics yozish
- Redis Pub/Sub: internal event bus

### 5. Performance optimizatsiyalar
- Redis caching: GPS location (5 min TTL), surge multiplier (1 min TTL)
- Parallel DB queries: `Promise.all([orders, count])`
- Atomic updates: race condition himoya
- Pagination: barcha list endpointlarda

### 6. Error handling
- Global error middleware
- AppError class: custom status codes
- Prisma error handling: P2002 (unique constraint), P2025 (not found)
- 404, 403, 400, 409 status codelar

---

## Loyihadan o'rganilganlar

1. **Microservices** — servislarni mustaqil deploy qilish mumkin
2. **Event-driven architecture** — Redis Pub/Sub orqali loose coupling
3. **Real-time systems** — Socket.io rooms va namespaces
4. **Database design** — normalizatsiya, indexlar, cascade
5. **Security** — JWT, ownership validation, price protection
6. **Docker** — containerization, networking, volumes
7. **TypeScript** — type safety, compile-time errors
8. **GraphQL** — flexible queries vs REST
9. **Algorithm** — Haversine formula, surge pricing, ETA calculation

---

*DeliverEat — API va Dastur Ishlab Chiqish kursi uchun yaratilgan loyiha*
