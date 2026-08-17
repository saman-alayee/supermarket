import prisma from '../config/database';
import { AppError } from '../utils/errors';
import { productService } from './product.service';

export class FavoriteService {
  async list(userId: string) {
    const favorites = await prisma.favorite.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
            images: { orderBy: { sortOrder: 'asc' } },
            tag: { select: { id: true, name: true, slug: true, icon: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return favorites.map((f) => ({
      id: f.id,
      productId: f.productId,
      createdAt: f.createdAt,
      product: productService.formatProductPublic(f.product),
    }));
  }

  async toggle(userId: string, productId: string) {
    const product = await prisma.product.findFirst({ where: { id: productId, isActive: true } });
    if (!product) throw new AppError(404, 'محصول یافت نشد');

    const existing = await prisma.favorite.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      return { favorited: false };
    }

    await prisma.favorite.create({ data: { userId, productId } });
    return { favorited: true };
  }

  async remove(userId: string, productId: string) {
    await prisma.favorite.deleteMany({ where: { userId, productId } });
  }

  async getIds(userId: string) {
    const rows = await prisma.favorite.findMany({
      where: { userId },
      select: { productId: true },
    });
    return rows.map((r) => r.productId);
  }
}

export const favoriteService = new FavoriteService();
