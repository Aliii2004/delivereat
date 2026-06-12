# Assignment Diagrams - Copy & Paste Ready

**Instructions**: Copy the code blocks below and paste them into diagram rendering tools.
- **Mermaid**: https://mermaid.live or GitHub/VS Code
- **PlantUML**: http://www.plantuml.com/plantuml or IntelliJ IDEA

---

# Figure 1: DeliverEat Microservices Architecture

**Location in Assignment**: Section 3.2 - Design and Justification of the DeliverEat API Architecture (M2, D2)

**How to Reference in Text**:
```
As illustrated in Figure 1, the system utilizes Nginx as a reverse proxy gateway 
to efficiently route incoming traffic between Server 1 (REST/Socket.io) and Server 2 
(FastAPI/GraphQL). This design is justified by the "Separation of Concerns" principle; 
by isolating the real-time operational logic from the computationally heavy analytics 
engine, the platform ensures that a surge in analytical queries does not degrade the 
performance of live order tracking.
```

## Mermaid Code - Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        Client[Next.js Client<br/>React + TypeScript]
    end
    
    subgraph "Gateway Layer"
        Nginx[Nginx Reverse Proxy<br/>Port 80]
    end
    
    subgraph "Application Layer"
        S1[Server 1<br/>Express/Node.js<br/>Port 5000]
        S2[Server 2<br/>FastAPI/Python<br/>Port 8000]
        Socket[Socket.io Server<br/>Real-time Events]
    end
    
    subgraph "Data Layer"
        PG[(PostgreSQL<br/>Port 5432)]
        Redis[(Redis<br/>Cache & Pub/Sub<br/>Port 6379)]
    end
    
    Client -->|HTTP/HTTPS| Nginx
    Client -.->|WebSocket| Socket
    
    Nginx -->|/api/*| S1
    Nginx -->|/graphql| S2
    
    S1 --> PG
    S1 --> Redis
    S1 -.->|Emit Events| Socket
    
    S2 --> PG
    S2 --> Redis
    
    Redis -.->|Pub/Sub| S2
    
    style Client fill:#e1f5ff
    style Nginx fill:#fff4e6
    style S1 fill:#e8f5e9
    style S2 fill:#f3e5f5
    style Socket fill:#ffe0b2
    style PG fill:#ffebee
    style Redis fill:#fce4ec
```

## PlantUML Code - Architecture Diagram

```plantuml
@startuml DeliverEat Architecture
!define RECTANGLE class

skinparam rectangle {
    BackgroundColor<<client>> LightBlue
    BackgroundColor<<gateway>> LightYellow
    BackgroundColor<<server>> LightGreen
    BackgroundColor<<data>> LightPink
}

package "Client Layer" {
    rectangle "Next.js Client\n(React + TypeScript)" as Client <<client>>
}

package "Gateway Layer" {
    rectangle "Nginx\nReverse Proxy\nPort 80" as Nginx <<gateway>>
}

package "Application Layer" {
    rectangle "Server 1\nExpress/Node.js\nPort 5000\n\n- REST API\n- Authentication\n- Order Management" as S1 <<server>>
    
    rectangle "Server 2\nFastAPI/Python\nPort 8000\n\n- GraphQL API\n- Analytics\n- Statistics" as S2 <<server>>
    
    rectangle "Socket.io Server\nReal-time Events\n\n- Order Status\n- GPS Tracking\n- Notifications" as Socket <<server>>
}

package "Data Layer" {
    database "PostgreSQL\nPort 5432\n\n- Users\n- Orders\n- Restaurants\n- Menu Items" as PG <<data>>
    
    database "Redis\nPort 6379\n\n- Cache\n- Pub/Sub\n- Sessions" as Redis <<data>>
}

Client -down-> Nginx : HTTP/HTTPS
Client .down.> Socket : WebSocket

Nginx -down-> S1 : /api/*
Nginx -down-> S2 : /graphql

S1 -down-> PG : Prisma ORM
S1 -down-> Redis : Cache & Pub/Sub
S1 .right.> Socket : Emit Events

S2 -down-> PG : SQLAlchemy
S2 -down-> Redis : Subscriber

Redis .up.> S2 : Pub/Sub Events

note right of S1
  **REST Endpoints:**
  - POST /api/auth/login
  - GET /api/orders
  - POST /api/orders
  - PATCH /api/orders/:id/status
end note

note right of S2
  **GraphQL Queries:**
  - restaurantStats
  - courierPerformance
  - burndownChart
end note

note bottom of Socket
  **Socket.io Rooms:**
  - order:{orderId}
  - restaurant:{restaurantId}
  - all-zones (couriers)
end note

@enduml
```

---

# Figure 2: Database Schema for DeliverEat

**Location in Assignment**: Section 3.3 - Data Modeling and API Interaction (LO2)

**How to Reference in Text**:
```
Figure 2 presents the Entity Relationship Diagram (ERD) for the DeliverEat ecosystem. 
The APIs interact with these entities—such as Users, Restaurants, MenuItems, and Orders—
using Object-Relational Mapping (ORM) tools like Prisma and SQLAlchemy. This schema 
ensures that the REST API can perform efficient CRUD operations on the operational tables, 
whilst the GraphQL API can execute complex join queries for analytics without data redundancy.
```

## Mermaid Code - Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ Order : "places"
    User ||--o| Restaurant : "owns"
    User ||--o| Courier : "is"
    User ||--o{ Address : "has"
    User ||--o{ Review : "writes"
    
    Restaurant ||--o{ MenuItem : "offers"
    Restaurant ||--o{ Order : "receives"
    Restaurant ||--o{ Category : "contains"
    Restaurant ||--o{ Review : "receives"
    
    Category ||--o{ MenuItem : "groups"
    
    Order ||--o{ OrderItem : "contains"
    Order }o--|| Address : "delivered to"
    Order }o--o| Courier : "delivered by"
    Order ||--o{ Review : "can be reviewed"
    
    MenuItem ||--o{ OrderItem : "appears in"
    
    Courier ||--o{ Order : "delivers"
    Courier ||--o{ Review : "receives"
    
    User {
        uuid id PK
        string email UK
        string password
        string name
        enum role
        datetime createdAt
    }
    
    Restaurant {
        uuid id PK
        uuid ownerId FK
        string name
        string address
        float latitude
        float longitude
        enum status
        float rating
        int totalOrders
    }
    
    MenuItem {
        uuid id PK
        uuid restaurantId FK
        uuid categoryId FK
        string name
        float price
        boolean isAvailable
        int preparationTime
    }
    
    Order {
        uuid id PK
        uuid customerId FK
        uuid restaurantId FK
        uuid addressId FK
        uuid courierId FK
        enum status
        float totalAmount
        float deliveryFee
        datetime createdAt
    }
    
    OrderItem {
        uuid id PK
        uuid orderId FK
        uuid menuItemId FK
        int quantity
        float price
    }
    
    Courier {
        uuid id PK
        uuid userId FK
        string vehicleType
        enum status
        float rating
        int totalDeliveries
    }
    
    Address {
        uuid id PK
        uuid userId FK
        string street
        string city
        float latitude
        float longitude
    }
    
    Category {
        uuid id PK
        string name
        uuid restaurantId FK
    }
    
    Review {
        uuid id PK
        uuid orderId FK
        uuid customerId FK
        uuid restaurantId FK
        uuid courierId FK
        int rating
        string comment
    }
```

## PlantUML Code - Entity Relationship Diagram

```plantuml
@startuml DeliverEat Database Schema

!define table(x) class x << (T,#FFAAAA) >>
!define primary_key(x) <u>x</u>
!define foreign_key(x) #x

hide methods
hide stereotypes

' ══════════════════════════════════════════════════════════
' CORE ENTITIES
' ══════════════════════════════════════════════════════════

table(User) {
  primary_key(id): UUID
  email: String {unique}
  password: String
  name: String
  phone: String
  role: Enum
  avatar: String
  isActive: Boolean
  createdAt: DateTime
}

table(Restaurant) {
  primary_key(id): UUID
  foreign_key(ownerId): UUID
  name: String
  description: String
  address: String
  latitude: Float
  longitude: Float
  status: Enum
  rating: Float
  totalOrders: Int
  isVerified: Boolean
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

table(Order) {
  primary_key(id): UUID
  foreign_key(customerId): UUID
  foreign_key(restaurantId): UUID
  foreign_key(addressId): UUID
  foreign_key(courierId): UUID
  status: Enum
  totalAmount: Float
  deliveryFee: Float
  note: String
  estimatedTime: Int
  createdAt: DateTime
}

table(OrderItem) {
  primary_key(id): UUID
  foreign_key(orderId): UUID
  foreign_key(menuItemId): UUID
  quantity: Int
  price: Float
  note: String
}

table(Courier) {
  primary_key(id): UUID
  foreign_key(userId): UUID
  vehicleType: String
  status: Enum
  rating: Float
  totalDeliveries: Int
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

table(Category) {
  primary_key(id): UUID
  foreign_key(restaurantId): UUID
  name: String
}

table(Review) {
  primary_key(id): UUID
  foreign_key(orderId): UUID
  foreign_key(customerId): UUID
  foreign_key(restaurantId): UUID
  foreign_key(courierId): UUID
  rating: Int
  comment: String
  createdAt: DateTime
}

' ══════════════════════════════════════════════════════════
' RELATIONSHIPS
' ══════════════════════════════════════════════════════════

User "1" -- "0..*" Order : places
User "1" -- "0..1" Restaurant : owns
User "1" -- "0..1" Courier : is
User "1" -- "0..*" Address : has
User "1" -- "0..*" Review : writes

Restaurant "1" -- "0..*" MenuItem : offers
Restaurant "1" -- "0..*" Order : receives
Restaurant "1" -- "0..*" Category : contains
Restaurant "1" -- "0..*" Review : has

Category "1" -- "0..*" MenuItem : groups

Order "1" -- "1..*" OrderItem : contains
Order "0..*" -- "1" Address : delivered_to
Order "0..*" -- "0..1" Courier : delivered_by
Order "1" -- "0..*" Review : reviewed_by

MenuItem "1" -- "0..*" OrderItem : appears_in

Courier "1" -- "0..*" Order : delivers
Courier "1" -- "0..*" Review : receives

note right of Order
  **Status Lifecycle:**
  CONFIRMED → ACCEPTED → PREPARING
  → READY → ON_THE_WAY → DELIVERED
  (or CANCELLED at any stage)
end note

note right of OrderItem
  **Security Note:**
  Price is snapshot at order time
  to prevent price manipulation
end note

note right of User
  **Roles:**
  - CUSTOMER
  - RESTAURANT_OWNER
  - COURIER
  - ADMIN
end note

@enduml
```

---

# Figure 3: Sequence Diagram - Order Fulfillment Process

**Location in Assignment**: Section 4.1 - Implementation of the Multi-API Solution (P3, M3, D3)

**How to Reference in Text**:
```
The implementation phase focused on orchestrating multiple APIs to work in harmony during 
a single business transaction. The complexity of this interaction is best demonstrated 
during the order fulfillment lifecycle.

As shown in the Sequence Diagram (Figure 3), a single order placement triggers a chain 
of API events:

1. The Client sends a REST POST request to Server 1.
2. Server 1 validates the request and publishes an event to the Redis Pub/Sub channel.
3. Simultaneously, Server 1 emits a WebSocket event via Socket.io to notify the restaurant 
   in real-time.
4. Server 2, acting as a subscriber, consumes the Redis event to update the GraphQL-based 
   analytics database.

This multi-API construction (D3) ensures that the system remains responsive and that data 
is synchronized across different services using the most appropriate protocol for each task.
```

## Mermaid Code - Sequence Diagram

```mermaid
sequenceDiagram
    participant Client as Client (Browser)
    participant S1 as Server 1 (Express)
    participant DB as PostgreSQL
    participant Redis as Redis
    participant S2 as Server 2 (FastAPI)
    participant Socket as Socket.io
    
    Note over Client,Socket: ORDER PLACEMENT FLOW
    
    Client->>S1: POST /api/orders<br/>{restaurantId, addressId, items[]}
    activate S1
    
    S1->>DB: Validate restaurant<br/>SELECT * FROM restaurants<br/>WHERE id=? AND status='OPEN'
    DB-->>S1: Restaurant data
    
    alt Restaurant Closed
        S1-->>Client: 400 Bad Request<br/>"Restaurant is closed"
    end
    
    S1->>DB: Fetch authoritative prices<br/>SELECT * FROM menu_items<br/>WHERE id IN (?)
    DB-->>S1: Menu items with prices
    
    Note over S1: Security: Prices from DB,<br/>not from client payload
    
    S1->>Redis: GET surge:restaurant:{id}
    Redis-->>S1: Surge multiplier (1.0 - 2.0)
    
    Note over S1: Calculate:<br/>deliveryFee = 15000 × multiplier
    
    S1->>DB: INSERT INTO orders<br/>(status=CONFIRMED, totalAmount)
    DB-->>S1: Order created (UUID)
    
    Note over S1: Order persisted.<br/>Now propagate events:
    
    par Parallel Event Propagation
        S1->>Redis: PUBLISH order.events<br/>{type: 'order_created', orderId}
        Note over Redis: Pub/Sub channel
        
        S1->>Socket: EMIT 'order:new'<br/>room: restaurant:{id}
        Note over Socket: Real-time notification<br/>to restaurant owner
        
        S1->>DB: INSERT INTO notifications<br/>{userId, type: 'NEW_ORDER'}
    end
    
    S1-->>Client: 201 Created<br/>{order: {id, status, totalAmount}}
    deactivate S1
    
    Note over Redis,S2: ASYNCHRONOUS ANALYTICS PATH
    
    Redis->>S2: redis_subscriber<br/>receives 'order_created' event
    activate S2
    
    S2->>S2: StatsService.recordEvent()
    
    S2->>DB: INSERT INTO order_event<br/>(analytics database)
    DB-->>S2: Recorded
    
    deactivate S2
    
    Note over Client,S2: ✓ Order created<br/>✓ All systems notified<br/>✓ Analytics recorded
```

## PlantUML Code - Sequence Diagram

```plantuml
@startuml Order Fulfillment Process

actor "Client\n(Browser)" as Client
participant "Server 1\n(Express)" as S1
database "PostgreSQL" as DB
queue "Redis\n(Cache & Pub/Sub)" as Redis
participant "Server 2\n(FastAPI)" as S2
participant "Socket.io" as Socket

title Order Fulfillment Process - Multiple API Integration

== ORDER PLACEMENT ==

Client -> S1: POST /api/orders\n{restaurantId, addressId, items[]}
activate S1

S1 -> DB: Validate restaurant\nSELECT * FROM restaurants\nWHERE id=? AND status='OPEN'
DB --> S1: Restaurant data

alt Restaurant Closed
    S1 --> Client: 400 Bad Request\n"Restaurant is closed"
end

S1 -> DB: Fetch authoritative prices\nSELECT * FROM menu_items\nWHERE id IN (?)
DB --> S1: Menu items with prices

note over S1
  **Security Control:**
  Prices fetched from database,
  not accepted from client payload.
  Prevents price tampering.
end note

S1 -> Redis: GET surge:restaurant:{id}
Redis --> S1: Surge multiplier (1.0 - 2.0)

note over S1
  **Dynamic Pricing:**
  deliveryFee = 15000 × multiplier
  Based on courier availability
end note

S1 -> DB: INSERT INTO orders\n(customerId, restaurantId,\nstatus=CONFIRMED, totalAmount)
DB --> S1: Order UUID

note over S1
  ✓ Order persisted
  Now propagate events
  to all subsystems
end note

== PARALLEL EVENT PROPAGATION ==

par Asynchronous Events
    S1 -> Redis: PUBLISH order.events\n{type: 'order_created',\norderId, restaurantId}
    note over Redis
      Pub/Sub channel
      Decouples services
    end note
else Real-time Notification
    S1 -> Socket: EMIT 'order:new'\nroom: restaurant:{id}
    note over Socket
      Restaurant owner
      receives instant alert
    end note
else Persistent Notification
    S1 -> DB: INSERT INTO notifications\n{userId, type: 'NEW_ORDER'}
end

S1 --> Client: 201 Created\n{order: {id, status, totalAmount, eta}}
deactivate S1

== ASYNCHRONOUS ANALYTICS ==

Redis -> S2: redis_subscriber\nreceives 'order_created' event
activate S2

S2 -> S2: StatsService.recordEvent()

S2 -> DB: INSERT INTO order_event\n(analytics database)
DB --> S2: ✓ Recorded

deactivate S2

note over Client, S2
  **Summary:**
  ✓ Order created and persisted
  ✓ Real-time notification sent
  ✓ Analytics recorded asynchronously
  ✓ No blocking dependencies
end note

@enduml
```

---

# Figure 4: Flowchart - Authentication Logic (White Box Testing)

**Location in Assignment**: Section 5.1 - White Box Testing and Structural Analysis (P4)

**How to Reference in Text**:
```
White box testing was conducted to verify the internal logic and conditional branches 
of the source code. This ensures that all "code paths" are functioning as intended, 
particularly for security-critical functions like authentication and price calculation.

Figure 4 illustrates the internal logic flow for the authentication middleware. By mapping 
out the decision nodes (e.g., Is the authorization header present? Is the JWT signature valid? 
Is the token blacklisted? Does the user role match the required role?), I was able to design 
test cases that exercise every possible branch. The results of the structural testing confirmed 
that the application correctly handles edge cases, such as rejecting expired tokens and 
preventing unauthorized access through role-based access control (RBAC).
```

## Mermaid Code - Authentication Flowchart

```mermaid
flowchart TD
    Start([Incoming HTTP Request]) --> CheckHeader{Authorization<br/>header present?}
    
    CheckHeader -->|No| Err401A[Return 401<br/>"No token provided"]
    CheckHeader -->|Yes| ExtractToken[Extract token from<br/>'Bearer {token}']
    
    ExtractToken --> VerifyJWT{JWT signature<br/>valid?}
    
    VerifyJWT -->|Invalid/Expired| Err401B[Return 401<br/>"Invalid token"]
    VerifyJWT -->|Valid| CheckBlacklist{Token in<br/>blacklist?}
    
    CheckBlacklist -->|Yes| Err401C[Return 401<br/>"Token revoked"]
    CheckBlacklist -->|No| ExtractUser[Extract userId and role<br/>from JWT payload]
    
    ExtractUser --> CheckRole{Endpoint requires<br/>specific role?}
    
    CheckRole -->|No role check| Success[Attach user data to request<br/>Proceed to controller]
    CheckRole -->|Yes| RoleMatch{User role matches<br/>required role?}
    
    RoleMatch -->|No| Err403[Return 403<br/>"Access denied"]
    RoleMatch -->|Yes| Success
    
    Success --> End([Controller Execution])
    Err401A --> End
    Err401B --> End
    Err401C --> End
    Err403 --> End
    
    style Start fill:#e1f5ff
    style End fill:#e8f5e9
    style Err401A fill:#ffebee
    style Err401B fill:#ffebee
    style Err401C fill:#ffebee
    style Err403 fill:#fff3e0
    style Success fill:#e8f5e9
```

## PlantUML Code - Authentication Flowchart

```plantuml
@startuml Authentication Logic Flowchart

start

:Incoming HTTP Request;

if (Authorization header present?) then (yes)
  :Extract token from "Bearer {token}";
  
  if (JWT signature valid?) then (yes)
    
    if (Token in blacklist?) then (no)
      :Extract userId and role from JWT payload;
      
      if (Endpoint requires specific role?) then (no)
        :Attach user data to request;
        :Proceed to controller;
        stop
      else (yes)
        if (User role matches required role?) then (yes)
          :Attach user data to request;
          :Proceed to controller;
          stop
        else (no)
          #FFF3E0:Return 403 Forbidden
          "Access denied";
          stop
        endif
      endif
      
    else (yes - token revoked)
      #FFEBEE:Return 401 Unauthorized
      "Token has been revoked";
      stop
    endif
    
  else (no - invalid or expired)
    #FFEBEE:Return 401 Unauthorized
    "Invalid or expired token";
    stop
  endif
  
else (no)
  #FFEBEE:Return 401 Unauthorized
  "No token provided";
  stop
endif

@enduml
```

---

# Figure 5: Flowchart - Price Calculation Logic (White Box Testing)

**Location in Assignment**: Section 5.1 - White Box Testing and Structural Analysis (P4)

**How to Reference in Text**:
```
Figure 5 illustrates the internal logic flow for the createOrder controller, specifically 
the price calculation and validation process. By mapping out the decision nodes (e.g., 
Is the restaurant open? Are items available? What is the courier-to-order ratio for surge 
pricing?), I was able to design test cases that exercise every possible branch.

The results of the structural testing confirmed that the application correctly handles edge 
cases, such as rejecting orders from closed restaurants or preventing unauthorized price 
tampering by fetching authoritative data directly from the PostgreSQL database rather than 
accepting client-supplied prices. The surge pricing algorithm was tested across all four 
conditional branches (ratio >= 2.0, >= 1.5, >= 1.0, and < 1.0) to ensure correct multiplier 
application in varying demand scenarios.
```

## Mermaid Code - Price Calculation Flowchart

```mermaid
flowchart TD
    Start([Order Creation Request]) --> FetchItems[Fetch menu items<br/>from database]
    
    FetchItems --> ValidateItems{All items<br/>belong to same<br/>restaurant?}
    
    ValidateItems -->|No| ErrCrossRestaurant[Return 400<br/>"Invalid items"]
    ValidateItems -->|Yes| CalcItemsTotal[Calculate items total:<br/>sum of (price × quantity)]
    
    CalcItemsTotal --> GetCouriers[Query available couriers<br/>in restaurant zone]
    
    GetCouriers --> CountCouriers[Count: availableCouriers]
    
    CountCouriers --> GetOrders[Query active orders<br/>in restaurant zone]
    
    GetOrders --> CountOrders[Count: activeOrders]
    
    CountOrders --> CalcRatio[Calculate ratio:<br/>activeOrders / availableCouriers]
    
    CalcRatio --> CheckRatio{ratio >= 2.0?}
    
    CheckRatio -->|Yes| SetMultiplier20[surgeMultiplier = 2.0]
    CheckRatio -->|No| CheckRatio15{ratio >= 1.5?}
    
    CheckRatio15 -->|Yes| SetMultiplier15[surgeMultiplier = 1.5]
    CheckRatio15 -->|No| CheckRatio10{ratio >= 1.0?}
    
    CheckRatio10 -->|Yes| SetMultiplier12[surgeMultiplier = 1.2]
    CheckRatio10 -->|No| SetMultiplier10[surgeMultiplier = 1.0]
    
    SetMultiplier20 --> CalcDelivery[deliveryFee = 15000 × surgeMultiplier]
    SetMultiplier15 --> CalcDelivery
    SetMultiplier12 --> CalcDelivery
    SetMultiplier10 --> CalcDelivery
    
    CalcDelivery --> CalcTotal[totalAmount = itemsTotal + deliveryFee]
    
    CalcTotal --> CreateOrder[INSERT order into database]
    
    CreateOrder --> ReturnOrder[Return 201 Created<br/>{order, totalAmount, deliveryFee}]
    
    ReturnOrder --> End([End])
    ErrCrossRestaurant --> End
    
    style Start fill:#e1f5ff
    style End fill:#e8f5e9
    style ErrCrossRestaurant fill:#ffebee
    style SetMultiplier20 fill:#ffcdd2
    style SetMultiplier15 fill:#ffccbc
    style SetMultiplier12 fill:#fff9c4
    style SetMultiplier10 fill:#c8e6c9
```

## PlantUML Code - Price Calculation Flowchart

```plantuml
@startuml Price Calculation with Surge Pricing

start

:Order Creation Request;
:Fetch menu items from database;

if (All items belong to same restaurant?) then (yes)
  
  :Calculate items total:\nsum of (price × quantity);
  
  :Query available couriers in restaurant zone;
  :Count: availableCouriers;
  
  :Query active orders in restaurant zone;
  :Count: activeOrders;
  
  :Calculate ratio:\nactiveOrders ÷ availableCouriers;
  
  if (ratio >= 2.0?) then (yes)
    #FFCDD2:surgeMultiplier = 2.0;
  elseif (ratio >= 1.5?) then (yes)
    #FFCCBC:surgeMultiplier = 1.5;
  elseif (ratio >= 1.0?) then (yes)
    #FFF9C4:surgeMultiplier = 1.2;
  else (no)
    #C8E6C9:surgeMultiplier = 1.0;
  endif
  
  :deliveryFee = 15000 × surgeMultiplier;
  :totalAmount = itemsTotal + deliveryFee;
  
  :INSERT order into database;
  
  :Return 201 Created\n{order, totalAmount, deliveryFee};
  
  stop
  
else (no - cross-restaurant attack)
  #FFEBEE:Return 400 Bad Request\n"Invalid items";
  stop
endif

note right
  **White Box Test Cases:**
  • WB-05: ratio = 3.0 → multiplier = 2.0
  • WB-06: ratio = 0.33 → multiplier = 1.0
  • WB-07: ratio = 1.8 → multiplier = 1.5
  • WB-08: ratio = 1.1 → multiplier = 1.2
end note

@enduml
```

---

# Summary: Diagram Placement Guide for BTEC Unit 37 Assignment

## Figure 1: DeliverEat Microservices Architecture
- **Section**: 3.2 - Design and Justification (M2, D2)
- **Purpose**: Demonstrates high-level architectural design and separation of concerns
- **Key Point**: Proves design skills and justifies technology choices

## Figure 2: Database Schema for DeliverEat
- **Section**: 3.3 - Data Modeling and API Interaction (LO2)
- **Purpose**: Shows the data foundation supporting all API operations
- **Key Point**: Illustrates how REST and GraphQL APIs interact with relational data

## Figure 3: Sequence Diagram - Order Fulfillment Process
- **Section**: 4.1 - Implementation of Multi-API Solution (P3, M3, D3)
- **Purpose**: **GOLDEN EVIDENCE for Distinction D3** - demonstrates multiple APIs working together
- **Key Point**: Shows REST, Redis Pub/Sub, Socket.io, and GraphQL coordinating in a single transaction

## Figure 4: Authentication Logic Flowchart
- **Section**: 5.1 - White Box Testing (P4)
- **Purpose**: Proves understanding of internal code structure and conditional branches
- **Key Point**: Shows all decision paths in authentication middleware

## Figure 5: Price Calculation Logic Flowchart
- **Section**: 5.1 - White Box Testing (P4)
- **Purpose**: Demonstrates structural testing of business logic
- **Key Point**: Shows surge pricing algorithm with all four conditional branches tested

---

# How to Use These Diagrams in Your Assignment

## Step 1: Render the Diagrams
1. Copy the Mermaid or PlantUML code for each figure
2. Paste into https://mermaid.live or http://www.plantuml.com/plantuml
3. Export as PNG or SVG (300 DPI recommended for printing)

## Step 2: Insert into Word Document
1. Place cursor at the insertion point (e.g., after "As illustrated in Figure 1...")
2. Insert → Picture → select your exported PNG/SVG
3. Right-click image → Insert Caption
4. Caption text: "Figure 1: DeliverEat Microservices Architecture"
5. Centre-align the image

## Step 3: Reference in Text
Use the provided "How to Reference in Text" examples above. Always:
- Introduce the figure before showing it
- Explain what the figure demonstrates
- Link it back to the grading criteria (P3, M2, D3, etc.)

## Step 4: List of Figures (Optional but Recommended)
Add a "List of Figures" page after your Table of Contents:
```
List of Figures

Figure 1: DeliverEat Microservices Architecture ............................ 12
Figure 2: Database Schema for DeliverEat .................................. 15
Figure 3: Sequence Diagram of the Order Fulfillment Process ............... 18
Figure 4: Flowchart of Authentication Middleware Logic .................... 24
Figure 5: Flowchart of Price Calculation with Surge Pricing ............... 25
```

---

# Professional Writing Tips for Figure References

## Good Examples:

✅ "As illustrated in Figure 1, the system architecture..."
✅ "Figure 2 demonstrates the entity relationships..."
✅ "The sequence diagram (Figure 3) shows how multiple APIs coordinate..."
✅ "By examining the flowchart in Figure 4, we can identify five distinct code paths..."

## Avoid:

❌ "Here is a picture of the architecture"
❌ "See below for diagram"
❌ "Figure 1 (above/below)"

## UK Academic Style:

- Use "whilst" not "while" in formal writing
- Use "utilises" not "uses" for technical descriptions
- Use "demonstrates" not "shows"
- Use "illustrates" not "pictures"

---

**✅ All diagrams are now ready with proper academic English references!**

