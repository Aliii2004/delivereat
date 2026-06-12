# Sequence Diagram: Buyurtma Yaratish Jarayoni

## Mermaid Diagrammasi (Asosiy versiya)

```mermaid
sequenceDiagram
    participant Client as Mijoz (Browser)
    participant S1 as Server 1 (Express/Node.js)
    participant DB as PostgreSQL
    participant Redis as Redis Cache & Pub/Sub
    participant S2 as Server 2 (FastAPI/Python)
    participant Socket as Socket.io (Restaurant)
    
    Note over Client,Socket: BUYURTMA YARATISH VA HODISALARNI TARQATISH
    
    %% 1. Mijoz buyurtma yuboradi
    Client->>S1: POST /api/orders<br/>{restaurantId, addressId, items[]}
    activate S1
    
    %% 2. Restoran tekshiruvi
    S1->>DB: SELECT * FROM Restaurant<br/>WHERE id=restaurantId AND status='OPEN'
    DB-->>S1: Restaurant ma'lumotlari
    
    alt Restoran yopiq
        S1-->>Client: 400 Bad Request<br/>"Restoran yopiq"
    end
    
    %% 3. Menu va narxlarni tekshirish
    S1->>DB: SELECT * FROM MenuItem<br/>WHERE id IN (items[]) AND restaurantId=?
    DB-->>S1: Haqiqiy narxlar (serverdan)
    
    Note over S1: ⚠️ Xavfsizlik: Narxlar<br/>clientdan emas, DB dan olinadi
    
    %% 4. Surge pricing (dynamic narx)
    S1->>Redis: GET surge:restaurant:{id}
    Redis-->>S1: Koeffitsient (1.0 - 2.0)
    
    Note over S1: deliveryFee = 15000 × multiplier
    
    %% 5. Buyurtmani saqlash
    S1->>DB: INSERT INTO Order<br/>(status=CONFIRMED, totalAmount, deliveryFee)
    DB-->>S1: Order yaratildi (UUID)
    
    Note over S1: Buyurtma saqlandi.<br/>Endi hodisalarni tarqatish:
    
    %% 6. Parallel hodisalar
    par Parallel Event Propagation
        %% Redis Pub/Sub - Asinxron
        S1->>Redis: PUBLISH order.events<br/>{type: 'order_created', orderId, data}
        Note over Redis: Pub/Sub kanal
        
        %% Socket.io - Real-time
        S1->>Socket: EMIT 'order:new'<br/>room: restaurant:{restaurantId}
        Note over Socket: Restoran egasiga<br/>real-time xabar
        
        %% Bildirishnoma saqlash
        S1->>DB: INSERT INTO Notification<br/>{userId: ownerId, type: 'NEW_ORDER'}
    end
    
    %% 7. Javob mijozga
    S1-->>Client: 201 Created<br/>{order: {id, status, totalAmount, eta}}
    deactivate S1
    
    Note over Redis,S2: ASINXRON ANALYTICS YO'LI
    
    %% 8. Server 2 hodisani qabul qiladi
    Redis->>S2: redis_subscriber<br/>'order_created' hodisasini qabul qildi
    activate S2
    
    S2->>S2: StatsService.recordEvent()
    
    %% 9. Analytics DB ga yozish
    S2->>DB: INSERT INTO order_event<br/>(analytics database)
    DB-->>S2: Saqlandi
    
    deactivate S2
    
    Note over Client,S2: ✅ Buyurtma yaratildi va<br/>barcha tizimlar xabardor qilindi
```

## PlantUML Versiyasi (Alternativ)

```plantuml
@startuml
title Buyurtma Yaratish Jarayoni - DeliverEat

actor "Mijoz\n(Browser)" as Client
participant "Server 1\n(Express/Node.js)" as S1
database "PostgreSQL" as DB
queue "Redis\n(Cache & Pub/Sub)" as Redis
participant "Server 2\n(FastAPI/Python)" as S2
actor "Restoran Egasi\n(Socket.io)" as Restaurant

== BUYURTMA YARATISH ==

Client -> S1: POST /api/orders\n{restaurantId, addressId, items[]}
activate S1

S1 -> DB: Restoranni tekshirish\nSELECT * FROM Restaurant\nWHERE id=? AND status='OPEN'
DB --> S1: Restaurant ma'lumotlari

alt Restoran yopiq
    S1 --> Client: 400 Bad Request\n"Restoran yopiq"
end

S1 -> DB: Menu narxlarini olish\n(Haqiqiy narxlar serverdan!)
DB --> S1: MenuItem[] (narxlar bilan)

S1 -> Redis: Surge pricing koeffitsientini olish\nGET surge:restaurant:{id}
Redis --> S1: multiplier (1.0-2.0)

note over S1
  Hisoblash:
  deliveryFee = 15000 × multiplier
  totalAmount = itemsTotal + deliveryFee
end note

S1 -> DB: Buyurtmani saqlash\nINSERT INTO Order\n(status=CONFIRMED)
DB --> S1: Order UUID

note over S1
  ✅ Buyurtma yaratildi
  Endi hodisalarni tarqatish
end note

== PARALLEL HODISALAR ==

par Asinxron tarqatish
    S1 -> Redis: PUBLISH order.events\n{type: 'order_created',\norderId, data}
    note over Redis: Pub/Sub kanal
else Real-time bildirishnoma
    S1 -> Restaurant: Socket.io EMIT\nroom: restaurant:{id}\nevent: 'order:new'
    note over Restaurant: Restoran egasiga\nreal-time xabar
else Bildirishnoma saqlash
    S1 -> DB: INSERT Notification\n{userId, type: 'NEW_ORDER'}
end

S1 --> Client: 201 Created\n{order: {id, status, totalAmount}}
deactivate S1

== ASINXRON ANALYTICS ==

Redis -> S2: redis_subscriber.on_message()\n'order_created' hodisasi
activate S2

S2 -> S2: StatsService.recordEvent()

S2 -> DB: Analytics DB ga yozish\nINSERT INTO order_event
DB --> S2: ✅ Saqlandi

deactivate S2

note over Client, S2
  ✅ Buyurtma to'liq qayta ishlandi
  ✅ Barcha tizimlar xabardor qilindi
  ✅ Analytics yozib olindi
end note

@enduml
```

## Batafsil Tushuntirish

### 1️⃣ Buyurtma Yuborish (Client → Server 1)
Mijoz `POST /api/orders` so'rovini yuboradi:
```json
{
  "restaurantId": "uuid-123",
  "addressId": "uuid-456",
  "items": [
    {"menuItemId": "uuid-789", "quantity": 2}
  ]
}
```

### 2️⃣ Restoran va Menu Tekshiruvi (Server 1 → PostgreSQL)
- Restoran `OPEN` statusida ekanligini tekshiradi
- Menu itemlarni va **haqiqiy narxlarni** database dan oladi
- ⚠️ **Xavfsizlik**: Narxlar hech qachon clientdan qabul qilinmaydi (price tampering xujumidan himoya)

### 3️⃣ Surge Pricing (Server 1 → Redis)
- Redis cache dan surge koeffitsientini oladi
- `deliveryFee = 15000 × multiplier` (1.0 - 2.0)
- Agar kurierlar kam bo'lsa, narx oshadi

### 4️⃣ Buyurtmani Saqlash (Server 1 → PostgreSQL)
```sql
INSERT INTO Order (
  customerId, restaurantId, addressId, 
  status, totalAmount, deliveryFee
) VALUES (?, ?, ?, 'CONFIRMED', ?, ?);
```

### 5️⃣ Parallel Hodisalar (3 ta bir vaqtda)

#### A. Redis Pub/Sub - Asinxron
```javascript
await redisService.publish('order.events', {
  type: 'order_created',
  orderId: order.id,
  restaurantId,
  totalAmount
});
```
→ Server 2 bu hodisani eshitadi va analytics DB ga yozadi

#### B. Socket.io - Real-time
```javascript
getIO().to(`restaurant:${restaurantId}`).emit('order:new', {
  orderId: order.id,
  customerName,
  totalAmount
});
```
→ Restoran egasining sahifasida darhol yangi buyurtma paydo bo'ladi

#### C. Notification - Database
```javascript
await prisma.notification.create({
  data: {
    userId: restaurant.ownerId,
    type: 'NEW_ORDER',
    orderId: order.id
  }
});
```
→ Restoran egasi keyinroq bildirishnomalar ro'yxatida ko'radi

### 6️⃣ Server 2 - Analytics (Asinxron)
Server 2 ning `redis_subscriber` bu hodisani qabul qiladi:
```python
async def on_message(message):
    data = json.loads(message['data'])
    if data['type'] == 'order_created':
        await stats_service.recordEvent(
            event_type='order_created',
            order_id=data['orderId'],
            restaurant_id=data['restaurantId']
        )
```

## Qanday Foydalanish

### Mermaid (Tavsiya etiladi)
1. Kodni `mermaid` blokidan ko'chirib oling
2. Quyidagi joylarga qo'ying:
   - **Mermaid Live Editor**: https://mermaid.live
   - **GitHub/GitLab** - markdown faylda avtomatik render qiladi
   - **VS Code** - Mermaid Preview extension o'rnating
   - **Notion, Obsidian** - mermaid bloklarini qo'llab-quvvatlaydi

### PlantUML
1. Kodni `plantuml` blokidan ko'chirib oling
2. Quyidagi joylarga qo'ying:
   - **PlantUML Online**: http://www.plantuml.com/plantuml
   - **IntelliJ IDEA** - PlantUML plugin
   - PNG/SVG sifatida export qiling

## Asosiy Afzalliklar

| Xususiyat | Tushuntirish |
|-----------|--------------|
| **Asinxron Analytics** | Server 2 sekin ishlasa ham, Server 1 bloklanmaydi |
| **Real-time Notification** | Socket.io orqali restoran darhol xabardor bo'ladi |
| **Xavfsizlik** | Narxlar clientdan emas, database dan olinadi |
| **Surge Pricing** | Redis cache orqali tez hisoblash |
| **Parallel Processing** | 3 ta hodisa bir vaqtda bajariladi |
| **Loose Coupling** | Server 1 va Server 2 bir-biriga bog'liq emas (Redis Pub/Sub orqali) |

## Kod Misollari

### Server 1 - Order Controller (order.controller.ts)
```typescript
export const createOrder = async (req: Request, res: Response) => {
  // 1. Restoranni tekshirish
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId, status: 'OPEN' }
  });
  
  // 2. Menu narxlarini olish
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds }, restaurantId }
  });
  
  // 3. Surge pricing
  const surgeMultiplier = await SurgeService.getSurgeMultiplier(restaurantId);
  const deliveryFee = Math.round(15000 * surgeMultiplier);
  
  // 4. Buyurtmani saqlash
  const order = await prisma.order.create({ data: { ...orderData } });
  
  // 5. Hodisalarni tarqatish (parallel)
  await Promise.all([
    redisService.publish('order.events', { type: 'order_created', orderId: order.id }),
    getIO().to(`restaurant:${restaurantId}`).emit('order:new', { orderId: order.id }),
    prisma.notification.create({ data: { userId: restaurant.ownerId, type: 'NEW_ORDER' } })
  ]);
  
  res.status(201).json({ order });
};
```

### Server 2 - Redis Subscriber (redis_subscriber.py)
```python
async def handle_order_created(data: dict):
    async with AsyncSessionLocal() as db:
        service = StatsService(db)
        await service.recordEvent(
            event_type='order_created',
            order_id=data['orderId'],
            restaurant_id=data['restaurantId'],
            total_amount=data['totalAmount']
        )
        await db.commit()
```

---

**✅ Bu diagram sizning presentatsiya va assignmentingiz uchun tayyor!**
