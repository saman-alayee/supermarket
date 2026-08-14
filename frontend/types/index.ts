export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  sortOrder: number;
  isActive: boolean;
  _count?: { products: number };
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  discountPrice: number | null;
  effectivePrice: number;
  discountPercent: number;
  stock: number;
  image: string | null;
  images: string[];
  unit: string | null;
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
  categoryId: string;
  category?: { id: string; name: string; slug: string };
  inStock: boolean;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  slug: string;
  image: string | null;
  unit: string | null;
  quantity: number;
  price: number;
  discountPrice: number | null;
  effectivePrice: number;
  subtotal: number;
  stock: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  sessionId?: string;
}

export interface User {
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  role: 'CUSTOMER' | 'ADMIN';
  isActive?: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  title: string | null;
  type: 'PERCENT' | 'FIXED';
  value: number;
  minPurchase: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}

export interface ContentPage {
  id: string;
  slug: string;
  title: string;
  body: string;
  isPublished: boolean;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'ORDER_STATUS' | 'GENERAL';
  isRead: boolean;
  orderId: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  subtotal?: number;
  discountAmount?: number;
  couponCode?: string | null;
  totalPrice: number;
  status: OrderStatus;
  customerName: string;
  customerPhone?: string;
  deliveryAddress?: string;
  addressId?: string | null;
  addressTitle?: string | null;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
  statusLogs?: OrderStatusLog[];
}

export interface OrderStatusLog {
  id: string;
  status: OrderStatus;
  note: string | null;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  name: string;
  subtotal?: number;
  product?: { image: string | null; slug: string };
}

export type OrderStatus = 'NEW' | 'PREPARING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface Address {
  id: string;
  title: string | null;
  address: string;
  plaque: string | null;
  unit: string | null;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface HomeSections {
  featured: Product[];
  discounted: Product[];
  newProducts: Product[];
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'سفارش جدید',
  PREPARING: 'در حال آماده‌سازی',
  SHIPPED: 'ارسال شده',
  DELIVERED: 'تحویل داده شده',
  CANCELLED: 'لغو شده',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  PREPARING: 'bg-yellow-100 text-yellow-700',
  SHIPPED: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};
