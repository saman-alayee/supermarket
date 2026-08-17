import prisma from '../config/database';
import { AppError } from '../utils/errors';
import { normalizePhone } from '../utils/normalize';
import { smsService } from './sms.service';

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
  async getAll(
    page = 1,
    limit = 20,
    search?: string,
    role?: 'CUSTOMER' | 'ADMIN',
    paymentMethod?: string,
    customerGroupId?: string
  ) {
    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (customerGroupId) where.customerGroupId = customerGroupId;
    if (search) {
      where.OR = [
        { phone: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ];
    }
    if (paymentMethod) {
      where.orders = { some: { paymentMethod } };
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
          customerGroupId: true,
          customerGroup: { select: { id: true, name: true } },
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

  async create(data: {
    phone: string;
    firstName?: string;
    lastName?: string;
    customerGroupId?: string;
  }) {
    const phone = normalizePhone(data.phone);

    return prisma.user.create({
      data: {
        phone,
        firstName: data.firstName,
        lastName: data.lastName,
        role: 'CUSTOMER',
        customerGroupId: data.customerGroupId,
      },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        customerGroupId: true,
        createdAt: true,
      },
    });
  }

  async assignGroup(userId: string, customerGroupId: string | null) {
    if (customerGroupId) {
      const group = await prisma.customerGroup.findUnique({ where: { id: customerGroupId } });
      if (!group) throw new AppError(404, 'گروه مشتری یافت نشد');
    }

    return prisma.user.update({
      where: { id: userId },
      data: { customerGroupId },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        customerGroupId: true,
        customerGroup: { select: { id: true, name: true } },
      },
    });
  }

  async exportPhonesCsv(role: 'CUSTOMER' | 'ADMIN' = 'CUSTOMER') {
    const users = await prisma.user.findMany({
      where: { role, isActive: true },
      select: { phone: true, firstName: true, lastName: true },
      orderBy: { createdAt: 'asc' },
    });

    const header = 'phone,firstName,lastName';
    const rows = users.map(
      (u) =>
        `${u.phone},"${(u.firstName ?? '').replace(/"/g, '""')}","${(u.lastName ?? '').replace(/"/g, '""')}"`
    );

    return [header, ...rows].join('\n');
  }

  async broadcastSms(message: string, role: 'CUSTOMER' | 'ADMIN' = 'CUSTOMER') {
    const users = await prisma.user.findMany({
      where: { role, isActive: true },
      select: { phone: true },
    });

    const recipients = users.map((u) => u.phone);
    return smsService.broadcast(recipients, message);
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
        customerGroupId: true,
        customerGroup: { select: { id: true, name: true } },
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

export class CustomerGroupService {
  async getAll() {
    return prisma.customerGroup.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true } } },
    });
  }

  async create(data: { name: string; description?: string }) {
    return prisma.customerGroup.create({ data });
  }

  async update(id: string, data: { name?: string; description?: string | null }) {
    return prisma.customerGroup.update({ where: { id }, data });
  }

  async delete(id: string) {
    await prisma.user.updateMany({ where: { customerGroupId: id }, data: { customerGroupId: null } });
    await prisma.customerGroup.delete({ where: { id } });
  }
}

export const addressService = new AddressService();
export const customerService = new CustomerService();
export const customerGroupService = new CustomerGroupService();
export const adminUserService = new AdminUserService();
export const discountService = new DiscountService();
