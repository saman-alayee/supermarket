import { Router } from 'express';
import { tagService } from '../services/tag.service';
import { productService } from '../services/product.service';
import { asyncHandler, successResponse } from '../utils/errors';
import { paramId } from '../utils/params';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const categoryId = req.query.categoryId as string | undefined;
    const tags = await tagService.getAll(categoryId);
    successResponse(res, tags);
  })
);

router.get(
  '/category/:slug',
  asyncHandler(async (req, res) => {
    const slug = paramId(req.params.slug);
    const grouped = await productService.getCategoryGroupedByTags(slug);
    successResponse(res, grouped);
  })
);

export default router;
