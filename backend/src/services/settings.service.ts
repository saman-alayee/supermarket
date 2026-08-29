import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { config } from '../config';
import { SITE_NAME } from '../config/site';
import { AppError } from '../utils/errors';
import { normalizePhone } from '../utils/normalize';

export const NEW_ORDER_SMS_KEY = 'new_order_sms';

export const DEFAULT_NEW_ORDER_SMS_TEMPLATE =
  `سفارش جدید {orderNumber}\nمشتری: {customerName}\n${SITE_NAME}`;

export interface NewOrderSmsSettings {
  /** When false, no operator SMS is sent on new orders. */
  enabled: boolean;
  /** Explicit recipient phones (09xxxxxxxxx). */
  phones: string[];
  /** Also SMS active ADMIN / SUPERVISOR / STAFF accounts. */
  includePanelStaff: boolean;
  /** Placeholders: {orderNumber} {customerName} */
  messageTemplate: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePhones(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const phones: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string' || !item.trim()) continue;
    try {
      phones.push(normalizePhone(item.trim()));
    } catch {
      // skip invalid
    }
  }
  return [...new Set(phones)];
}

function normalizeSettings(raw: unknown): NewOrderSmsSettings {
  const data = isRecord(raw) ? raw : {};
  const template =
    typeof data.messageTemplate === 'string' && data.messageTemplate.trim()
      ? data.messageTemplate.trim()
      : DEFAULT_NEW_ORDER_SMS_TEMPLATE;

  return {
    enabled: data.enabled !== false,
    phones: parsePhones(data.phones),
    includePanelStaff: data.includePanelStaff === true,
    messageTemplate: template,
  };
}

function defaultSettings(): NewOrderSmsSettings {
  return {
    enabled: true,
    phones: [...config.adminPhones],
    includePanelStaff: false,
    messageTemplate: DEFAULT_NEW_ORDER_SMS_TEMPLATE,
  };
}

export class SettingsService {
  async getNewOrderSms(): Promise<NewOrderSmsSettings> {
    const row = await prisma.appSetting.findUnique({ where: { key: NEW_ORDER_SMS_KEY } });
    if (!row) return defaultSettings();
    return normalizeSettings(row.value);
  }

  async updateNewOrderSms(input: Partial<NewOrderSmsSettings>): Promise<NewOrderSmsSettings> {
    const current = await this.getNewOrderSms();

    let phones = current.phones;
    if (input.phones !== undefined) {
      phones = [];
      for (const phone of input.phones) {
        try {
          phones.push(normalizePhone(String(phone).trim()));
        } catch {
          throw new AppError(400, `شماره نامعتبر: ${phone}`);
        }
      }
      phones = [...new Set(phones)];
    }

    const next: NewOrderSmsSettings = {
      enabled: input.enabled ?? current.enabled,
      phones,
      includePanelStaff: input.includePanelStaff ?? current.includePanelStaff,
      messageTemplate:
        typeof input.messageTemplate === 'string' && input.messageTemplate.trim()
          ? input.messageTemplate.trim()
          : current.messageTemplate,
    };

    if (next.enabled && !next.phones.length && !next.includePanelStaff) {
      throw new AppError(400, 'حداقل یک شماره گیرنده یا ارسال به پرسنل پنل را فعال کنید');
    }

    await prisma.appSetting.upsert({
      where: { key: NEW_ORDER_SMS_KEY },
      create: { key: NEW_ORDER_SMS_KEY, value: next as unknown as Prisma.InputJsonValue },
      update: { value: next as unknown as Prisma.InputJsonValue },
    });

    return next;
  }

  async resolveNewOrderSmsRecipients(): Promise<{
    enabled: boolean;
    phones: string[];
    messageTemplate: string;
  }> {
    const settings = await this.getNewOrderSms();
    if (!settings.enabled) {
      return { enabled: false, phones: [], messageTemplate: settings.messageTemplate };
    }

    const phones = [...settings.phones];

    if (settings.includePanelStaff) {
      const staff = await prisma.user.findMany({
        where: {
          role: { in: ['ADMIN', 'SUPERVISOR', 'STAFF'] },
          isActive: true,
        },
        select: { phone: true },
      });
      for (const u of staff) phones.push(u.phone);
    }

    return {
      enabled: true,
      phones: [...new Set(phones)],
      messageTemplate: settings.messageTemplate,
    };
  }

  async sendNewOrderSmsTest(input: {
    phone: string;
    messageTemplate?: string;
  }): Promise<{ phone: string; preview: string; stub: boolean }> {
    let phone: string;
    try {
      phone = normalizePhone(String(input.phone).trim());
    } catch {
      throw new AppError(400, 'شماره موبایل نامعتبر است');
    }

    const settings = await this.getNewOrderSms();
    const template =
      typeof input.messageTemplate === 'string' && input.messageTemplate.trim()
        ? input.messageTemplate.trim()
        : settings.messageTemplate;

    const preview = `[تست] ${template
      .split('{orderNumber}')
      .join('KK-TEST-001')
      .split('{customerName}')
      .join('مشتری تست')}`;

    const { smsService } = await import('./sms.service');
    const stub = !smsService.isConfigured();
    await smsService.broadcast([phone], preview);

    return { phone, preview, stub };
  }
}

export const settingsService = new SettingsService();
