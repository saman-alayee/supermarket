import { Router } from 'express';
import { productService } from '../services/product.service';
import { asyncHandler, successResponse } from '../utils/errors';
import { paramId } from '../utils/params';

const router = Router();

router.get(
  '/home',
  asyncHandler(async (_req, res) => {
    const sections = await productService.getHomeSections();
    successResponse(res, sections);
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const {
      categoryId,
      category,
      search,
      featured,
      discounted,
      isNew,
      page,
      limit,
    } = req.query;

    const result = await productService.getAll({
      categoryId: categoryId as string,
      categorySlug: category as string,
      search: search as string,
      featured: featured === 'true',
      discounted: discounted === 'true',
      isNew: isNew === 'true',
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });
    successResponse(res, result);
  })
);

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const product = await productService.getBySlug(paramId(req.params.slug));
    successResponse(res, product);
  })
);

export default router;
