# DeliverEat Backend Development - Complete Implementation Guide

## Project Overview
You are building the backend for DeliverEat, a real-time food delivery platform. The system has TWO backend servers:
- **Server 1 (Express/Node.js)** - REST API, Socket.io, operational database
- **Server 2 (FastAPI/Python)** - GraphQL API, analytics, background jobs

## Tech Stack
### Server 1 (Express/Node.js - Port 5000)
- Express.js + TypeScript
- Prisma ORM + PostgreSQL
- Socket.io for real-time
- Redis for cache & Pub/Sub
- JWT authentication
- bcrypt for passwords

### Server 2 (FastAPI/Python - Port 8000)
- FastAPI + Python 3.11
- Strawberry GraphQL
- SQLAlchemy (async)
- Redis subscriber
- PostgreSQL for analytics

## Database Schema (PostgreSQL)
Already exists in Prisma schema. Key tables:
- User (id, email, password, name, role, phone)
- Restaurant (id, ownerId, name, address, lat, lng, status, rating)
- MenuItem (id, restaurantId, categoryId, name, price, isAvailable)
- Order (id, customerId, restaurantId, addressId, courierId, status, totalAmount)
- OrderItem (id, orderId, menuItemId, quantity, price)
- Courier (id, userId, vehicleType, status, rating)
- Address (id, userId, street, city, latitude, longitude)
- Category (id, restaurantId, name)
- Review (id, orderId, customerId, rating, comment)
- Notification (id, userId, type, message, isRead)

---

# SERVER 1 - EXPRESS API ENDPOINTS (Complete List)


## 1. Authentication Endpoints (/api/auth)

### POST /api/auth/register
**Purpose**: Register new user (customer, restaurant owner, or courier)
**Request Body**:
```json
{
  "name": "string",
  "email": "string",
  "password": "string (min 6 chars)",
  "phone": "string (optional)",
  "role": "CUSTOMER | RESTAURANT_OWNER | COURIER"
}
```
**Response**: { user, accessToken, refreshToken }
**Logic**:
- Validate email format, password length
- Check email doesn't exist
- Hash password with bcrypt (12 rounds)
- Create user in database
- Generate JWT tokens (access: 15min, refresh: 7days)
- Store refresh token in Redis
- Return user + tokens

### POST /api/auth/login
**Request Body**: { email, password }
**Response**: { user, accessToken, refreshToken }
**Logic**:
- Find user by email
- Compare password with bcrypt
- Generate new tokens
- Store refresh token in Redis
- Return user + tokens

### POST /api/auth/refresh
**Request Body**: { refreshToken }
**Response**: { accessToken, refreshToken }

### POST /api/auth/logout
**Headers**: Authorization: Bearer {token}
**Logic**:
- Blacklist access token in Redis
- Delete refresh token from Redis

### GET /api/auth/me
**Headers**: Authorization: Bearer {token}
**Response**: { user (with addresses) }

---

## 2. Restaurant Endpoints (/api/restaurants)

### GET /api/restaurants
**Query Params**: page, limit, search, lat, lng, radius
**Response**: { restaurants: [], total, page, limit }
**Logic**:
- Search by name (ILIKE query)
- Filter by distance if lat/lng provided (Haversine formula)
- Return only OPEN restaurants
- Include rating, totalOrders


### GET /api/restaurants/:id
**Response**: { restaurant (with categories and menu items) }

### GET /api/restaurants/my
**Auth**: RESTAURANT_OWNER only
**Response**: { restaurant }

### POST /api/restaurants
**Auth**: RESTAURANT_OWNER only
**Request Body**:
```json
{
  "name": "string",
  "description": "string",
  "address": "string",
  "latitude": number,
  "longitude": number,
  "phone": "string"
}
```
**Logic**:
- Check user doesn't already own a restaurant
- Create restaurant linked to ownerId
- Return created restaurant

### PATCH /api/restaurants/:id/status
**Auth**: RESTAURANT_OWNER only
**Request Body**: { status: "OPEN | CLOSED | BUSY" }
**Logic**:
- Verify owner owns this restaurant
- Update status
- Broadcast to Socket.io (restaurant room)

---

## 3. Menu Endpoints (/api/menu)

### GET /api/menu/restaurants/:restaurantId
**Response**: { categories: [ { name, menuItems: [] } ] }

### POST /api/menu/items
**Auth**: RESTAURANT_OWNER only
**Request Body**:
```json
{
  "restaurantId": "uuid",
  "categoryId": "uuid",
  "name": "string",
  "description": "string",
  "price": number,
  "image": "string (URL)",
  "preparationTime": number
}
```

### PATCH /api/menu/items/:id
**Auth**: RESTAURANT_OWNER only
**Request Body**: { name?, price?, isAvailable?, ... }

### DELETE /api/menu/items/:id
**Auth**: RESTAURANT_OWNER only

### POST /api/menu/categories
**Auth**: RESTAURANT_OWNER only
**Request Body**: { restaurantId, name }

---

## 4. Order Endpoints (/api/orders)

### POST /api/orders
**Auth**: CUSTOMER only
**Request Body**:
```json
{
  "restaurantId": "uuid",
  "addressId": "uuid",
  "items": [
    { "menuItemId": "uuid", "quantity": number, "note": "string" }
  ],
  "note": "string"
}
```
**Logic** (CRITICAL - Price Security):
1. Validate restaurant is OPEN
2. Fetch menu items from DB (NEVER trust client prices)
3. Calculate items total using DB prices
4. Get surge multiplier from Redis: `surge:restaurant:{id}`
5. Calculate delivery fee: 15000 * surgeMultiplier
6. Create order with status CONFIRMED
7. Create OrderItems with DB prices (snapshot)
8. **Parallel events**:
   - Redis PUBLISH to `order.events` channel
   - Socket.io EMIT to `restaurant:{restaurantId}` room
   - Create notification for restaurant owner
9. Return order with totalAmount, deliveryFee, estimatedTime

### GET /api/orders
**Auth**: Required
**Query**: status, page, limit
**Response**: Orders based on user role
- CUSTOMER: their orders only
- RESTAURANT_OWNER: orders for their restaurant
- COURIER: assigned orders only

### GET /api/orders/:id
**Auth**: Required
**Response**: Order details (verify ownership)
**Logic**:
- Customer can see their order
- Restaurant owner can see orders for their restaurant
- Courier can see assigned orders

### PATCH /api/orders/:id/accept
**Auth**: RESTAURANT_OWNER only
**Logic**:
- Verify order belongs to owner's restaurant
- Change status CONFIRMED → ACCEPTED
- Socket.io emit to customer

### PATCH /api/orders/:id/ready
**Auth**: RESTAURANT_OWNER only
**Logic**:
- Change status PREPARING → READY
- Socket.io emit to courier pool (`all-zones` room)


### PATCH /api/orders/:id/pickup
**Auth**: COURIER only
**Logic** (CRITICAL - Race Condition Prevention):
```typescript
const result = await prisma.order.updateMany({
  where: {
    id: orderId,
    status: 'READY',
    courierId: null  // Atomic check
  },
  data: {
    status: 'ON_THE_WAY',
    courierId: courier.id
  }
});

if (result.count === 0) {
  return 409 Conflict "Order already taken"
}
```
- Change status READY → ON_THE_WAY
- Socket.io emit to customer

### PATCH /api/orders/:id/deliver
**Auth**: COURIER only
**Logic**:
- Verify courier is assigned to this order
- Change status ON_THE_WAY → DELIVERED
- **Trigger analytics**:
  - Redis PUBLISH to `order.events`
  - HTTP POST to Server 2: `/internal/order-completed`
- Socket.io emit to customer

### PATCH /api/orders/:id/cancel
**Auth**: CUSTOMER or RESTAURANT_OWNER
**Logic**:
- Check status not already DELIVERED
- Change to CANCELLED
- Notify relevant parties via Socket.io

---

## 5. Courier Endpoints (/api/couriers)

### POST /api/couriers/profile
**Auth**: COURIER role
**Request Body**: { vehicleType: "bike | car | motorcycle" }
**Logic**:
- Create courier profile linked to userId
- Set status to OFFLINE

### PATCH /api/couriers/status
**Auth**: COURIER only
**Request Body**: { status: "OFFLINE | AVAILABLE | BUSY" }

### GET /api/couriers/available-orders
**Auth**: COURIER only
**Query**: lat, lng, radius (default 50km)
**Response**: Orders with status READY within radius
**Logic**:
```sql
SELECT o.*, r.name, r.latitude, r.longitude,
  (6371 * acos(cos(radians(?)) * cos(radians(r.latitude)) * 
   cos(radians(r.longitude) - radians(?)) + 
   sin(radians(?)) * sin(radians(r.latitude)))) AS distance
FROM orders o
JOIN restaurants r ON r.id = o.restaurantId
WHERE o.status = 'READY' AND o.courierId IS NULL
HAVING distance <= ?
ORDER BY distance ASC
```


### POST /api/couriers/location
**Auth**: COURIER only
**Request Body**: { latitude, longitude }
**Logic**:
- Store in Redis: `courier:{userId}:location` with TTL 300s
- Broadcast to order room if courier has active order

### GET /api/couriers/my-orders
**Auth**: COURIER only
**Response**: Orders where courierId = courier.id

---

## 6. Address Endpoints (/api/addresses)

### GET /api/addresses
**Auth**: Required
**Response**: User's addresses

### POST /api/addresses
**Auth**: Required
**Request Body**:
```json
{
  "label": "Home | Work | Other",
  "street": "string",
  "city": "string",
  "latitude": number,
  "longitude": number,
  "isDefault": boolean
}
```
**Logic**:
- If isDefault=true, set all other addresses to false first
- Create address

### PATCH /api/addresses/:id
**Auth**: Required (verify ownership)

### DELETE /api/addresses/:id
**Auth**: Required (verify ownership)

---

## 7. Review Endpoints (/api/reviews)

### POST /api/reviews
**Auth**: CUSTOMER only
**Request Body**:
```json
{
  "orderId": "uuid",
  "restaurantRating": number (1-5),
  "restaurantComment": "string",
  "courierRating": number (1-5),
  "courierComment": "string"
}
```
**Logic**:
- Verify order belongs to customer
- Verify order status is DELIVERED
- Create review(s)
- Update restaurant.rating (calculate average)
- Update courier.rating (calculate average)

### GET /api/reviews/restaurant/:restaurantId
**Response**: Reviews for restaurant

---

## 8. Notification Endpoints (/api/notifications)

### GET /api/notifications
**Auth**: Required
**Query**: page, limit, isRead
**Response**: User's notifications

### PATCH /api/notifications/:id/read
**Auth**: Required
**Logic**: Mark as read

### PATCH /api/notifications/read-all
**Auth**: Required
**Logic**: Mark all user's notifications as read

---

# SOCKET.IO EVENTS (Server 1)

## Server-to-Client Events

### 'order:new' (Room: restaurant:{restaurantId})
**Payload**: { orderId, customerName, totalAmount, items }
**Triggered**: When new order created

### 'order:status' (Room: order:{orderId})
**Payload**: { orderId, status, estimatedTime }
**Triggered**: When order status changes

### 'courier:moved' (Room: order:{orderId})
**Payload**: { orderId, latitude, longitude }
**Triggered**: When courier updates location

### 'surge:updated' (Room: all-zones)
**Payload**: { restaurantId, multiplier }
**Triggered**: When surge pricing changes

## Client-to-Server Events

### 'join:order'
**Payload**: { orderId }
**Auth**: Verify user owns/assigned to order
**Action**: socket.join(`order:${orderId}`)

### 'join:restaurant'
**Payload**: { restaurantId }
**Auth**: Verify user owns restaurant
**Action**: socket.join(`restaurant:${restaurantId}`)

### 'join:all-zones'
**Auth**: Verify user is COURIER
**Action**: socket.join('all-zones')

### 'courier:update-location'
**Payload**: { latitude, longitude }
**Auth**: COURIER only
**Action**: 
- Store in Redis
- Broadcast to active order room

---

# REDIS USAGE (Server 1)

## Cache Keys
- `surge:restaurant:{restaurantId}` → surge multiplier (1.0-2.0)
- `courier:{userId}:location` → { lat, lng, updatedAt } (TTL: 300s)
- `refresh:{userId}` → refresh token hash (TTL: 7 days)
- `blacklist:{accessToken}` → blacklisted token (TTL: token expiry)

## Pub/Sub Channels
- `order.events` → { type, orderId, restaurantId, ... }
  - Types: order_created, order_accepted, order_ready, order_delivered, order_cancelled

## Surge Pricing Calculation (Background Job)
Run every 5 minutes:
```typescript
async function calculateSurge() {
  const restaurants = await prisma.restaurant.findMany();
  
  for (const restaurant of restaurants) {
    const availableCouriers = await countAvailableCouriers(restaurant.id);
    const activeOrders = await countActiveOrders(restaurant.id);
    
    const ratio = activeOrders / Math.max(availableCouriers, 1);
    
    let multiplier = 1.0;
    if (ratio >= 2.0) multiplier = 2.0;
    else if (ratio >= 1.5) multiplier = 1.5;
    else if (ratio >= 1.0) multiplier = 1.2;
    
    await redisService.set(`surge:restaurant:${restaurant.id}`, multiplier, 3600);
    
    // Broadcast to all-zones room
    io.to('all-zones').emit('surge:updated', { restaurantId: restaurant.id, multiplier });
  }
}
```

---

# SERVER 2 - FASTAPI GRAPHQL API

## Purpose
- Analytics queries (restaurant stats, courier performance)
- Background event processing (Redis subscriber)
- Webhook endpoint for synchronous analytics

## GraphQL Schema

### Query: restaurantStats
**Args**: restaurantId: String!, days: Int = 30
**Returns**: RestaurantStatsType
```graphql
type RestaurantStatsType {
  totalRevenue: Float!
  totalOrders: Int!
  averageOrderValue: Float!
  completionRate: Float!
  averageRating: Float!
  topMenuItems: [MenuItemStat!]!
}
```


### Query: courierPerformance
**Args**: courierId: String!, days: Int = 30
**Returns**: CourierPerformanceType
```graphql
type CourierPerformanceType {
  totalDeliveries: Int!
  totalEarnings: Float!
  averageDeliveryTime: Float!
  rating: Float!
  acceptanceRate: Float!
}
```

### Query: burndownChart
**Args**: restaurantId: String!, days: Int = 14
**Returns**: [DailyStats!]!
```graphql
type DailyStats {
  date: String!
  orderCount: Int!
  revenue: Float!
}
```

### Query: recentEvents
**Args**: restaurantId: String, limit: Int = 50
**Returns**: [OrderEvent!]!

## Internal Webhook Endpoint

### POST /internal/order-completed
**Headers**: X-Internal-Secret: {INTERNAL_API_SECRET}
**Request Body**:
```json
{
  "orderId": "uuid",
  "restaurantId": "uuid",
  "courierId": "uuid",
  "totalAmount": number,
  "deliveryTime": number
}
```
**Logic**:
- Validate secret
- Record event in analytics DB
- Update aggregated statistics

## Redis Subscriber (Background Process)
Subscribe to `order.events` channel:
```python
async def handle_order_event(message):
    data = json.loads(message['data'])
    event_type = data['type']
    
    if event_type == 'order_created':
        await record_order_event(data)
    elif event_type == 'order_delivered':
        await record_delivery_event(data)
        await update_courier_stats(data['courierId'])
        await update_restaurant_stats(data['restaurantId'])
```

---

# MIDDLEWARE & UTILITIES

## Authentication Middleware (Server 1)
```typescript
export const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'No token' });
  
  // Check blacklist
  const isBlacklisted = await redisService.isBlacklisted(token);
  if (isBlacklisted) return res.status(401).json({ message: 'Token revoked' });
  
  const payload = verifyAccessToken(token);
  req.user = payload;
  next();
};
```


## Role-Based Access Control
```typescript
export const authorize = (...roles: UserRole[]) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};
```

## Validation Middleware
```typescript
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};
```

---

# CRITICAL IMPLEMENTATION NOTES

## 1. Price Security (Order Creation)
❌ NEVER accept prices from client
✅ ALWAYS fetch prices from database
✅ Store snapshot in OrderItem.price

## 2. Race Condition Prevention (Courier Pickup)
✅ Use `updateMany` with WHERE clause checking courierId IS NULL
✅ Check result.count === 0 to detect concurrent pickup

## 3. JWT Security
✅ Access token: 15 minutes expiry
✅ Refresh token: 7 days, stored hashed in Redis
✅ Blacklist on logout with TTL = token expiry
✅ Validate JWT_SECRET length >= 32 chars on startup

## 4. Password Security
✅ bcrypt with 12 rounds
✅ Never return password in API responses
✅ Timing-safe comparison (always hash even if user not found)

## 5. Socket.io Room Security
✅ Verify ownership before joining rooms
✅ Customer can join order:{orderId} only if customerId matches
✅ Restaurant owner can join restaurant:{id} only if ownerId matches
✅ Courier can join order:{orderId} only if courierId matches

## 6. Redis Pub/Sub Reliability
✅ Server 1 publishes to `order.events`
✅ Server 2 subscribes and processes asynchronously
✅ Also send HTTP webhook as backup (synchronous confirmation)

---

# ENVIRONMENT VARIABLES

## Server 1 (.env)
```
DATABASE_URL=postgresql://user:pass@db1:5432/delivereat_main
REDIS_URL=redis://redis:6379
JWT_SECRET=64-char-random-string
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
INTERNAL_API_SECRET=secret-for-server2
SERVER2_URL=http://server2:8000
PORT=5000
```

## Server 2 (.env)
```
DATABASE_URL=postgresql://user:pass@db1:5432/delivereat_main
REDIS_URL=redis://redis:6379
INTERNAL_API_SECRET=same-as-server1
PORT=8000
```

---

# YOUR TASK - BUILD SERVER 1 & SERVER 2

## Step 1: Analyze Existing Code
Read these files first to understand current implementation:
- server1/prisma/schema.prisma (database schema)
- server1/src/index.ts (Express setup)
- server1/src/controllers/*.ts (existing controllers)
- server1/src/routes/*.ts (existing routes)
- server2/app/main.py (FastAPI setup)
- server2/app/graphql/schema.py (GraphQL schema)

## Step 2: Implement Missing Functionality
Based on the complete endpoint list above, identify what's missing and implement:

### Server 1 Priority Order:
1. ✅ Authentication (register, login, refresh, logout, getMe)
2. ✅ Restaurant CRUD + status management
3. ✅ Menu items + categories
4. ⚠️ Order creation (CRITICAL - price security)
5. ⚠️ Order status updates (accept, ready, pickup, deliver, cancel)
6. ⚠️ Courier available orders (with distance calculation)
7. ⚠️ Courier location updates
8. ✅ Address CRUD
9. ✅ Review system
10. ✅ Notifications
11. ⚠️ Socket.io rooms and events
12. ⚠️ Surge pricing background job
13. ⚠️ Redis Pub/Sub publishing

### Server 2 Priority Order:
1. ⚠️ GraphQL queries (restaurantStats, courierPerformance, burndownChart)
2. ⚠️ Internal webhook (/internal/order-completed)
3. ⚠️ Redis subscriber for order.events
4. ⚠️ Analytics recording functions

## Step 3: Testing Requirements
After implementation, test:
1. Register → Login → Get profile
2. Create restaurant → Add menu items
3. Create order → Verify prices from DB (not client)
4. Concurrent courier pickup → Should prevent double assignment
5. Socket.io room join → Verify authorization
6. GraphQL queries → Should return aggregated data
7. Redis Pub/Sub → Server 2 receives events

## Step 4: Code Quality Checklist
✅ TypeScript strict mode
✅ All async functions with try-catch
✅ Input validation with express-validator
✅ Authorization checks on protected routes
✅ Error responses with proper HTTP status codes
✅ Consistent response format
✅ No console.log (use proper logger)
✅ Comments on complex logic

---

# COMMON PITFALLS TO AVOID

❌ Accepting prices from client in order creation
❌ Not checking ownership before allowing actions
❌ Race conditions in concurrent operations
❌ Hardcoding secret keys
❌ Exposing internal errors to client
❌ Not validating JWT expiry
❌ SQL injection (use Prisma parameterized queries)
❌ Missing CORS configuration
❌ Not handling Socket.io disconnection
❌ Memory leaks in Redis connections

---

# SUCCESS CRITERIA

Your implementation is complete when:
1. ✅ All 50+ endpoints listed above are working
2. ✅ Socket.io real-time updates functional
3. ✅ No security vulnerabilities (price tampering, race conditions, JWT issues)
4. ✅ GraphQL analytics returning correct data
5. ✅ Redis Pub/Sub event flow working
6. ✅ Surge pricing calculation running
7. ✅ All error cases handled gracefully
8. ✅ Code follows TypeScript/Python best practices

---

# EXAMPLE: Complete Order Creation Implementation

```typescript
// server1/src/controllers/order.controller.ts
export const createOrder = async (req, res, next) => {
  try {
    const { restaurantId, addressId, items, note } = req.body;
    const customerId = req.user.userId;

    // 1. Validate restaurant
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId, status: 'OPEN' }
    });
    if (!restaurant) throw new AppError('Restaurant is closed', 400);

    // 2. Fetch authoritative prices from DB
    const menuItemIds = items.map(i => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, restaurantId, isAvailable: true }
    });
    
    if (menuItems.length !== items.length) {
      throw new AppError('Some items are unavailable', 400);
    }

    // 3. Calculate total with DB prices
    let itemsTotal = 0;
    const orderItems = items.map(item => {
      const menuItem = menuItems.find(m => m.id === item.menuItemId);
      const lineTotal = menuItem.price * item.quantity;
      itemsTotal += lineTotal;
      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: menuItem.price, // Snapshot
        note: item.note
      };
    });

    // 4. Get surge multiplier
    const surge = await redisService.get(`surge:restaurant:${restaurantId}`);
    const multiplier = surge ? parseFloat(surge) : 1.0;
    const deliveryFee = Math.round(15000 * multiplier);

    // 5. Create order
    const order = await prisma.order.create({
      data: {
        customerId,
        restaurantId,
        addressId,
        status: 'CONFIRMED',
        totalAmount: itemsTotal + deliveryFee,
        deliveryFee,
        note,
        items: { create: orderItems }
      },
      include: { items: { include: { menuItem: true } } }
    });

    // 6. Parallel event propagation
    await Promise.all([
      // Redis Pub/Sub
      redisService.publish('order.events', {
        type: 'order_created',
        orderId: order.id,
        restaurantId,
        totalAmount: order.totalAmount
      }),
      
      // Socket.io
      getIO().to(`restaurant:${restaurantId}`).emit('order:new', {
        orderId: order.id,
        customerName: req.user.name,
        totalAmount: order.totalAmount
      }),
      
      // Notification
      prisma.notification.create({
        data: {
          userId: restaurant.ownerId,
          type: 'NEW_ORDER',
          title: 'New Order',
          message: `New order #${order.id.slice(0, 8)}`
        }
      })
    ]);

    res.status(201).json({ order });
  } catch (error) {
    next(error);
  }
};
```

---

**START IMPLEMENTING NOW!** Focus on getting Server 1 fully functional first, then move to Server 2.
