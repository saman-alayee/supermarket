import { config } from '../config';
import { AppError } from '../utils/errors';

const FARAZSMS_PATTERN_URL = 'https://api.iranpayamak.com/ws/v1/sms/pattern';
const FARAZSMS_SIMPLE_URL = 'https://api.iranpayamak.com/ws/v1/sms/simple';

interface FarazSmsPatternPayload {
  code: string;
  attributes: Record<string, string>;
  recipient: string;
  line_number: string;
  number_format: 'english' | 'persian';
  schedule?: string | null;
}

interface FarazSmsSimplePayload {
  text: string;
  line_number: string;
  recipients: string[];
  number_format: 'english' | 'persian';
  schedule?: string | null;
}

interface FarazSmsResponse {
  status?: string | number;
  message?: string;
  data?: unknown;
}

export class SmsService {
  isConfigured(): boolean {
    const { apiKey, lineNumber } = config.sms.farazsms;
    return Boolean(apiKey && lineNumber);
  }

  private formatRecipient(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('98') && digits.length === 12) {
      return `0${digits.slice(2)}`;
    }
    if (digits.startsWith('9') && digits.length === 10) {
      return `0${digits}`;
    }
    return digits.startsWith('0') ? digits : phone;
  }

  private async sendPattern(
    patternCode: string,
    attributes: Record<string, string>,
    recipient: string
  ): Promise<void> {
    const { apiKey, lineNumber, numberFormat } = config.sms.farazsms;

    const payload: FarazSmsPatternPayload = {
      code: patternCode,
      attributes,
      recipient: this.formatRecipient(recipient),
      line_number: lineNumber,
      number_format: numberFormat,
      schedule: null,
    };

    await this.postJson(FARAZSMS_PATTERN_URL, payload);
  }

  private async sendSimpleText(recipient: string, text: string): Promise<void> {
    const { lineNumber, numberFormat } = config.sms.farazsms;

    const payload: FarazSmsSimplePayload = {
      text,
      line_number: lineNumber,
      recipients: [this.formatRecipient(recipient)],
      number_format: numberFormat,
      schedule: null,
    };

    await this.postJson(FARAZSMS_SIMPLE_URL, payload);
  }

  private async postJson(url: string, payload: object): Promise<void> {
    const { apiKey } = config.sms.farazsms;

    if (!apiKey) {
      throw new AppError(503, 'سرویس پیامک پیکربندی نشده است', 'SMS_NOT_CONFIGURED');
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Api-Key': apiKey,
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('FarazSMS request failed:', error);
      throw new AppError(502, 'ارسال پیامک با خطا مواجه شد', 'SMS_REQUEST_FAILED');
    }

    const bodyText = await response.text();
    let body: FarazSmsResponse = {};
    if (bodyText) {
      try {
        body = JSON.parse(bodyText) as FarazSmsResponse;
      } catch {
        body = { message: bodyText };
      }
    }

    if (response.status === 401) {
      throw new AppError(503, 'پیکربندی سرویس پیامک نامعتبر است', 'SMS_UNAUTHORIZED');
    }

    if (!response.ok || body.status === 'error') {
      console.error('FarazSMS error:', response.status, body);
      throw new AppError(502, body.message || 'ارسال پیامک ناموفق بود', 'SMS_SEND_FAILED');
    }
  }

  /** Send OTP via FarazSMS pattern API (fast delivery, suitable for OTP). */
  async sendOtp(recipient: string, otpCode: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new AppError(
        503,
        'سرویس پیامک پیکربندی نشده است. لطفاً بعداً دوباره تلاش کنید.',
        'SMS_NOT_CONFIGURED'
      );
    }

    const { patternCode, otpAttribute } = config.sms.farazsms;
    if (!patternCode) {
      throw new AppError(503, 'الگوی پیامک OTP پیکربندی نشده است', 'SMS_NOT_CONFIGURED');
    }

    await this.sendPattern(patternCode, { [otpAttribute]: otpCode }, recipient);

    if (config.nodeEnv !== 'production') {
      console.log(`📱 OTP SMS queued for ${this.formatRecipient(recipient)}`);
    }
  }

  /** Notify customer when order is packed / handed to courier. */
  async sendOrderPacked(recipient: string, orderNumber: string): Promise<void> {
    const formatted = this.formatRecipient(recipient);
    const { packedPatternCode, orderAttribute } = config.sms.farazsms;

    if (!this.isConfigured()) {
      console.log(`📱 [SMS stub] Order packed: ${orderNumber} -> ${formatted}`);
      return;
    }

    if (packedPatternCode) {
      await this.sendPattern(packedPatternCode, { [orderAttribute]: orderNumber }, formatted);
      return;
    }

    await this.sendSimpleText(
      formatted,
      `سفارش ${orderNumber} آماده تحویل به پیک شد.\nKIAA KALA`
    );
  }

  /** Notify customer when courier is on the way. */
  async sendOrderShipped(recipient: string, orderNumber: string): Promise<void> {
    const formatted = this.formatRecipient(recipient);
    const { shippedPatternCode, orderAttribute } = config.sms.farazsms;

    if (!this.isConfigured()) {
      console.log(`📱 [SMS stub] Order shipped: ${orderNumber} -> ${formatted}`);
      return;
    }

    if (shippedPatternCode) {
      await this.sendPattern(shippedPatternCode, { [orderAttribute]: orderNumber }, formatted);
      return;
    }

    await this.sendSimpleText(
      formatted,
      `پیک کیاکال حرکت کرد و به زودی به آدرس شما می‌رسد.\nسفارش: ${orderNumber}`
    );
  }

  /** Notify store operators about a brand-new order (uses admin settings). */
  async notifyOperatorsNewOrder(orderNumber: string, customerName: string): Promise<void> {
    try {
      const { settingsService } = await import('./settings.service');
      const { enabled, phones, messageTemplate } =
        await settingsService.resolveNewOrderSmsRecipients();
      if (!enabled || !phones.length) return;

      const text = messageTemplate
        .split('{orderNumber}')
        .join(orderNumber)
        .split('{customerName}')
        .join(customerName);

      await this.broadcast(phones, text);
    } catch (error) {
      console.error('Failed to notify operators of new order:', error);
    }
  }

  /** Broadcast message to multiple recipients. */
  async broadcast(recipients: string[], message: string): Promise<{ queued: number }> {
    const formatted = recipients.map((r) => this.formatRecipient(r));
    if (!this.isConfigured()) {
      console.log(`📱 [SMS stub] Broadcast to ${formatted.length}: ${message.slice(0, 80)}`);
      return { queued: formatted.length };
    }

    const { lineNumber, numberFormat } = config.sms.farazsms;
    await this.postJson(FARAZSMS_SIMPLE_URL, {
      text: message,
      line_number: lineNumber,
      recipients: formatted,
      number_format: numberFormat,
      schedule: null,
    });

    return { queued: formatted.length };
  }
}

export const smsService = new SmsService();
