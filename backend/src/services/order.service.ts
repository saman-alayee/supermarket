import type { PaymentMethod, Prisma } from '@prisma/client';
import prisma from '../config/database';
import { AppError } from '../utils/errors';
import { generateOrderNumber } from '../utils/helpers';
import { cartService } from './cart.service';
import { couponService } from './coupon.service';
import { notificationService } from './notification.service';
import { smsService } from './sms.service';

export type OrderStatus =
  | 'NEW'
  | 'REVIEWING'
  | 'PREPARING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

const INSTALLMENT_METHODS: PaymentMethod[] = [
  'RETIREMENT_FUND',
  'SOCIAL_SECURITY',
  'TARA',
  'OTHER_WALLET',
];

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['PREPARING', 'CANCELLED'],
  REVIEWING: ['NEW', 'PREPARING', 'CANCELLED'],
  PREPARING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

interface CreateOrderInput {
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string;
  street?: string;
  plaque?: string;
  unit?: string;
  addressId?: string;
  addressTitle?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  notes?: string;
  couponCode?: string;
  paymentMethod: PaymentMethod;
  paymentDetails?: Record<string, unknown>;
}

function buildDeliveryAddress(input: CreateOrderInput): string {
  if (input.deliveryAddress?.trim()) {
    return input.deliveryAddress.trim();
  }

  const parts = [input.street?.trim(), input.plaque ? `پلاک ${input.plaque}` : '', input.unit ? `واحد ${input.unit}` : '']
    .filter(Boolean);

  return parts.join('، ');
}

function validatePaymentDetails(
  paymentMethod: PaymentMethod,
  paymentDetails?: Record<string, unknown>
) {
  if (paymentMethod === 'CASH_AT_DOOR') return;

  if (!paymentDetails || Object.keys(paymentDetails).length === 0) {
    throw new AppError(400, 'جزئیات پرداخت برای این روش الزامی است');
  }
}

export class OrderService {
  async createOrder(input: CreateOrderInput, userId?: string, sessionId?: string) {
    const cart = await cartService.getCart(userId, sessionId);

    if (cart.items.length === 0) {
      throw new AppError(400, 'سبد خرید خالی است');
    }

    for (const item of cart.items) {
      if (item.quantity > item.stock) {
        throw new AppError(400, `موجودی ${item.name} کافی نیست`);
      }
    }

    validatePaymentDetails(input.paymentMethod, input.paymentDetails);

    const subtotal = cart.totalPrice;
    let discountAmount = 0;
    let totalPrice = subtotal;
    let couponId: string | undefined;
    let couponCode: string | undefined;

    if (input.couponCode) {
      const validation = await couponService.validate(input.couponCode, subtotal, {
        userId,
        customerPhone: input.customerPhone,
      });
      discountAmount = validation.discountAmount;
      totalPrice = validation.totalPrice;
      couponId = validation.couponId;
      couponCode = validation.code;
    }

    let deliveryAddress = buildDeliveryAddress(input);
    let addressId: string | null = input.addressId ?? null;
    let addressTitle = input.addressTitle ?? null;
    let deliveryLatitude = input.deliveryLatitude ?? null;
    let deliveryLongitude = input.deliveryLongitude ?? null;

    if (input.addressId && userId) {
      const savedAddress = await prisma.address.findFirst({
        where: { id: input.addressId, userId },
      });
      if (!savedAddress) {
        throw new AppError(400, 'آدرس انتخاب‌شده معتبر نیست');
      }

      deliveryAddress = savedAddress.address;
      addressId = savedAddress.id;
      addressTitle = savedAddress.title;
      deliveryLatitude = savedAddress.latitude;
      deliveryLongitude = savedAddress.longitude;
    } else if (!deliveryAddress) {
      throw new AppError(400, 'آدرس ارسال الزامی است');
    }

    const initialStatus: OrderStatus = INSTALLMENT_METHODS.includes(input.paymentMethod)
      ? 'REVIEWING'
      : 'NEW';

    const orderNumber = generateOrderNumber();

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: userId ?? null,
          subtotal,
          discountAmount,
          totalPrice,
          couponCode: couponCode ?? null,
          couponId: couponId ?? null,
          status: initialStatus,
          paymentMethod: input.paymentMethod,
          paymentDetails: input.paymentDetails
            ? (input.paymentDetails as Prisma.InputJsonValue)
            : undefined,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          deliveryAddress,
          addressId,
          addressTitle,
          deliveryLatitude,
          deliveryLongitude,
          notes: input.notes,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.effectivePrice,
              name: item.name,
            })),
          },
          statusLogs: {
            create: {
              status: initialStatus,
              note:
                initialStatus === 'REVIEWING'
                  ? 'سفارش در انتظار بررسی پرداخت'
                  : 'سفارش ثبت شد',
            },
          },
        },
        include: { items: true },
      });

      for (const item of cart.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      if (couponId) {
        await tx.coupon.update({
          where: { id: couponId },
          data: { usedCount: { increment: 1 } },
        });
      }

      if (userId) {
        await tx.cartItem.deleteMany({ where: { cart: { userId } } });
      } else if (sessionId) {
        await tx.cartItem.deleteMany({ where: { cart: { sessionId } } });
      }

      return newOrder;
    });

    if (userId) {
      await notificationService.notifyOrderStatusChange({
        userId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: initialStatus,
      });
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      subtotal,
      discountAmount,
      totalPrice: Number(order.totalPrice),
      couponCode: order.couponCode,
      status: order.status,
      paymentMethod: order.paymentMethod,
      customerName: order.customerName,
      createdAt: order.createdAt,
    };
  }

  async getUserOrders(userId: string, page = 1, limit = 10) {
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where: { userId } }),
    ]);

    return {
      orders: orders.map(this.formatOrder),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOrderById(orderId: string, userId?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: { select: { image: true, slug: true } } } },
        statusLogs: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) throw new AppError(404, 'سفارش یافت نشد');
    if (userId && order.userId !== userId) {
      throw new AppError(403, 'دسترسی غیرمجاز');
    }

    return this.formatOrder(order);
  }

  async getOrderByNumber(orderNumber: string) {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: true,
        statusLogs: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) throw new AppError(404, 'سفارش یافت نشد');
    return this.formatOrder(order);
  }

  async getAllOrders(filters: {
    status?: OrderStatus;
    paymentMethod?: PaymentMethod;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const { status, paymentMethod, page = 1, limit = 20, search } = filters;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { customerName: { contains: search } },
        { customerPhone: { contains: search } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          user: { select: { id: true, phone: true, firstName: true, lastName: true } },
          statusLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders: orders.map(this.formatOrder),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateStatus(orderId: string, status: OrderStatus, note?: string) {
    const current = await prisma.order.findUnique({ where: { id: orderId } });
    if (!current) throw new AppError(404, 'سفارش یافت نشد');

    const allowed = ALLOWED_TRANSITIONS[current.status as OrderStatus];
    if (!allowed.includes(status)) {
      throw new AppError(400, `تغییر وضعیت از ${current.status} به ${status} مجاز نیست`);
    }

    const order = await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId,
          status,
          note: note || undefined,
        },
      });

      return tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          statusLogs: { orderBy: { createdAt: 'desc' } },
        },
      });
    });

    if (!order) throw new AppError(404, 'سفارش یافت نشد');

    if (status === 'SHIPPED') {
      await smsService.sendOrderShipped(order.customerPhone, order.orderNumber);
    }

    await notificationService.notifyOrderStatusChange({
      userId: order.userId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      status,
      note,
    });

    return this.formatOrder(order);
  }

  async sendOrderSms(orderId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError(404, 'سفارش یافت نشد');

    await smsService.sendOrderShipped(order.customerPhone, order.orderNumber);
    return { sent: true, orderNumber: order.orderNumber };
  }

  async getOrderStats() {
    const [total, newOrders, reviewing, preparing, shipped, delivered, cancelled] =
      await Promise.all([
        prisma.order.count(),
        prisma.order.count({ where: { status: 'NEW' } }),
        prisma.order.count({ where: { status: 'REVIEWING' } }),
        prisma.order.count({ where: { status: 'PREPARING' } }),
        prisma.order.count({ where: { status: 'SHIPPED' } }),
        prisma.order.count({ where: { status: 'DELIVERED' } }),
        prisma.order.count({ where: { status: 'CANCELLED' } }),
      ]);

    return { total, newOrders, reviewing, preparing, shipped, delivered, cancelled };
  }

  private formatOrder(order: {
    id: string;
    orderNumber: string;
    userId: string | null;
    subtotal?: number | null;
    discountAmount?: number | null;
    couponCode?: string | null;
    totalPrice: { toNumber?: () => number } | number | bigint;
    status: OrderStatus;
    paymentMethod?: PaymentMethod;
    paymentDetails?: unknown;
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    addressId?: string | null;
    addressTitle?: string | null;
    deliveryLatitude?: number | null;
    deliveryLongitude?: number | null;
    notes?: string | null;
    createdAt: Date;
    updatedAt: Date;
    items?: Array<{
      id: string;
      productId: string;
      quantity: number;
      price: { toNumber?: () => number } | number | bigint;
      name: string;
      product?: { image: string | null; slug: string };
    }>;
    user?: { id: string; phone: string; firstName: string | null; lastName: string | null } | null;
    statusLogs?: Array<{ id: string; status: OrderStatus; note: string | null; createdAt: Date }>;
  }) {
    return {
      ...order,
      subtotal: order.subtotal != null ? Number(order.subtotal) : Number(order.totalPrice),
      discountAmount: Number(order.discountAmount ?? 0),
      totalPrice: Number(order.totalPrice),
      items: order.items?.map((item) => ({
        ...item,
        price: Number(item.price),
        subtotal: Number(item.price) * item.quantity,
      })),
    };
  }
}

export const orderService = new OrderService();
