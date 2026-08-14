import { Router } from 'express';
import { z } from 'zod';
import type { OrderStatus } from '../services/order.service';
import { categoryService } from '../services/category.service';
import { productService } from '../services/product.service';
import { orderService } from '../services/order.service';
import { customerService, discountService, adminUserService } from '../services/user.service';
import { couponService } from '../services/coupon.service';
import { contentService } from '../services/content.service';
import { asyncHandler, successResponse, validate } from '../utils/errors';
import { authenticate, requireAdmin } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { paramId } from '../utils/params';

const router = Router();

router.use(authenticate, requireAdmin);

// Dashboard stats
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const orderStats = await orderService.getOrderStats();
    const productCount = await productService.getAll({ includeInactive: true, limit: 1 }) as { pagination: { total: number } };
    const categories = await categoryService.getAll(true) as unknown[];
    successResponse(res, {
      orders: orderStats,
      products: productCount.pagination.total,
      categories: categories.length,
    });
  })
);

// Categories
const categorySchema = z.object({
  name: z.string().min(2),
  image: z.string().optional().nullable(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
});

router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await categoryService.getAll(true);
    successResponse(res, categories);
  })
);

router.post(
  '/categories',
  validate(categorySchema),
  asyncHandler(async (req, res) => {
    const category = await categoryService.create(req.body);
    successResponse(res, category, 'دسته‌بندی ایجاد شد', 201);
  })
);

router.put(
  '/categories/:id',
  validate(categorySchema.partial()),
  asyncHandler(async (req, res) => {
    const category = await categoryService.update(paramId(req.params.id), req.body);
    successResponse(res, category, 'دسته‌بندی به‌روزرسانی شد');
  })
);

router.delete(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    await categoryService.delete(paramId(req.params.id));
    successResponse(res, null, 'دسته‌بندی حذف شد');
  })
);

router.put(
  '/categories/reorder',
  asyncHandler(async (req, res) => {
    await categoryService.reorder(req.body.items);
    successResponse(res, null, 'ترتیب به‌روزرسانی شد');
  })
);

router.post(
  '/categories/upload',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'فایل تصویر الزامی است' });
      return;
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    successResponse(res, { url: imageUrl });
  })
);

// Products
const productSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.number().positive(),
  discountPrice: z.number().positive().optional().nullable(),
  stock: z.number().int().min(0),
  image: z.string().optional().nullable(),
  images: z.array(z.string()).optional(),
  unit: z.string().optional(),
  categoryId: z.string(),
  isFeatured: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const result = await productService.getAll({
      includeInactive: true,
      search: req.query.search as string,
      categoryId: req.query.categoryId as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    });
    successResponse(res, result);
  })
);

router.post(
  '/products',
  validate(productSchema),
  asyncHandler(async (req, res) => {
    const product = await productService.create(req.body);
    successResponse(res, product, 'محصول ایجاد شد', 201);
  })
);

router.put(
  '/products/:id',
  validate(productSchema.partial()),
  asyncHandler(async (req, res) => {
    const product = await productService.update(paramId(req.params.id), req.body);
    successResponse(res, product, 'محصول به‌روزرسانی شد');
  })
);

router.delete(
  '/products/:id',
  asyncHandler(async (req, res) => {
    await productService.delete(paramId(req.params.id));
    successResponse(res, null, 'محصول حذف شد');
  })
);

router.post(
  '/products/upload',
  upload.single('image'),
  asyncHandler(async (req, res, next) => {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'فایل تصویر الزامی است' });
      return;
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    successResponse(res, { url: imageUrl });
  })
);

// Orders
router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const result = await orderService.getAllOrders({
      status: req.query.status as OrderStatus,
      search: req.query.search as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    });
    successResponse(res, result);
  })
);

router.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    const order = await orderService.getOrderById(paramId(req.params.id));
    successResponse(res, order);
  })
);

router.put(
  '/orders/:id/status',
  asyncHandler(async (req, res) => {
    const { status, note } = req.body;
    const order = await orderService.updateStatus(paramId(req.params.id), status, note);
    successResponse(res, order, 'وضعیت سفارش به‌روزرسانی شد');
  })
);

// Customers & users
router.get(
  '/customers',
  asyncHandler(async (req, res) => {
    const result = await customerService.getAll(
      req.query.page ? parseInt(req.query.page as string) : 1,
      req.query.limit ? parseInt(req.query.limit as string) : 20,
      req.query.search as string,
      'CUSTOMER'
    );
    successResponse(res, result);
  })
);

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const result = await customerService.getAll(
      req.query.page ? parseInt(req.query.page as string) : 1,
      req.query.limit ? parseInt(req.query.limit as string) : 20,
      req.query.search as string,
      req.query.role as 'CUSTOMER' | 'ADMIN' | undefined
    );
    successResponse(res, result);
  })
);

router.post(
  '/users/admin',
  asyncHandler(async (req, res) => {
    const user = await adminUserService.createAdmin(req.body);
    successResponse(res, user, 'ادمین جدید اضافه شد', 201);
  })
);

router.put(
  '/users/:id/role',
  asyncHandler(async (req, res) => {
    const user = await adminUserService.updateRole(
      paramId(req.params.id),
      req.body.role,
      req.user!.userId
    );
    successResponse(res, user, 'نقش کاربر به‌روزرسانی شد');
  })
);

router.put(
  '/users/:id/toggle-active',
  asyncHandler(async (req, res) => {
    const user = await adminUserService.toggleActive(paramId(req.params.id), req.user!.userId);
    successResponse(res, user, 'وضعیت کاربر به‌روزرسانی شد');
  })
);

router.get(
  '/customers/frequent',
  asyncHandler(async (_req, res) => {
    const customers = await customerService.getFrequentCustomers();
    successResponse(res, customers);
  })
);

router.get(
  '/customers/:id',
  asyncHandler(async (req, res) => {
    const customer = await customerService.getById(paramId(req.params.id));
    successResponse(res, customer);
  })
);

// Discounts
const discountSchema = z.object({
  productId: z.string(),
  percentage: z.number().min(1).max(99).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

router.get(
  '/discounts',
  asyncHandler(async (_req, res) => {
    const discounts = await discountService.getAll(true);
    successResponse(res, discounts);
  })
);

router.post(
  '/discounts',
  validate(discountSchema),
  asyncHandler(async (req, res) => {
    const data = {
      ...req.body,
      startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
      endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
    };
    const discount = await discountService.create(data);
    successResponse(res, discount, 'تخفیف ایجاد شد', 201);
  })
);

router.put(
  '/discounts/:id',
  asyncHandler(async (req, res) => {
    const data = {
      ...req.body,
      startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
      endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
    };
    const discount = await discountService.update(paramId(req.params.id), data);
    successResponse(res, discount, 'تخفیف به‌روزرسانی شد');
  })
);

router.delete(
  '/discounts/:id',
  asyncHandler(async (req, res) => {
    await discountService.delete(paramId(req.params.id));
    successResponse(res, null, 'تخفیف حذف شد');
  })
);

// Coupon codes
const couponSchema = z.object({
  code: z.string().min(2),
  title: z.string().optional(),
  type: z.enum(['PERCENT', 'FIXED']),
  value: z.number().int().positive(),
  minPurchase: z.number().int().min(0).optional(),
  maxDiscount: z.number().int().positive().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  perUserLimit: z.number().int().positive().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

router.get(
  '/coupons',
  asyncHandler(async (_req, res) => {
    const coupons = await couponService.getAll(true);
    successResponse(res, coupons);
  })
);

router.post(
  '/coupons',
  validate(couponSchema),
  asyncHandler(async (req, res) => {
    const coupon = await couponService.create({
      ...req.body,
      startDate: req.body.startDate ? new Date(req.body.startDate) : null,
      endDate: req.body.endDate ? new Date(req.body.endDate) : null,
    });
    successResponse(res, coupon, 'کد تخفیف ایجاد شد', 201);
  })
);

router.put(
  '/coupons/:id',
  validate(couponSchema.partial()),
  asyncHandler(async (req, res) => {
    const coupon = await couponService.update(paramId(req.params.id), {
      ...req.body,
      startDate: req.body.startDate ? new Date(req.body.startDate) : req.body.startDate,
      endDate: req.body.endDate ? new Date(req.body.endDate) : req.body.endDate,
    });
    successResponse(res, coupon, 'کد تخفیف به‌روزرسانی شد');
  })
);

router.delete(
  '/coupons/:id',
  asyncHandler(async (req, res) => {
    await couponService.delete(paramId(req.params.id));
    successResponse(res, null, 'کد تخفیف غیرفعال شد');
  })
);

// Content pages
const contentSchema = z.object({
  slug: z.string().min(2),
  title: z.string().min(2),
  body: z.string().min(2),
  isPublished: z.boolean().optional(),
});

router.get(
  '/content',
  asyncHandler(async (_req, res) => {
    const pages = await contentService.getAll();
    successResponse(res, pages);
  })
);

router.put(
  '/content/:slug',
  asyncHandler(async (req, res) => {
    const slug = paramId(req.params.slug);
    const existing = await contentService.getBySlug(slug).catch(() => null);
    const page = await contentService.upsert({
      slug,
      title: req.body.title ?? existing?.title ?? slug,
      body: req.body.body ?? existing?.body ?? '',
      isPublished: req.body.isPublished ?? existing?.isPublished ?? true,
    });
    successResponse(res, page, 'صفحه ذخیره شد');
  })
);

export default router;
