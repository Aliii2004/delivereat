# DeliverEat 🛵

Real-time ovqat yetkazib berish platformasi — O'zbekiston uchun.

## Texnologiyalar

| Qatlam | Stack |
|---|---|
| Frontend | Next.js 14, TanStack Query, Zustand, Apollo Client |
| Gateway | Nginx |
| Server 1 | Express.js, Socket.io, Prisma, PostgreSQL, Redis |
| Server 2 | FastAPI, Strawberry GraphQL, SQLAlchemy, PostgreSQL |
| Infra | Docker, docker-compose |

## Ishga tushirish

### 1. Talab qilinadigan dasturlar

- Docker Desktop (v24+)
- Node.js 20+ (lokal ishlab chiqish uchun)
- Python 3.11+ (lokal ishlab chiqish uchun)

### 2. Loyihani klonlash

```bash
git clone <repo-url>
cd delivereat
```

### 3. Environment o'zgaruvchilarini sozlash

```bash
cp .env.example .env
```

`.env` faylini oching va quyidagilarni to'ldiring:

```bash
# JWT secret generatsiya qilish
openssl rand -base64 64  # JWT_SECRET uchun
openssl rand -base64 64  # JWT_REFRESH_SECRET uchun (boshqa qiymat)
openssl rand -base64 32  # INTERNAL_API_SECRET uchun

# Parollar
DB_PASSWORD=<kuchli_parol>
REDIS_PASSWORD=<kuchli_parol>
```

**MUHIM:** `.env` faylini to'ldirmasdan ishga tushirish xatoga olib keladi!

### 4. Docker bilan ishga tushirish

```bash
docker-compose up --build
```

Birinchi marta ~5-10 daqiqa ketadi (image build).

### 5. Database migration va seed

Server1 (PostgreSQL) migration avtomatik bajariladi (Dockerfile entrypoint).

**YANGI MODELLAR UCHUN MIGRATION:**
```bash
# Container ichida migration yaratish
docker exec -it delivereat_server1 npx prisma migrate dev --name add_reviews_notifications

# Yoki containerdan tashqarida (local dev)
npx prisma migrate dev --name add_reviews_notifications
```

Server2 (PostgreSQL) uchun Alembic migration:

```bash
# FIX: OrderEvent unique constraint uchun migration yaratish
docker exec delivereat_server2 alembic revision --autogenerate -m "add_order_event_unique_constraint"
docker exec delivereat_server2 alembic upgrade head
```

Test ma'lumotlar (ixtiyoriy):
```bash
docker exec delivereat_server1 npm run prisma:seed
```

### 6. Tekshirish

| Servis | URL |
|---|---|
| Frontend | http://localhost |
| REST API | http://localhost/api/health |
| GraphQL Playground | http://localhost/graphql |
| Server 1 (to'g'ridan) | http://localhost:4000 |
| Server 2 (to'g'ridan) | http://localhost:8000/docs |

## Test foydalanuvchilar (seed dan keyin)

| Email | Parol | Role |
|---|---|---|
| customer@test.com | password123 | Mijoz |
| owner@test.com | password123 | Restoran egasi |
| courier@test.com | password123 | Kuryer |

## Loyiha tuzilmasi

```
delivereat/
├── nginx/              # API Gateway
├── client/             # Next.js 14 frontend
├── server1/            # Express + Socket.io (REST API)
│   └── prisma/         # DB schema va migration lar
├── server2/            # FastAPI + GraphQL (Analytics)
│   └── alembic/        # DB migration lar
├── docker-compose.yml
└── .env.example
```

## API hujjatlari

### REST API (Server 1 — Port 4000)

#### Auth
```
POST /api/auth/register   — Ro'yxatdan o'tish
POST /api/auth/login      — Kirish
POST /api/auth/refresh    — Token yangilash
POST /api/auth/logout     — Chiqish
GET  /api/auth/me         — Joriy foydalanuvchi
```

#### Menu
```
GET    /api/menu/restaurants              — Restoranlar ro'yxati
GET    /api/menu/restaurants/:id          — Bitta restoran
GET    /api/menu/restaurants/:id/menu     — Menyu
POST   /api/menu/items                    — Taom qo'shish (restoran egasi)
PATCH  /api/menu/items/:id               — Taom yangilash
DELETE /api/menu/items/:id               — Taom o'chirish
PATCH  /api/menu/restaurant/status       — Restoran holati
```

#### Orders
```
POST  /api/orders                  — Buyurtma yaratish
GET   /api/orders                  — Buyurtmalar ro'yxati
GET   /api/orders/:id              — Bitta buyurtma
PATCH /api/orders/:id/accept       — Qabul qilish (restoran)
PATCH /api/orders/:id/preparing    — Tayyorlanmoqda (restoran)
PATCH /api/orders/:id/ready        — Tayyor (restoran)
PATCH /api/orders/:id/pickup       — Olib ketdi (kuryer)
PATCH /api/orders/:id/deliver      — Yetkazdi (kuryer)
PATCH /api/orders/:id/cancel       — Bekor qilish
```

#### Couriers
```
PATCH /api/couriers/status          — Holat yangilash (OFFLINE/AVAILABLE)
PATCH /api/couriers/location        — GPS yangilash
GET   /api/couriers/available       — Mavjud kuryerlar (admin/restaurant)
GET   /api/couriers/profile         — Kuryer profili
GET   /api/couriers/available-orders — Tayyor buyurtmalar ro'yxati (kuryer uchun)
```

#### Reviews
```
POST /api/reviews                      — Review yaratish (restoran/kuryer)
GET  /api/reviews/restaurant/:id      — Restoran reviewlari
GET  /api/reviews/courier/:id         — Kuryer reviewlari
```

#### Notifications
```
GET    /api/notifications              — Notificationlar ro'yxati
GET    /api/notifications/unread-count — O'qilmagan soni
PATCH  /api/notifications/:id/read    — O'qilgan deb belgilash
PATCH  /api/notifications/mark-all-read — Barchasi o'qilgan
DELETE /api/notifications/:id          — Notification o'chirish
```

### Socket.io Events (Server 1)

#### Client → Server
```
join:order(orderId)                          — Buyurtma room ga qo'shilish
join:restaurant(restaurantId)                — Restoran room ga qo'shilish
courier:location({ lat, lng, orderId })      — GPS yangilash
```

#### Server → Client
```
order:new(notif)              — Yangi buyurtma (restoranga)
order:status(event)           — Holat o'zgarishi
courier:moved(event)          — Kuryer joylashuvi
joined:order({ orderId })     — Room ga qo'shilish tasdiqlandi
notification(data)            — Yangi notification (real-time)
error({ message })            — Xato
```

### GraphQL API (Server 2 — Port 8000)

```graphql
query {
  restaurantStats(restaurantId: "...", days: 30) {
    totalOrders
    completedOrders
    completionRate
    totalRevenue
    avgDeliveryTime
  }

  burndownChart(restaurantId: "...", days: 14) {
    date
    totalOrders
    completedOrders
    revenue
  }

  courierPerformance(courierId: "...", days: 30) {
    totalDeliveries
    avgDeliveryTime
    totalEarnings
  }

  recentEvents(restaurantId: "...", limit: 20) {
    orderId
    eventType
    totalAmount
    createdAt
  }
}
```

## Microservice kommunikatsiya

```
S1 → S2 (HTTP):  POST http://server2:8000/internal/order-completed
S2 → S1 (HTTP):  POST http://server1:4000/internal/surge-alert
S1 → S2 (Redis): PUBLISH order.events → S2 SUBSCRIBE
```

## 🔧 O'zgarishlar (v1.1)

### Tuzatilgan muammolar:
1. ✅ **Server1 production build** — multi-stage Dockerfile, entrypoint script
2. ✅ **Redis password** — connection URL larda to'g'ri ishlatiladi
3. ✅ **Socket.io auth** — token expiry check va auto-reconnect
4. ✅ **Internal API security** — shared secret (INTERNAL_API_SECRET)
5. ✅ **Courier buyurtma olishi** — `/api/couriers/available-orders` endpoint
6. ✅ **Stats service race condition** — PostgreSQL UPSERT
7. ✅ **OrderEvent duplicate** — unique constraint
8. ✅ **Nginx timeout** — 5 daqiqaga tushirildi
9. ✅ **Healthcheck** — DB va Redis connectivity check
10. ✅ **Courier location TTL** — 5 daqiqaga oshirildi

### Yangi funksiyalar:
- **Courier available orders API** — kuryerlar uchun pickup qilish mumkin bo'lgan buyurtmalar
- **Distance filtering** — kuryer koordinatalari bo'yicha buyurtmalarni filterlash
- **Better error handling** — Prisma P2002 (unique constraint) xatolarini to'g'ri boshqarish

## 🔧 O'zgarishlar (v1.2) - NEW! ⭐

### Yangi funksiyalar:
1. ✅ **Rating & Review System** — Restoran va kuryerlarga baho berish (1-5 yulduz)
   - Review matn va rating
   - O'rtacha rating hisoblash
   - Review history
   
2. ✅ **Notification System** — Real-time push notifications
   - Order status o'zgarganda notification
   - Yangi buyurtma (restoran egasiga)
   - Review qoldirilganda
   - Notification history (database)
   - Mark as read/unread
   - Unread count
   - Socket.io real-time delivery

3. ✅ **Enhanced Socket.io** — User rooms
   - Har bir user o'z room iga avtomatik qo'shiladi
   - Real-time notification delivery

**Database-per-service** — `db1` faqat `server1` ga, `db2` faqat `server2` ga ulangan. Docker network izolyatsiyasi orqali ta'minlangan.

**Redis 3 xil maqsadda:**
- `courier:{id}:location` — GPS cache (60s TTL)
- `order:{id}:status` — Buyurtma holat cache (24h TTL)
- `order.events` — Pub/sub kanali (S1 → S2)
- `blacklist:{hash}` — JWT blacklist
- `refresh:{userId}` — Refresh token store

**Atomic pickup** — `pickupOrder` da `updateMany` ishlatiladi. Ikki kuryer bir vaqtda bosib qolsa faqat biri muvaffaqiyatli bo'ladi (race condition hal qilingan).

**JWT blacklist** — SHA-256 hash saqlanadi (to'liq token emas) — xotira tejash uchun.

## Muammolarni hal qilish

**Docker ishga tushmaydi:**
```bash
docker-compose down -v
docker-compose up --build
```

**Migration xatosi:**
```bash
docker exec delivereat_server1 npx prisma migrate reset --force
```

**Redis ulanmaydi:**
```bash
docker exec delivereat_redis redis-cli ping
# "PONG" chiqishi kerak
```

**Server 2 GraphQL xatosi:**
```bash
docker logs delivereat_server2
```
