import { config } from '../config';
import { AppError } from '../utils/errors';

const FARAZSMS_PATTERN_URL = 'https://api.iranpayamak.com/ws/v1/sms/pattern';

interface FarazSmsPatternPayload {
  code: string;
  attributes: Record<string, string>;
  recipient: string;
  line_number: string;
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
    const { apiKey, patternCode, lineNumber } = config.sms.farazsms;
    return Boolean(apiKey && patternCode && lineNumber);
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

    const { apiKey, patternCode, lineNumber, numberFormat, otpAttribute } = config.sms.farazsms;

    const payload: FarazSmsPatternPayload = {
      code: patternCode,
      attributes: {
        [otpAttribute]: otpCode,
      },
      recipient: this.formatRecipient(recipient),
      line_number: lineNumber,
      number_format: numberFormat,
      schedule: null,
    };

    let response: Response;
    try {
      response = await fetch(FARAZSMS_PATTERN_URL, {
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

    if (!response.ok) {
      console.error('FarazSMS error:', response.status, body);
      throw new AppError(
        502,
        body.message || 'ارسال پیامک ناموفق بود',
        'SMS_SEND_FAILED'
      );
    }

    if (config.nodeEnv !== 'production') {
      console.log(`📱 OTP SMS queued for ${payload.recipient}`);
    }
  }

  /** 09xxxxxxxxx — no +98 prefix per FarazSMS docs. */
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
}

export const smsService = new SmsService();
