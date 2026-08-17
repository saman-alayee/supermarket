import type { PaymentMethod } from '@prisma/client';
import prisma from '../config/database';

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export class SalesService {
  async getDailySales(date?: Date) {
    const target = date ?? new Date();
    const from = startOfDay(target);
    const to = endOfDay(target);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        status: { notIn: ['CANCELLED'] },
      },
      select: {
        id: true,
        totalPrice: true,
        paymentMethod: true,
        status: true,
        createdAt: true,
      },
    });

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalPrice), 0);

    return {
      date: from.toISOString().slice(0, 10),
      orderCount: orders.length,
      totalRevenue,
      orders,
    };
  }

  async getTopProducts(limit = 10, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const items = await prisma.orderItem.groupBy({
      by: ['productId', 'name'],
      where: {
        order: {
          createdAt: { gte: since },
          status: { notIn: ['CANCELLED'] },
        },
      },
      _sum: { quantity: true },
      _count: { id: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, slug: true, image: true, price: true, discountPrice: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return items.map((item) => ({
      productId: item.productId,
      name: item.name,
      totalQuantity: item._sum.quantity ?? 0,
      orderCount: item._count.id,
      product: productMap.get(item.productId) ?? null,
    }));
  }

  async getByPaymentMethod(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const groups = await prisma.order.groupBy({
      by: ['paymentMethod'],
      where: {
        createdAt: { gte: since },
        status: { notIn: ['CANCELLED'] },
      },
      _sum: { totalPrice: true },
      _count: { id: true },
    });

    return groups.map((g) => ({
      paymentMethod: g.paymentMethod as PaymentMethod,
      orderCount: g._count.id,
      totalRevenue: Number(g._sum.totalPrice ?? 0),
    }));
  }

  async getChartData(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: since },
        status: { notIn: ['CANCELLED'] },
      },
      select: { createdAt: true, totalPrice: true, paymentMethod: true },
      orderBy: { createdAt: 'asc' },
    });

    const dailyMap = new Map<string, { date: string; revenue: number; orders: number }>();
    const paymentMap = new Map<string, number>();

    for (const order of orders) {
      const dateKey = order.createdAt.toISOString().slice(0, 10);
      const entry = dailyMap.get(dateKey) ?? { date: dateKey, revenue: 0, orders: 0 };
      entry.revenue += Number(order.totalPrice);
      entry.orders += 1;
      dailyMap.set(dateKey, entry);

      paymentMap.set(
        order.paymentMethod,
        (paymentMap.get(order.paymentMethod) ?? 0) + Number(order.totalPrice)
      );
    }

    return {
      daily: [...dailyMap.values()],
      paymentBreakdown: [...paymentMap.entries()].map(([paymentMethod, revenue]) => ({
        paymentMethod,
        revenue,
      })),
    };
  }

  async getOverview(days = 30) {
    const [daily, topProducts, byPayment, chart] = await Promise.all([
      this.getDailySales(),
      this.getTopProducts(10, days),
      this.getByPaymentMethod(days),
      this.getChartData(days),
    ]);

    const totalRevenue = chart.daily.reduce((sum, d) => sum + d.revenue, 0);
    const orderCount = chart.daily.reduce((sum, d) => sum + d.orders, 0);

    return {
      totalRevenue,
      orderCount,
      avgOrder: orderCount ? Math.round(totalRevenue / orderCount) : 0,
      daily: chart.daily,
      byPayment,
      topProducts,
      chart,
      today: daily,
    };
  }
}

export const salesService = new SalesService();
