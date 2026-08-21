<script setup lang="ts">
import type { Category, Product, Slider, HomeCategorySection } from '~/types';

const api = useApi();
const route = useRoute();

const { data: categories } = await useAsyncData('categories', async () => {
  const { data } = await api.get<Category[]>('/categories');
  return data;
});

const { data: topSliders } = await useAsyncData('sliders-top', async () => {
  try {
    const { data } = await api.get<Slider[]>('/sliders?placement=HOME_TOP');
    return data.filter((item) => item.isActive);
  } catch {
    return [] as Slider[];
  }
});

const { data: midSliders } = await useAsyncData('sliders-mid', async () => {
  try {
    const { data } = await api.get<Slider[]>('/sliders?placement=HOME_MID');
    return data.filter((item) => item.isActive);
  } catch {
    return [] as Slider[];
  }
});

const featuredProducts = ref<Product[]>([]);
const discountedProducts = ref<Product[]>([]);
const categorySections = ref<HomeCategorySection[]>([]);
const sectionsLoading = ref(true);

async function loadHomeSections() {
  sectionsLoading.value = true;
  try {
    const [featuredRes, discountedRes, feedRes] = await Promise.all([
      api.get<{ products: Product[] }>('/products?featured=true&limit=10').catch(() => ({ data: { products: [] } })),
      api.get<{ products: Product[] }>('/products?discounted=true&limit=10').catch(() => ({ data: { products: [] } })),
      api.get<HomeCategorySection[]>('/products/home-feed').catch(() => ({ data: [] as HomeCategorySection[] })),
    ]);
    featuredProducts.value = featuredRes.data.products;
    discountedProducts.value = discountedRes.data.products;
    categorySections.value = feedRes.data;
  } finally {
    sectionsLoading.value = false;
  }
}

onMounted(loadHomeSections);

const sectionAnchors = {
  featured: 'home-featured',
  discounted: 'home-discounted',
} as const;

watch(
  () => route.query.section,
  (section) => {
    const key = section as keyof typeof sectionAnchors | undefined;
    if (!key || !sectionAnchors[key]) return;
    nextTick(() => {
      document.getElementById(sectionAnchors[key])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  },
  { immediate: true }
);

useHead({ title: 'KIAA KALA - فروشگاه اینترنتی' });
</script>

<template>
  <div class="pb-6">
    <PromoSlider
      v-if="topSliders?.length"
      :sliders="topSliders"
      aspect-class="aspect-[2.2/1] max-h-[140px] sm:max-h-[170px] md:max-h-[190px]"
      compact
    />

    <section v-if="categories?.length" class="px-4 py-4">
      <div class="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
        <CategoryCard
          v-for="category in categories"
          :key="category.id"
          :category="category"
          size="lg"
        />
      </div>
    </section>

    <section
      v-if="discountedProducts.length"
      id="home-discounted"
      class="px-4 py-3 scroll-mt-20"
    >
      <div class="flex items-center justify-between mb-3">
        <h2 class="section-title mb-0">پیشنهاد ویژه و تخفیف‌دار</h2>
        <NuxtLink to="/search?discounted=1" class="text-sm text-primary-600 font-medium">مشاهده همه</NuxtLink>
      </div>
      <div class="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
        <div
          v-for="product in discountedProducts"
          :key="product.id"
          class="w-[30%] min-w-[108px] sm:w-[22%] md:w-[16%] shrink-0"
        >
          <ProductCard :product="product" />
        </div>
      </div>
    </section>

    <section
      v-if="featuredProducts.length"
      id="home-featured"
      class="px-4 py-3 scroll-mt-20"
    >
      <div class="flex items-center justify-between mb-3">
        <h2 class="section-title mb-0">محصولات ویژه</h2>
        <NuxtLink to="/search?featured=1" class="text-sm text-primary-600 font-medium">مشاهده همه</NuxtLink>
      </div>
      <div class="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
        <div
          v-for="product in featuredProducts"
          :key="product.id"
          class="w-[30%] min-w-[108px] sm:w-[22%] md:w-[16%] shrink-0"
        >
          <ProductCard :product="product" />
        </div>
      </div>
    </section>

    <LoadingSpinner :show="sectionsLoading" />

    <template v-for="(section, index) in categorySections" :key="section.category.id">
      <section class="px-4 py-3">
        <div class="flex items-center justify-between mb-3">
          <h2 class="section-title mb-0">{{ section.category.name }}</h2>
          <NuxtLink
            :to="`/categories/${section.category.slug}`"
            class="text-sm text-primary-600 font-medium inline-flex items-center gap-1"
          >
            مشاهده همه
            <AppIcon name="lucide:chevron-left" size="sm" />
          </NuxtLink>
        </div>

        <div class="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
          <div
            v-for="product in section.products.slice(0, 10)"
            :key="product.id"
            class="w-[30%] min-w-[108px] sm:w-[22%] md:w-[16%] shrink-0"
          >
            <ProductCard :product="product" />
          </div>
        </div>
      </section>

      <PromoSlider
        v-if="midSliders?.length && (index + 1) % 2 === 0 && index < categorySections.length - 1"
        :sliders="midSliders"
        aspect-class="aspect-[16/7] max-h-[120px] sm:max-h-[140px]"
        compact
      />
    </template>

    <EmptyState
      v-if="!sectionsLoading && !categorySections.length && !featuredProducts.length && !discountedProducts.length"
      message="محصولی برای نمایش وجود ندارد"
    />
  </div>
</template>
