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

const setPasswordSchema = z.object({
  password: z.string().min(6, 'رمز عبور باید حداقل ۶ کاراکتر باشد'),
  currentPassword: z.string().min(1).optional(),
  otpCode: z.string().min(4).max(6).optional(),
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
  '/confirm-otp',
  authLimiter,
  validate(verifyOtpSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.confirmOtp(req.body.phone, req.body.code);
    successResponse(res, result, 'کد تأیید شد');
  })
);

/** Customer login with personal password */
router.post(
  '/login-password',
  authLimiter,
  validate(loginPasswordSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.loginWithPassword(req.body.phone, req.body.password);
    successResponse(res, result, 'ورود موفق');
  })
);

/** Admin-only password login */
router.post(
  '/admin/login-password',
  authLimiter,
  validate(loginPasswordSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.loginWithPassword(req.body.phone, req.body.password, {
      requireAdmin: true,
    });
    successResponse(res, result, 'ورود موفق');
  })
);

/** Admin-only OTP verify */
router.post(
  '/admin/verify-otp',
  authLimiter,
  validate(verifyOtpSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.verifyOtp(req.body.phone, req.body.code, {
      requireAdmin: true,
    });
    successResponse(res, result, 'ورود موفق');
  })
);

router.put(
  '/password',
  authenticate,
  validate(setPasswordSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.setPassword(req.user!.userId, req.body);
    successResponse(res, result, result.message);
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
