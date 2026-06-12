# Database Schema Diagram - DeliverEat

## Entity Relationship Diagram (ERD)

### Mermaid Versiyasi

```mermaid
erDiagram
    User ||--o{ Address : "has many"
    User ||--o{ Order : "places (as customer)"
    User ||--o| Restaurant : "owns"
    User ||--o| Courier : "is a"
    User ||--o{ Message : "sends"
    User ||--o{ Review : "writes"
    User ||--o{ Notification : "receives"
    
    Restaurant ||--o{ Category : "has many"
    Restaurant ||--o{ MenuItem : "has many"
    Restaurant ||--o{ Order : "receives"
    Restaurant ||--o{ Review : "receives"
    
    Category ||--o{ MenuItem : "contains"
    
    MenuItem ||--o{ OrderItem : "appears in"
    
    Order ||--o{ OrderItem : "contains"
    Order }o--|| Address : "delivered to"
    Order }o--o| Courier : "delivered by"
    Order ||--o{ Message : "has chat"
    Order ||--o{ Review : "can be reviewed"
    
    Courier ||--o{ Order : "delivers"
    Courier ||--o{ Review : "receives"
    
    User {
        uuid id PK
        string email UK
        string password
        string name
        string phone
        enum role "CUSTOMER|RESTAURANT_OWNER|COURIER|ADMIN"
        string avatar
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }
    
    Address {
        uuid id PK
        uuid userId FK
        string label
        string street
        string city
        float latitude
        float longitude
        boolean isDefault
    }
    
    Restaurant {
        uuid id PK
        uuid ownerId FK "UK"
        string name
        string description
        string address
        float latitude
        float longitude
        string phone
        string logo
        string coverImage
        enum status "OPEN|CLOSED|BUSY"
        float rating
        int ratingCount
        int totalOrders
        boolean isVerified
        datetime createdAt
        datetime updatedAt
    }
    
    Category {
        uuid id PK
        string name
        uuid restaurantId FK
    }
    
    MenuItem {
        uuid id PK
        uuid restaurantId FK
        uuid categoryId FK
        string name
        string description
        float price
        string image
        boolean isAvailable
        int preparationTime
    }
    
    Order {
        uuid id PK
        uuid customerId FK
        uuid restaurantId FK
        uuid addressId FK
        uuid courierId FK "nullable"
        enum status "CONFIRMED|ACCEPTED|PREPARING|READY|ON_THE_WAY|DELIVERED|CANCELLED"
        float totalAmount
        float deliveryFee
        string note
        int estimatedTime
        datetime createdAt
        datetime updatedAt
    }
    
    OrderItem {
        uuid id PK
        uuid orderId FK
        uuid menuItemId FK
        int quantity
        float price "snapshot at order time"
        string note
    }
    
    Courier {
        uuid id PK
        uuid userId FK "UK"
        string vehicleType
        enum status "OFFLINE|AVAILABLE|BUSY"
        float rating
        int totalDeliveries
    }
    
    Message {
        uuid id PK
        uuid orderId FK
        uuid senderId FK
        string content
        datetime createdAt
    }
    
    Review {
        uuid id PK
        uuid orderId FK
        uuid customerId FK
        uuid restaurantId FK "nullable"
        uuid courierId FK "nullable"
        int rating "1-5"
        string comment
        datetime createdAt
        datetime updatedAt
    }
    
    Notification {
        uuid id PK
        uuid userId FK
        string type "ORDER_STATUS|NEW_ORDER|PAYMENT|REVIEW"
        string title
        string message
        string data "JSON"
        boolean isRead
        datetime createdAt
    }
```

### Mermaid Versiyasi 2 (Soddalashtirilgan - Asosiy Jadvallargina)

```mermaid
erDiagram
    User ||--o{ Order : "customerId"
    User ||--o| Restaurant : "ownerId"
    User ||--o| Courier : "userId"
    User ||--o{ Address : "userId"
    
    Restaurant ||--o{ MenuItem : "restaurantId"
    Restaurant ||--o{ Order : "restaurantId"
    Restaurant ||--o{ Category : "restaurantId"
    
    Category ||--o{ MenuItem : "categoryId"
    
    Order ||--o{ OrderItem : "orderId"
    Order }o--|| Address : "addressId"
    Order }o--o| Courier : "courierId"
    
    MenuItem ||--o{ OrderItem : "menuItemId"
    
    User {
        uuid id
        string email
        string name
        enum role
    }
    
    Restaurant {
        uuid id
        uuid ownerId
        string name
        enum status
        float rating
    }
    
    MenuItem {
        uuid id
        uuid restaurantId
        uuid categoryId
        string name
        float price
        boolean isAvailable
    }
    
    Order {
        uuid id
        uuid customerId
        uuid restaurantId
        uuid addressId
        uuid courierId
        enum status
        float totalAmount
        float deliveryFee
    }
    
    OrderItem {
        uuid id
        uuid orderId
        uuid menuItemId
        int quantity
        float price
    }
    
    Courier {
        uuid id
        uuid userId
        enum status
        float rating
    }
    
    Address {
        uuid id
        uuid userId
        string street
        string city
        float latitude
        float longitude
    }
    
    Category {
        uuid id
        string name
        uuid restaurantId
    }
```

## PlantUML Versiyasi (Class Diagram Format)

```plantuml
@startuml DeliverEat Database Schema

!define table(x) class x << (T,#FFAAAA) >>
!define primary_key(x) <u>x</u>
!define foreign_key(x) #x
!define unique(x) {unique} x

hide methods
hide stereotypes

' ═══════════════════════════════════════════════════════════
' USERS & AUTH
' ═══════════════════════════════════════════════════════════

table(User) {
  primary_key(id): UUID
  unique(email): String
  password: String
  name: String
  phone: String
  role: Enum
  avatar: String
  isActive: Boolean
  createdAt: DateTime
  updatedAt: DateTime
}

table(Address) {
  primary_key(id): UUID
  foreign_key(userId): UUID
  label: String
  street: String
  city: String
  latitude: Float
  longitude: Float
  isDefault: Boolean
}

' ═══════════════════════════════════════════════════════════
' RESTAURANT
' ═══════════════════════════════════════════════════════════

table(Restaurant) {
  primary_key(id): UUID
  foreign_key(ownerId): UUID {unique}
  name: String
  description: String
  address: String
  latitude: Float
  longitude: Float
  phone: String
  logo: String
  coverImage: String
  status: Enum
  rating: Float
  ratingCount: Int
  totalOrders: Int
  isVerified: Boolean
  createdAt: DateTime
  updatedAt: DateTime
}

table(Category) {
  primary_key(id): UUID
  foreign_key(restaurantId): UUID
  name: String
}

table(MenuItem) {
  primary_key(id): UUID
  foreign_key(restaurantId): UUID
  foreign_key(categoryId): UUID
  name: String
  description: String
  price: Float
  image: String
  isAvailable: Boolean
  preparationTime: Int
}

' ═══════════════════════════════════════════════════════════
' ORDERS
' ═══════════════════════════════════════════════════════════

table(Order) {
  primary_key(id): UUID
  foreign_key(customerId): UUID
  foreign_key(restaurantId): UUID
  foreign_key(addressId): UUID
  foreign_key(courierId): UUID (nullable)
  status: Enum
  totalAmount: Float
  deliveryFee: Float
  note: String
  estimatedTime: Int
  createdAt: DateTime
  updatedAt: DateTime
}

table(OrderItem) {
  primary_key(id): UUID
  foreign_key(orderId): UUID
  foreign_key(menuItemId): UUID
  quantity: Int
  price: Float
  note: String
}

' ═══════════════════════════════════════════════════════════
' COURIER
' ═══════════════════════════════════════════════════════════

table(Courier) {
  primary_key(id): UUID
  foreign_key(userId): UUID {unique}
  vehicleType: String
  status: Enum
  rating: Float
  totalDeliveries: Int
}

' ═══════════════════════════════════════════════════════════
' COMMUNICATION
' ═══════════════════════════════════════════════════════════

table(Message) {
  primary_key(id): UUID
  foreign_key(orderId): UUID
  foreign_key(senderId): UUID
  content: String
  createdAt: DateTime
}

table(Review) {
  primary_key(id): UUID
  foreign_key(orderId): UUID
  foreign_key(customerId): UUID
  foreign_key(restaurantId): UUID (nullable)
  foreign_key(courierId): UUID (nullable)
  rating: Int (1-5)
  comment: String
  createdAt: DateTime
  updatedAt: DateTime
}

table(Notification) {
  primary_key(id): UUID
  foreign_key(userId): UUID
  type: String
  title: String
  message: String
  data: String (JSON)
  isRead: Boolean
  createdAt: DateTime
}

' ═══════════════════════════════════════════════════════════
' RELATIONSHIPS
' ═══════════════════════════════════════════════════════════

User "1" -- "0..*" Address : has
User "1" -- "0..*" Order : places
User "1" -- "0..1" Restaurant : owns
User "1" -- "0..1" Courier : is
User "1" -- "0..*" Message : sends
User "1" -- "0..*" Review : writes
User "1" -- "0..*" Notification : receives

Restaurant "1" -- "0..*" Category : contains
Restaurant "1" -- "0..*" MenuItem : offers
Restaurant "1" -- "0..*" Order : receives
Restaurant "1" -- "0..*" Review : has

Category "1" -- "0..*" MenuItem : groups

MenuItem "1" -- "0..*" OrderItem : appears_in

Order "1" -- "0..*" OrderItem : contains
Order "0..*" -- "1" Address : delivered_to
Order "0..*" -- "0..1" Courier : delivered_by
Order "1" -- "0..*" Message : has
Order "1" -- "0..*" Review : can_be_reviewed

Courier "1" -- "0..*" Order : delivers
Courier "1" -- "0..*" Review : receives

note right of User
  role: CUSTOMER | RESTAURANT_OWNER | COURIER | ADMIN
  Password hashed with bcrypt
  JWT authentication
end note

note right of Restaurant
  status: OPEN | CLOSED | BUSY
  rating calculated from reviews
  One owner per restaurant
end note

note right of Order
  status lifecycle:
  CONFIRMED → ACCEPTED → PREPARING
  → READY → ON_THE_WAY → DELIVERED
  or CANCELLED at any stage
end note

note right of OrderItem
  price is snapshot at order time
  prevents price manipulation
  if menu price changes later
end note

note right of Courier
  status: OFFLINE | AVAILABLE | BUSY
  Location stored in Redis:
  courier:{userId}:location
  {lat, lng, updatedAt}
end note

@enduml
```

## Jadvallar Tavsifi

### 👤 User (Foydalanuvchilar)
**Maqsad**: Barcha tizim foydalanuvchilarini saqlash (mijoz, restoran egasi, kuryer, admin)

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID | Primary Key |
| email | String | Unique, kirish uchun |
| password | String | bcrypt bilan hashlangan |
| name | String | To'liq ism |
| phone | String | Telefon raqam (nullable) |
| role | Enum | CUSTOMER, RESTAURANT_OWNER, COURIER, ADMIN |
| avatar | String | Profil rasmi URL (nullable) |
| isActive | Boolean | Akkount faol/o'chirilgan |
| createdAt | DateTime | Yaratilgan vaqt |
| updatedAt | DateTime | Oxirgi o'zgarish |

**Relationships**:
- `1:N` → Address (bir foydalanuvchi ko'p manzilga ega)
- `1:N` → Order (bir mijoz ko'p buyurtma beradi)
- `1:1` → Restaurant (restoran egasi faqat bitta restoran ochadi)
- `1:1` → Courier (kuryer profili)
- `1:N` → Message, Review, Notification

---

### 🏪 Restaurant (Restoranlar)
**Maqsad**: Restoran ma'lumotlari va joylashuvi

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID | Primary Key |
| ownerId | UUID | Foreign Key → User (Unique) |
| name | String | Restoran nomi |
| description | String | Tavsif (nullable) |
| address | String | Manzil matni |
| latitude | Float | GPS kenglik |
| longitude | Float | GPS uzunlik |
| phone | String | Aloqa raqami |
| logo | String | Logo URL (nullable) |
| coverImage | String | Bosh rasm URL (nullable) |
| status | Enum | OPEN, CLOSED, BUSY |
| rating | Float | O'rtacha baho (0-5) |
| ratingCount | Int | Nechta baholangan |
| totalOrders | Int | Jami buyurtmalar soni |
| isVerified | Boolean | Tasdiqlangan restoran |

**Relationships**:
- `N:1` → User (ownerId)
- `1:N` → Category
- `1:N` → MenuItem
- `1:N` → Order
- `1:N` → Review

---

### 🍕 MenuItem (Menu Mahsulotlari)
**Maqsad**: Restoran menyu itemlari

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID | Primary Key |
| restaurantId | UUID | Foreign Key → Restaurant |
| categoryId | UUID | Foreign Key → Category (nullable) |
| name | String | Mahsulot nomi |
| description | String | Tavsif (nullable) |
| price | Float | Narx (so'm) |
| image | String | Rasm URL (nullable) |
| isAvailable | Boolean | Mavjud/tugagan |
| preparationTime | Int | Tayyorlash vaqti (daqiqa) |

**Relationships**:
- `N:1` → Restaurant
- `N:1` → Category
- `1:N` → OrderItem

---

### 📦 Order (Buyurtmalar)
**Maqsad**: Mijoz buyurtmalari

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID | Primary Key |
| customerId | UUID | Foreign Key → User |
| restaurantId | UUID | Foreign Key → Restaurant |
| addressId | UUID | Foreign Key → Address |
| courierId | UUID | Foreign Key → Courier (nullable) |
| status | Enum | CONFIRMED, ACCEPTED, PREPARING, READY, ON_THE_WAY, DELIVERED, CANCELLED |
| totalAmount | Float | Jami summa |
| deliveryFee | Float | Yetkazish narxi |
| note | String | Izoh (nullable) |
| estimatedTime | Int | Taxminiy vaqt (daqiqa) |

**Relationships**:
- `N:1` → User (customer)
- `N:1` → Restaurant
- `N:1` → Address
- `N:1` → Courier (nullable)
- `1:N` → OrderItem
- `1:N` → Message
- `1:N` → Review

**Status Lifecycle**:
```
CONFIRMED → ACCEPTED → PREPARING → READY → ON_THE_WAY → DELIVERED
     ↓           ↓           ↓          ↓         ↓
                      CANCELLED (istalgan bosqichda)
```

---

### 🛒 OrderItem (Buyurtma Itemlari)
**Maqsad**: Har bir buyurtmadagi mahsulotlar ro'yxati

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID | Primary Key |
| orderId | UUID | Foreign Key → Order |
| menuItemId | UUID | Foreign Key → MenuItem |
| quantity | Int | Miqdori |
| price | Float | **Buyurtma vaqtidagi narx** (snapshot) |
| note | String | Maxsus talab (nullable) |

**⚠️ Muhim**: `price` ustuni menu itemning buyurtma berilgan paytdagi narxini saqlaydi. Agar keyinroq menu narxi o'zgarse, mavjud buyurtmalar ta'sir qilmaydi (price tampering himoyasi).

**Relationships**:
- `N:1` → Order
- `N:1` → MenuItem

---

### 🚴 Courier (Kurierlar)
**Maqsad**: Kuryer profili va statistikasi

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID | Primary Key |
| userId | UUID | Foreign Key → User (Unique) |
| vehicleType | String | Transport turi (bike, car, motorcycle) |
| status | Enum | OFFLINE, AVAILABLE, BUSY |
| rating | Float | O'rtacha baho (0-5) |
| totalDeliveries | Int | Jami yetkazilgan buyurtmalar |

**GPS Joylashuv**: Redis da saqlanadi
```
Key: courier:{userId}:location
Value: {lat: 41.2995, lng: 69.2401, updatedAt: 1234567890}
TTL: 300 sekund (5 daqiqa)
```

**Relationships**:
- `1:1` → User
- `1:N` → Order
- `1:N` → Review

---

### 📍 Address (Manzillar)
**Maqsad**: Foydalanuvchi manzillari

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID | Primary Key |
| userId | UUID | Foreign Key → User |
| label | String | "Uy", "Ish", "Ota-ona" |
| street | String | Ko'cha, bino raqami |
| city | String | Shahar |
| latitude | Float | GPS kenglik |
| longitude | Float | GPS uzunlik |
| isDefault | Boolean | Default manzil |

**Relationships**:
- `N:1` → User
- `1:N` → Order

---

### 📂 Category (Kategoriyalar)
**Maqsad**: Restoran menu kategoriyalari

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID | Primary Key |
| restaurantId | UUID | Foreign Key → Restaurant |
| name | String | "Ichimliklar", "Salatlar", "Asosiy taomlar" |

**Relationships**:
- `N:1` → Restaurant
- `1:N` → MenuItem

---

### 💬 Message (Xabarlar)
**Maqsad**: Buyurtma bo'yicha chat (mijoz ↔ restoran/kuryer)

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID | Primary Key |
| orderId | UUID | Foreign Key → Order |
| senderId | UUID | Foreign Key → User |
| content | String | Xabar matni |
| createdAt | DateTime | Yuborilgan vaqt |

**Relationships**:
- `N:1` → Order
- `N:1` → User (sender)

---

### ⭐ Review (Baholar va Sharhlar)
**Maqsad**: Restoran va kuryer baholash

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID | Primary Key |
| orderId | UUID | Foreign Key → Order |
| customerId | UUID | Foreign Key → User |
| restaurantId | UUID | Foreign Key → Restaurant (nullable) |
| courierId | UUID | Foreign Key → Courier (nullable) |
| rating | Int | 1-5 yulduz |
| comment | String | Sharh (nullable) |

**Constraints**:
- `UNIQUE(orderId, restaurantId)` - har bir buyurtma uchun faqat 1 restoran bahosi
- `UNIQUE(orderId, courierId)` - har bir buyurtma uchun faqat 1 kuryer bahosi

**Relationships**:
- `N:1` → Order
- `N:1` → User (customer)
- `N:1` → Restaurant (nullable)
- `N:1` → Courier (nullable)

---

### 🔔 Notification (Bildirishnomalar)
**Maqsad**: Push notifications va xabarlar

| Ustun | Tur | Tavsif |
|-------|-----|--------|
| id | UUID | Primary Key |
| userId | UUID | Foreign Key → User |
| type | String | ORDER_STATUS, NEW_ORDER, PAYMENT, REVIEW |
| title | String | Sarlavha |
| message | String | Xabar matni |
| data | String | Qo'shimcha JSON ma'lumot (nullable) |
| isRead | Boolean | O'qilgan/o'qilmagan |
| createdAt | DateTime | Yaratilgan vaqt |

**Relationships**:
- `N:1` → User

---

## Indekslar (Query Optimallashtirish)

```sql
-- Order queries
CREATE INDEX idx_orders_customer ON orders(customerId, createdAt DESC);
CREATE INDEX idx_orders_restaurant ON orders(restaurantId, status);
CREATE INDEX idx_orders_courier ON orders(courierId, status);

-- MenuItem availability
CREATE INDEX idx_menu_items_availability ON menu_items(restaurantId, isAvailable);

-- Notifications unread
CREATE INDEX idx_notifications_unread ON notifications(userId, isRead, createdAt DESC);

-- Messages timeline
CREATE INDEX idx_messages_order ON messages(orderId, createdAt DESC);

-- Reviews lookup
CREATE INDEX idx_reviews_restaurant ON reviews(restaurantId);
CREATE INDEX idx_reviews_courier ON reviews(courierId);
```

---

## Foreign Key Constraints (Ma'lumot Yaxlitligi)

| Child Table | Column | Parent Table | On Delete |
|-------------|--------|--------------|-----------|
| Address | userId | User | CASCADE |
| Restaurant | ownerId | User | - |
| Category | restaurantId | Restaurant | CASCADE |
| MenuItem | restaurantId | Restaurant | CASCADE |
| MenuItem | categoryId | Category | SET NULL |
| Order | customerId | User | - |
| Order | restaurantId | Restaurant | - |
| Order | addressId | Address | - |
| Order | courierId | Courier | SET NULL |
| OrderItem | orderId | Order | CASCADE |
| OrderItem | menuItemId | MenuItem | - |
| Courier | userId | User | - |
| Message | orderId | Order | CASCADE |
| Message | senderId | User | - |
| Review | orderId | Order | CASCADE |
| Review | customerId | User | - |
| Review | restaurantId | Restaurant | SET NULL |
| Review | courierId | Courier | SET NULL |
| Notification | userId | User | CASCADE |

**Cascade Rules**:
- `CASCADE` - Ota qator o'chirilsa, bola qatorlar ham o'chiriladi
- `SET NULL` - Ota qator o'chirilsa, bola qatorning FK si NULL bo'ladi
- `-` (restrict) - Ota qator o'chirilmaydi, agar bola qatorlar mavjud bo'lsa

---

## Query Misollari

### 1. Restoran menu'sini olish (kategoriyalar bilan)
```sql
SELECT 
  c.name as category_name,
  m.name as item_name,
  m.price,
  m.isAvailable
FROM categories c
LEFT JOIN menu_items m ON m.categoryId = c.id
WHERE c.restaurantId = 'uuid-123'
ORDER BY c.name, m.name;
```

### 2. Mijoz buyurtmalarini olish (restaurant va status bilan)
```sql
SELECT 
  o.id,
  o.status,
  o.totalAmount,
  r.name as restaurant_name,
  o.createdAt
FROM orders o
JOIN restaurants r ON r.id = o.restaurantId
WHERE o.customerId = 'uuid-456'
ORDER BY o.createdAt DESC;
```

### 3. Restoran rating'ini yangilash
```sql
UPDATE restaurants
SET 
  rating = (SELECT AVG(rating) FROM reviews WHERE restaurantId = 'uuid-789'),
  ratingCount = (SELECT COUNT(*) FROM reviews WHERE restaurantId = 'uuid-789')
WHERE id = 'uuid-789';
```

### 4. Tayyor buyurtmalarni topish (kuryer uchun, 10km radius)
```sql
SELECT 
  o.id,
  o.totalAmount,
  r.name as restaurant_name,
  r.latitude,
  r.longitude,
  -- Haversine formula - distance hisoblash
  (6371 * acos(
    cos(radians(41.2995)) * cos(radians(r.latitude)) * 
    cos(radians(r.longitude) - radians(69.2401)) + 
    sin(radians(41.2995)) * sin(radians(r.latitude))
  )) as distance_km
FROM orders o
JOIN restaurants r ON r.id = o.restaurantId
WHERE o.status = 'READY'
  AND o.courierId IS NULL
HAVING distance_km <= 10
ORDER BY distance_km ASC;
```

---

## Diagrammani Ko'rish

### Mermaid
1. Kodni `mermaid` blokidan nusxa oling
2. https://mermaid.live ga tashlang
3. Yoki VS Code da Mermaid Preview extension o'rnating

### PlantUML
1. Kodni `plantuml` blokidan nusxa oling
2. http://www.plantuml.com/plantuml ga tashlang
3. PNG/SVG formatda yuklab oling

---

**✅ Database Schema to'liq tayyor!**
