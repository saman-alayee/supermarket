import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  otp: {
    expiresMinutes: parseInt(process.env.OTP_EXPIRES_MINUTES || '5', 10),
    devMode: process.env.OTP_DEV_MODE === 'true',
  },
  sms: {
    farazsms: {
      apiKey: process.env.FARAZSMS_API_KEY || '',
      patternCode: process.env.FARAZSMS_PATTERN_CODE || '',
      lineNumber: process.env.FARAZSMS_LINE_NUMBER || '',
      numberFormat: (process.env.FARAZSMS_NUMBER_FORMAT || 'english') as 'english' | 'persian',
      /** Must match the variable name defined in your FarazSMS pattern (e.g. code, var1). */
      otpAttribute: process.env.FARAZSMS_OTP_ATTRIBUTE || 'code',
      shippedPatternCode: process.env.FARAZSMS_SHIPPED_PATTERN_CODE || '',
      packedPatternCode: process.env.FARAZSMS_PACKED_PATTERN_CODE || '',
      orderAttribute: process.env.FARAZSMS_ORDER_ATTRIBUTE || 'orderNumber',
    },
  },
  upload: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),
  },
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  adminPhone: process.env.ADMIN_PHONE || '09120000000',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin1234',
  neshanApiKey: process.env.NESHAN_API_KEY || '',
};
