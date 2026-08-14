import { Router } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import { asyncHandler, successResponse, validate } from '../utils/errors';
import { authenticate } from '../middleware/auth';
import { authLimiter, otpLimiter } from '../middleware/rateLimit';

const router = Router();

const sendOtpSchema = z.object({
  phone: z.string().min(10, 'شماره موبایل نامعتبر است'),
});

const verifyOtpSchema = z.object({
  phone: z.string().min(10),
  code: z.string().min(4).max(6),
});

const loginPasswordSchema = z.object({
  phone: z.string().min(10, 'شماره موبایل نامعتبر است'),
  password: z.string().min(4, 'رمز عبور الزامی است'),
});

const updateProfileSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
});

router.post(
  '/send-otp',
  otpLimiter,
  validate(sendOtpSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.sendOtp(req.body.phone);
    successResponse(res, result, 'کد تأیید ارسال شد');
  })
);

router.post(
  '/verify-otp',
  authLimiter,
  validate(verifyOtpSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.verifyOtp(req.body.phone, req.body.code);
    successResponse(res, result, 'ورود موفق');
  })
);

router.post(
  '/login-password',
  authLimiter,
  validate(loginPasswordSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.loginWithPassword(req.body.phone, req.body.password);
    successResponse(res, result, 'ورود موفق');
  })
);

router.get(
  '/profile',
  authenticate,
  asyncHandler(async (req, res) => {
    const profile = await authService.getProfile(req.user!.userId);
    successResponse(res, profile);
  })
);

router.put(
  '/profile',
  authenticate,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const profile = await authService.updateProfile(req.user!.userId, req.body);
    successResponse(res, profile, 'پروفایل به‌روزرسانی شد');
  })
);

export default router;
