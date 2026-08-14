import prisma from '../config/database';
import { config } from '../config';
import { generateOtpCode, generateToken } from '../utils/helpers';
import { AppError } from '../utils/errors';
import { normalizeDigits, normalizePhone } from '../utils/normalize';
import { smsService } from './sms.service';

export type UserRole = 'CUSTOMER' | 'ADMIN';

export class AuthService {
  async sendOtp(phone: string) {
    const normalizedPhone = this.normalizePhone(phone);

    const code = config.otp.devMode ? '123456' : generateOtpCode();
    const expiresAt = new Date(Date.now() + config.otp.expiresMinutes * 60 * 1000);

    if (config.otp.devMode) {
      console.log(`📱 OTP for ${normalizedPhone}: ${code}`);
    } else {
      await smsService.sendOtp(normalizedPhone, code);
    }

    await prisma.otpCode.create({
      data: { phone: normalizedPhone, code, expiresAt },
    });

    return { message: 'کد تأیید ارسال شد', devCode: config.otp.devMode ? code : undefined };
  }

  async verifyOtp(phone: string, code: string) {
    const normalizedPhone = this.normalizePhone(phone);
    const normalizedCode = normalizeDigits(code).trim();

    const otpRecord = await prisma.otpCode.findFirst({
      where: {
        phone: normalizedPhone,
        code: normalizedCode,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new AppError(400, 'کد تأیید نامعتبر یا منقضی شده است');
    }

    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    const user = await this.findOrCreateUser(normalizedPhone);
    return this.buildAuthResponse(user);
  }

  async loginWithPassword(phone: string, password: string) {
    const normalizedPhone = this.normalizePhone(phone);

    if (password !== config.adminPassword) {
      throw new AppError(401, 'شماره موبایل یا رمز عبور اشتباه است');
    }

    const user = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
    if (!user || user.role !== 'ADMIN') {
      throw new AppError(401, 'شماره موبایل یا رمز عبور اشتباه است');
    }
    if (!user.isActive) {
      throw new AppError(403, 'حساب کاربری غیرفعال است');
    }

    return this.buildAuthResponse(user);
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        addresses: { orderBy: { isDefault: 'desc' } },
        _count: { select: { orders: true } },
      },
    });

    if (!user) throw new AppError(404, 'کاربر یافت نشد');
    return user;
  }

  async updateProfile(userId: string, data: { firstName?: string; lastName?: string }) {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });
  }

  private async findOrCreateUser(phone: string) {
    let user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      const isAdmin = phone === config.adminPhone;
      user = await prisma.user.create({
        data: {
          phone,
          role: isAdmin ? 'ADMIN' : 'CUSTOMER',
          firstName: isAdmin ? 'مدیر' : undefined,
          lastName: isAdmin ? 'سیستم' : undefined,
        },
      });
      return user;
    }

    if (phone === config.adminPhone && user.role !== 'ADMIN') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
      });
    }

    return user;
  }

  private buildAuthResponse(user: {
    id: string;
    phone: string;
    firstName: string | null;
    lastName: string | null;
    role: UserRole;
  }) {
    const token = generateToken({
      userId: user.id,
      phone: user.phone,
      role: user.role as UserRole,
    });

    return {
      token,
      user: {
        id: user.id,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  private normalizePhone(phone: string): string {
    try {
      return normalizePhone(phone);
    } catch {
      throw new AppError(400, 'شماره موبایل نامعتبر است');
    }
  }
}

export const authService = new AuthService();
