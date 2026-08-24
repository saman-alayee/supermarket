import type { PaymentMethod, Prisma } from '@prisma/client';
import prisma from '../config/database';
import { AppError } from '../utils/errors';
import { generateOrderNumber } from '../utils/helpers';
import { cartService } from './cart.service';
import { couponService } from './coupon.service';
import { notificationService } from './notification.service';
import { smsService } from './sms.service';
import { normalizePhone } from '../utils/normalize';

export type OrderStatus =
  | 'NEW'
  | 'REVIEWING'
  | 'PREPARING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

const PAYMENT_METHOD_FA: Record<PaymentMethod, string> = {
  CASH_AT_DOOR: 'پرداخت در محل',
  RETIREMENT_FUND: 'صندوق بازنشستگی',
  SOCIAL_SECURITY: 'تامین اجتماعی',
  TARA: 'کیف پول تارا',
  OTHER_WALLET: 'سایر کیف پول‌ها',
};

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
  deliveryMethod?: 'FREE' | 'JET';
  notes?: string;
  couponCode?: string;
  paymentMethod: PaymentMethod;
  paymentDetails?: Record<string, unknown>;
}

const FREE_SHIPPING_MIN = 200_000;
const JET_DELIVERY_FEE = 50_000;

function buildDeliveryAddress(input: CreateOrderInput & { address?: string }): string {
  if (input.deliveryAddress?.trim()) {
    return input.deliveryAddress.trim();
  }

  if (input.address?.trim()) {
    return input.address.trim();
  }

  const parts = [input.street?.trim(), input.plaque ? `پلاک ${input.plaque}` : '', input.unit ? `واحد ${input.unit}` : '']
    .filter(Boolean);

  return parts.join('، ');
}

async function ensureCustomerUser(input: CreateOrderInput, existingUserId?: string) {
  if (existingUserId) return existingUserId;

  const phone = normalizePhone(input.customerPhone);
  const parts = input.customerName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ') || undefined;

  const user = await prisma.user.upsert({
    where: { phone },
    update: {
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
    },
    create: {
      phone,
      firstName,
      lastName,
      role: 'CUSTOMER',
    },
  });

  return user.id;
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

    const resolvedUserId = await ensureCustomerUser(input, userId);

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

    const deliveryMethod = input.deliveryMethod ?? 'FREE';
    let deliveryFee = 0;
    if (deliveryMethod === 'JET') {
      deliveryFee = JET_DELIVERY_FEE;
    } else if (totalPrice < FREE_SHIPPING_MIN) {
      throw new AppError(400, 'برای ارسال رایگان سفارش باید حداقل ۲۰۰٬۰۰۰ تومان باشد یا گزینه ارسال جت را انتخاب کنید');
    }
    totalPrice += deliveryFee;

    const paymentDetailsToStore: Record<string, unknown> = {
      ...(input.paymentDetails ?? {}),
      deliveryMethod,
      deliveryFee,
    };

    const cleanedPaymentDetails = Object.fromEntries(
      Object.entries(paymentDetailsToStore).filter(
        ([, value]) => value != null && (typeof value === 'number' || String(value).trim() !== '')
      )
    );

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
          userId: resolvedUserId,
          subtotal,
          discountAmount,
          totalPrice,
          couponCode: couponCode ?? null,
          couponId: couponId ?? null,
          status: initialStatus,
          paymentMethod: input.paymentMethod,
          paymentDetails: Object.keys(cleanedPaymentDetails).length
            ? (cleanedPaymentDetails as Prisma.InputJsonValue)
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
                  ? `نوع پرداخت: ${PAYMENT_METHOD_FA[input.paymentMethod]} — در سیستم فروشگاه ثبت شود`
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

      if (resolvedUserId) {
        await tx.cartItem.deleteMany({ where: { cart: { userId: resolvedUserId } } });
      }
      if (sessionId) {
        await tx.cartItem.deleteMany({ where: { cart: { sessionId } } });
      }

      return newOrder;
    });

    if (resolvedUserId) {
      await notificationService.notifyOrderStatusChange({
        userId: resolvedUserId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: initialStatus,
      });
    }

    // Fire-and-forget operator alarm (SMS); UI also polls for sound
    void smsService.notifyOperatorsNewOrder(order.orderNumber, order.customerName);

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
        items: { include: { product: { select: { image: true, slug: true, barcode: true } } } },
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
    dateFrom?: string;
    dateTo?: string;
  }) {
    const { status, paymentMethod, page = 1, limit = 20, search, dateFrom, dateTo } = filters;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
      };
    }
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
          items: { include: { product: { select: { image: true, slug: true, barcode: true } } } },
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

    if (status === 'PREPARING') {
      await smsService.sendOrderPacked(order.customerPhone, order.orderNumber);
    }

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

    if (order.status === 'PREPARING') {
      await smsService.sendOrderPacked(order.customerPhone, order.orderNumber);
    } else {
      await smsService.sendOrderShipped(order.customerPhone, order.orderNumber);
    }
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
      product?: { image: string | null; slug: string; barcode?: string | null };
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
