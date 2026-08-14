import { Router } from 'express';
import { z } from 'zod';
import { orderService } from '../services/order.service';
import { asyncHandler, successResponse, validate } from '../utils/errors';
import { authenticate, sessionMiddleware } from '../middleware/auth';
import { paramId } from '../utils/params';

const router = Router();

const createOrderSchema = z.object({
  customerName: z.string().min(3, 'نام و نام خانوادگی الزامی است'),
  customerPhone: z.string().min(10, 'شماره موبایل الزامی است'),
  deliveryAddress: z.string().min(5, 'آدرس ارسال الزامی است'),
  addressId: z.string().min(1, 'انتخاب آدرس تحویل الزامی است'),
  addressTitle: z.string().optional(),
  deliveryLatitude: z.coerce.number().min(-90).max(90).optional(),
  deliveryLongitude: z.coerce.number().min(-180).max(180).optional(),
  notes: z.string().optional(),
  couponCode: z.string().optional(),
});

router.use(sessionMiddleware);

router.post(
  '/',
  authenticate,
  validate(createOrderSchema),
  asyncHandler(async (req, res) => {
    const order = await orderService.createOrder(
      req.body,
      req.user!.userId,
      req.sessionId
    );
    successResponse(res, order, 'سفارش با موفقیت ثبت شد', 201);
  })
);

router.get(
  '/track/:orderNumber',
  asyncHandler(async (req, res) => {
    const order = await orderService.getOrderByNumber(paramId(req.params.orderNumber));
    successResponse(res, order);
  })
);

router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const orders = await orderService.getUserOrders(req.user!.userId, page);
    successResponse(res, orders);
  })
);

router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const order = await orderService.getOrderById(paramId(req.params.id), req.user!.userId);
    successResponse(res, order);
  })
);

export default router;
