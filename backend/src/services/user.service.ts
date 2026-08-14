import prisma from '../config/database';
import { AppError } from '../utils/errors';
import { normalizePhone } from '../utils/normalize';

export class AddressService {
  async getUserAddresses(userId: string) {
    return prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(
    userId: string,
    data: {
      title?: string;
      address: string;
      plaque?: string;
      unit?: string;
      latitude?: number | null;
      longitude?: number | null;
      isDefault?: boolean;
    }
  ) {
    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return prisma.address.create({
      data: { userId, ...data },
    });
  }

  async update(
    userId: string,
    addressId: string,
    data: {
      title?: string;
      address?: string;
      plaque?: string;
      unit?: string;
      latitude?: number | null;
      longitude?: number | null;
      isDefault?: boolean;
    }
  ) {
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) throw new AppError(404, 'آدرس یافت نشد');

    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return prisma.address.update({
      where: { id: addressId },
      data,
    });
  }

  async delete(userId: string, addressId: string) {
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) throw new AppError(404, 'آدرس یافت نشد');
    await prisma.address.delete({ where: { id: addressId } });
  }
}

export class CustomerService {
  async getAll(page = 1, limit = 20, search?: string, role?: 'CUSTOMER' | 'ADMIN') {
    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { phone: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          phone: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      customers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const customer = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        addresses: true,
        orders: {
          include: { items: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: { select: { orders: true } },
      },
    });
    if (!customer) throw new AppError(404, 'کاربر یافت نشد');
    return customer;
  }

  async getFrequentCustomers(limit = 10) {
    const customers = await prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        _count: { select: { orders: true } },
      },
      orderBy: { orders: { _count: 'desc' } },
      take: limit,
    });
    return customers.filter((c: { _count: { orders: number } }) => c._count.orders > 0);
  }
}

export class AdminUserService {
  async updateRole(userId: string, role: 'CUSTOMER' | 'ADMIN', actorId: string) {
    if (userId === actorId && role !== 'ADMIN') {
      throw new AppError(400, 'نمی‌توانید نقش خودتان را تغییر دهید');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'کاربر یافت نشد');

    if (user.role === 'ADMIN' && role === 'CUSTOMER') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
      if (adminCount <= 1) {
        throw new AppError(400, 'حداقل یک ادمین باید در سیستم باقی بماند');
      }
    }

    return prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async createAdmin(data: { phone: string; firstName?: string; lastName?: string }) {
    const phone = normalizePhone(data.phone);

    const user = await prisma.user.upsert({
      where: { phone },
      update: {
        role: 'ADMIN',
        firstName: data.firstName ?? undefined,
        lastName: data.lastName ?? undefined,
        isActive: true,
      },
      create: {
        phone,
        role: 'ADMIN',
        firstName: data.firstName ?? 'ادمین',
        lastName: data.lastName ?? 'سیستم',
      },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return user;
  }

  async toggleActive(userId: string, actorId: string) {
    if (userId === actorId) {
      throw new AppError(400, 'نمی‌توانید حساب خودتان را غیرفعال کنید');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'کاربر یافت نشد');

    if (user.role === 'ADMIN' && user.isActive) {
      const activeAdmins = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true },
      });
      if (activeAdmins <= 1) {
        throw new AppError(400, 'حداقل یک ادمین فعال باید در سیستم باقی بماند');
      }
    }

    return prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }
}

export class DiscountService {
  async getAll(includeInactive = false) {
    return prisma.discount.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: { product: { select: { id: true, name: true, price: true, image: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    productId: string;
    percentage?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) throw new AppError(404, 'محصول یافت نشد');

    let discountPrice: number | null = product.discountPrice ? Number(product.discountPrice) : null;
    if (data.percentage) {
      const price = Number(product.price);
      discountPrice = Math.round(price * (1 - data.percentage / 100));
      await prisma.product.update({
        where: { id: data.productId },
        data: { discountPrice },
      });
    }

    return prisma.discount.create({ data, include: { product: true } });
  }

  async update(id: string, data: { percentage?: number; startDate?: Date; endDate?: Date; isActive?: boolean }) {
    const discount = await prisma.discount.findUnique({
      where: { id },
      include: { product: true },
    });
    if (!discount) throw new AppError(404, 'تخفیف یافت نشد');

    if (data.percentage !== undefined) {
      const price = Number(discount.product.price);
      const discountPrice = Math.round(price * (1 - data.percentage / 100));
      await prisma.product.update({
        where: { id: discount.productId },
        data: { discountPrice },
      });
    }

    return prisma.discount.update({ where: { id }, data, include: { product: true } });
  }

  async delete(id: string) {
    const discount = await prisma.discount.findUnique({ where: { id } });
    if (!discount) throw new AppError(404, 'تخفیف یافت نشد');
    await prisma.discount.update({ where: { id }, data: { isActive: false } });
  }
}

export const addressService = new AddressService();
export const customerService = new CustomerService();
export const adminUserService = new AdminUserService();
export const discountService = new DiscountService();
