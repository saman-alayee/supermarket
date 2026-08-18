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
      select: { createdAt: true, totalPrice: true, paymentMethod: true, userId: true, customerPhone: true },
      orderBy: { createdAt: 'asc' },
    });

    const dailyMap = new Map<string, { date: string; revenue: number; orders: number }>();
    const paymentMap = new Map<string, number>();
    const customerKeys = new Set<string>();

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
      customerKeys.add(order.userId || order.customerPhone);
    }

    const daily = [...dailyMap.values()];
    const workingDays = daily.filter((day) => new Date(`${day.date}T12:00:00`).getDay() !== 5);

    return {
      daily,
      workingDays,
      uniqueCustomers: customerKeys.size,
      paymentBreakdown: [...paymentMap.entries()].map(([paymentMethod, revenue]) => ({
        paymentMethod,
        revenue,
      })),
    };
  }

  async getOverview(days = 30) {
    const [daily, topProducts, byPayment, chart, monthly] = await Promise.all([
      this.getDailySales(),
      this.getTopProducts(10, days),
      this.getByPaymentMethod(days),
      this.getChartData(days),
      this.getMonthlyComparison(6),
    ]);

    const totalRevenue = chart.daily.reduce((sum, d) => sum + d.revenue, 0);
    const orderCount = chart.daily.reduce((sum, d) => sum + d.orders, 0);
    const uniqueCustomers = chart.uniqueCustomers || 0;

    return {
      totalRevenue,
      orderCount,
      avgOrder: orderCount ? Math.round(totalRevenue / orderCount) : 0,
      avgPerCustomer: uniqueCustomers ? Math.round(totalRevenue / uniqueCustomers) : 0,
      uniqueCustomers,
      daily: chart.daily,
      workingDays: chart.workingDays,
      byPayment,
      topProducts,
      monthly,
      chart,
      today: daily,
    };
  }

  async getMonthlyComparison(months = 6) {
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: since }, status: { notIn: ['CANCELLED'] } },
      select: { createdAt: true, totalPrice: true },
    });

    const monthMap = new Map<string, { month: string; revenue: number; orders: number }>();
    for (const order of orders) {
      const key = `${order.createdAt.getFullYear()}-${String(order.createdAt.getMonth() + 1).padStart(2, '0')}`;
      const entry = monthMap.get(key) ?? { month: key, revenue: 0, orders: 0 };
      entry.revenue += Number(order.totalPrice);
      entry.orders += 1;
      monthMap.set(key, entry);
    }

    const monthly = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));
    const current = monthly[monthly.length - 1];
    const previous = monthly[monthly.length - 2];
    const changePercent =
      previous && previous.revenue
        ? Math.round(((current.revenue - previous.revenue) / previous.revenue) * 100)
        : null;

    return { monthly, changePercent, current, previous };
  }
}

export const salesService = new SalesService();
