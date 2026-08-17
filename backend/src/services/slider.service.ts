import prisma from '../config/database';
import { AppError } from '../utils/errors';
import { cacheDel, cacheGet, cacheSet } from '../config/redis';

type SliderPlacement = 'HOME_TOP' | 'HOME_MID';

export class SliderService {
  async getPublic(placement?: SliderPlacement) {
    const cacheKey = `sliders:${placement || 'all'}`;
    const cached = await cacheGet<unknown>(cacheKey);
    if (cached) return cached;

    const sliders = await prisma.slider.findMany({
      where: {
        isActive: true,
        ...(placement ? { placement } : {}),
      },
      orderBy: { sortOrder: 'asc' },
      take: 4,
    });

    await cacheSet(cacheKey, sliders, 300);
    return sliders;
  }

  async getAll() {
    return prisma.slider.findMany({ orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }] });
  }

  async getById(id: string) {
    const slider = await prisma.slider.findUnique({ where: { id } });
    if (!slider) throw new AppError(404, 'اسلایدر یافت نشد');
    return slider;
  }

  async create(data: {
    title: string;
    image: string;
    linkUrl?: string;
    sortOrder?: number;
    placement?: SliderPlacement;
    isActive?: boolean;
  }) {
    const slider = await prisma.slider.create({ data });
    await cacheDel('sliders:*');
    return slider;
  }

  async update(id: string, data: Record<string, unknown>) {
    const slider = await prisma.slider.update({ where: { id }, data });
    await cacheDel('sliders:*');
    return slider;
  }

  async delete(id: string) {
    await prisma.slider.delete({ where: { id } });
    await cacheDel('sliders:*');
  }
}

export const sliderService = new SliderService();
