// ─── USER ──────────────────────────────────────────────────

export type UserRole = 'CUSTOMER' | 'RESTAURANT_OWNER' | 'COURIER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ─── RESTAURANT ────────────────────────────────────────────

export type RestaurantStatus = 'OPEN' | 'CLOSED' | 'BUSY';

export interface Restaurant {
  id: string;
  name: string;
  description?: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  logo?: string;
  coverImage?: string;
  status: RestaurantStatus;
  rating: number;
  totalOrders: number;
}

export interface Category {
  id: string;
  name: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  isAvailable: boolean;
  preparationTime: number;
  category?: Category;
}

// ─── ORDER ─────────────────────────────────────────────────

export type OrderStatus =
  | 'CONFIRMED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'ON_THE_WAY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface OrderItem {
  id: string;
  menuItemId: string;
  quantity: number;
  price: number;
  note?: string;
  menuItem: Pick<MenuItem, 'id' | 'name' | 'price'>;
}

export interface Order {
  id: string;
  customerId: string;
  restaurantId: string;
  status: OrderStatus;
  totalAmount: number;
  deliveryFee: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  restaurant: Pick<Restaurant, 'id' | 'name' | 'logo'>;
  courier?: {
    id: string;
    user: { name: string; phone?: string };
  };
  address: Address;
}

// ─── ADDRESS ───────────────────────────────────────────────

export interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
}

// ─── CART ──────────────────────────────────────────────────

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
}

// ─── COURIER ───────────────────────────────────────────────

export type CourierStatus = 'OFFLINE' | 'AVAILABLE' | 'BUSY';

export interface CourierLocation {
  lat: number;
  lng: number;
  updatedAt: string;
}

// ─── SOCKET EVENTS ─────────────────────────────────────────

export interface OrderStatusEvent {
  orderId: string;
  status: OrderStatus;
  reason?: string;
  deliveryTime?: number;
  courierId?: string;
}

export interface CourierMovedEvent {
  courierId: string;
  lat: number;
  lng: number;
}

// ─── PAGINATION ────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
