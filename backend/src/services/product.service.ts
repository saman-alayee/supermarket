import prisma from '../config/database';
import { cacheGet, cacheSet, cacheDel } from '../config/redis';
import { AppError } from '../utils/errors';
import { slugify } from '../utils/helpers';

interface ProductFilters {
  categoryId?: string;
  categorySlug?: string;
  tagId?: string;
  search?: string;
  featured?: boolean;
  discounted?: boolean;
  isNew?: boolean;
  page?: number;
  limit?: number;
  includeInactive?: boolean;
}

const productInclude = {
  category: { select: { id: true, name: true, slug: true } },
  tag: { select: { id: true, name: true, slug: true, icon: true } },
  images: { orderBy: { sortOrder: 'asc' as const } },
};

function textContains(value: string) {
  return { contains: value };
}

function normalizeImages(images?: string[], image?: string | null): string[] {
  const list = (images?.length ? images : image ? [image] : [])
    .map((url) => url.trim())
    .filter(Boolean);
  return [...new Set(list)];
}

export class ProductService {
  async getAll(filters: ProductFilters = {}) {
    const {
      categoryId,
      categorySlug,
      tagId,
      search,
      featured,
      discounted,
      isNew,
      page = 1,
      limit = 20,
      includeInactive = false,
    } = filters;

    const where: Record<string, unknown> = {};

    if (!includeInactive) where.isActive = true;
    if (categoryId) where.categoryId = categoryId;
    if (tagId) where.tagId = tagId;
    if (categorySlug) {
      where.category = { slug: categorySlug };
    }
    if (featured) where.isFeatured = true;
    if (isNew) where.isNew = true;
    if (discounted) where.discountPrice = { not: null };
    if (search) {
      const term = search.trim();
      if (term) {
        where.OR = [
          { name: textContains(term) },
          { description: textContains(term) },
          { category: { name: textContains(term) } },
          { tag: { name: textContains(term) } },
        ];
      }
    }

    const cacheKey = `products:${JSON.stringify(filters)}`;
    const cached = await cacheGet<unknown>(cacheKey);
    if (cached) return cached;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    const result = {
      products: products.map((product) => this.formatProduct(product)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };

    await cacheSet(cacheKey, result, 300);
    return result;
  }

  async getBySlug(slug: string) {
    const product = await prisma.product.findUnique({
      where: { slug, isActive: true },
      include: {
        ...productInclude,
        discounts: { where: { isActive: true } },
      },
    });
    if (!product) throw new AppError(404, 'محصول یافت نشد');
    return this.formatProduct(product);
  }

  async getById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });
    if (!product) throw new AppError(404, 'محصول یافت نشد');
    return product;
  }

  async create(data: {
    name: string;
    description?: string;
    price: number;
    discountPrice?: number;
    stock: number;
    image?: string | null;
    images?: string[];
    unit?: string;
    categoryId: string;
    tagId?: string | null;
    isFeatured?: boolean;
    isNew?: boolean;
  }) {
    const { images, image, ...rest } = data;
    const imageList = normalizeImages(images, image);
    const slug = slugify(data.name) + '-' + Date.now().toString(36);

    const product = await prisma.product.create({
      data: {
        ...rest,
        slug,
        image: imageList[0] ?? null,
        images: {
          create: imageList.map((url, index) => ({ url, sortOrder: index })),
        },
      },
      include: productInclude,
    });

    await cacheDel('products:*');
    await cacheDel('home:*');
    return this.formatProduct(product);
  }

  async update(id: string, data: Record<string, unknown>) {
    const { images, image, ...rest } = data;
    const updateData: Record<string, unknown> = { ...rest };

    if (images !== undefined || image !== undefined) {
      const imageList = normalizeImages(
        images as string[] | undefined,
        image as string | null | undefined
      );

      await prisma.productImage.deleteMany({ where: { productId: id } });
      if (imageList.length) {
        await prisma.productImage.createMany({
          data: imageList.map((url, index) => ({ productId: id, url, sortOrder: index })),
        });
      }

      updateData.image = imageList[0] ?? null;
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: productInclude,
    });

    await cacheDel('products:*');
    await cacheDel('home:*');
    return this.formatProduct(product);
  }

  async delete(id: string) {
    await prisma.product.update({ where: { id }, data: { isActive: false } });
    await cacheDel('products:*');
    await cacheDel('home:*');
  }

  async getHomeSections() {
    const cacheKey = 'home:sections';
    const cached = await cacheGet<unknown>(cacheKey);
    if (cached) return cached;

    const [featured, discounted, newProducts] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true, isFeatured: true },
        include: productInclude,
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.findMany({
        where: { isActive: true, discountPrice: { not: null } },
        include: productInclude,
        take: 8,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.product.findMany({
        where: { isActive: true, isNew: true },
        include: productInclude,
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const result = {
      featured: featured.map((product) => this.formatProduct(product)),
      discounted: discounted.map((product) => this.formatProduct(product)),
      newProducts: newProducts.map((product) => this.formatProduct(product)),
    };

    await cacheSet(cacheKey, result, 300);
    return result;
  }

  async getHomeFeed() {
    const cacheKey = 'home:feed';
    const cached = await cacheGet<unknown>(cacheKey);
    if (cached) return cached;

    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    const feed = await Promise.all(
      categories.map(async (category) => {
        const products = await prisma.product.findMany({
          where: { categoryId: category.id, isActive: true },
          include: productInclude,
          take: 8,
          orderBy: { createdAt: 'desc' },
        });

        return {
          category: {
            id: category.id,
            name: category.name,
            slug: category.slug,
            image: category.image,
          },
          products: products.map((p) => this.formatProduct(p)),
        };
      })
    );

    const result = feed.filter((section) => section.products.length > 0);
    await cacheSet(cacheKey, result, 300);
    return result;
  }

  async getCategoryGroupedByTags(categorySlug: string) {
    const category = await prisma.category.findUnique({
      where: { slug: categorySlug, isActive: true },
    });
    if (!category) throw new AppError(404, 'دسته‌بندی یافت نشد');

    const tags = await prisma.tag.findMany({
      where: { categoryId: category.id },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const groups = await Promise.all(
      tags.map(async (tag) => {
        const products = await prisma.product.findMany({
          where: { tagId: tag.id, isActive: true },
          include: productInclude,
          orderBy: { createdAt: 'desc' },
        });
        return {
          tag,
          products: products.map((p) => this.formatProduct(p)),
        };
      })
    );

    const untagged = await prisma.product.findMany({
      where: { categoryId: category.id, tagId: null, isActive: true },
      include: productInclude,
      orderBy: { createdAt: 'desc' },
    });

    if (untagged.length) {
      groups.push({
        tag: {
          id: 'other',
          categoryId: category.id,
          name: 'سایر',
          slug: 'other',
          icon: null,
          sortOrder: 999,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        products: untagged.map((p) => this.formatProduct(p)),
      });
    }

    return { category, groups };
  }

  async getRelatedByTag(productSlug: string, limit = 8) {
    const product = await prisma.product.findUnique({
      where: { slug: productSlug, isActive: true },
      select: { id: true, tagId: true, categoryId: true },
    });
    if (!product) throw new AppError(404, 'محصول یافت نشد');

    const where: Record<string, unknown> = {
      isActive: true,
      id: { not: product.id },
    };

    if (product.tagId) {
      where.tagId = product.tagId;
    } else {
      where.categoryId = product.categoryId;
    }

    const related = await prisma.product.findMany({
      where,
      include: productInclude,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return related.map((p) => this.formatProduct(p));
  }

  formatProductPublic(product: Parameters<ProductService['formatProduct']>[0]) {
    return this.formatProduct(product);
  }

  private formatProduct(product: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    price: unknown;
    discountPrice: unknown | null;
    stock: number;
    image: string | null;
    unit: string | null;
    isActive: boolean;
    isFeatured: boolean;
    isNew: boolean;
    categoryId: string;
    tagId?: string | null;
    category?: { id: string; name: string; slug: string };
    tag?: { id: string; name: string; slug: string; icon: string | null } | null;
    images?: { url: string; sortOrder: number }[];
    createdAt: Date;
    updatedAt: Date;
  }) {
    const price = Number(product.price);
    const discountPrice = product.discountPrice ? Number(product.discountPrice) : null;
    const effectivePrice = discountPrice ?? price;
    const discountPercent =
      discountPrice && price > 0 ? Math.round(((price - discountPrice) / price) * 100) : 0;
    const imageUrls = product.images?.map((item) => item.url) ?? [];
    const images = imageUrls.length ? imageUrls : product.image ? [product.image] : [];
    const primaryImage = images[0] ?? null;

    return {
      ...product,
      image: primaryImage,
      images,
      price,
      discountPrice,
      effectivePrice,
      discountPercent,
      inStock: product.stock > 0,
    };
  }
}

export const productService = new ProductService();
