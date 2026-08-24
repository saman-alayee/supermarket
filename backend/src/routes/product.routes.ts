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
  '/home-feed',
  asyncHandler(async (_req, res) => {
    const feed = await productService.getHomeFeed();
    successResponse(res, feed);
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const {
      categoryId,
      category,
      tagId,
      ids,
      search,
      featured,
      discounted,
      isNew,
      page,
      limit,
    } = req.query;

    const idList = typeof ids === 'string'
      ? ids.split(',').map((id) => id.trim()).filter(Boolean)
      : undefined;

    const parsedLimit = limit ? parseInt(limit as string) : idList?.length || 20;
    const result = await productService.getAll({
      categoryId: categoryId as string,
      categorySlug: category as string,
      tagId: (tagId as string) || (req.query.tag as string),
      ids: idList,
      search: search as string,
      featured: featured === 'true',
      discounted: discounted === 'true',
      isNew: isNew === 'true',
      page: page ? parseInt(page as string) : 1,
      limit: Math.min(parsedLimit, idList?.length ? 100 : 50),
    });
    successResponse(res, result);
  })
);

router.get(
  '/category/:slug/by-tags',
  asyncHandler(async (req, res) => {
    const grouped = await productService.getCategoryGroupedByTags(paramId(req.params.slug));
    successResponse(res, grouped);
  })
);

router.get(
  '/:slug/related',
  asyncHandler(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 8;
    const related = await productService.getRelatedByTag(paramId(req.params.slug), limit);
    successResponse(res, related);
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
