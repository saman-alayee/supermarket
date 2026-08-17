<script setup lang="ts">
import type { Category, Product, Slider, HomeCategorySection } from '~/types';

const api = useApi();

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

const categorySections = ref<HomeCategorySection[]>([]);
const sectionsLoading = ref(true);

async function loadCategorySections() {
  if (!categories.value?.length) {
    categorySections.value = [];
    sectionsLoading.value = false;
    return;
  }

  sectionsLoading.value = true;
  try {
    const results = await Promise.all(
      categories.value.map(async (category) => {
        try {
          const { data } = await api.get<{ products: Product[] }>(
            `/products?category=${category.slug}&limit=8`
          );
          return { category, products: data.products };
        } catch {
          return { category, products: [] as Product[] };
        }
      })
    );
    categorySections.value = results.filter((section) => section.products.length > 0);
  } finally {
    sectionsLoading.value = false;
  }
}

watch(categories, loadCategorySections, { immediate: true });

useHead({ title: 'KIAA KALA - فروشگاه اینترنتی' });
</script>

<template>
  <div class="pb-6">
    <PromoSlider v-if="topSliders?.length" :sliders="topSliders" />

    <section v-if="categories?.length" class="px-4 py-5">
      <div class="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
        <CategoryCard
          v-for="category in categories"
          :key="category.id"
          :category="category"
          size="lg"
        />
      </div>
    </section>

    <LoadingSpinner :show="sectionsLoading" />

    <template v-for="(section, index) in categorySections" :key="section.category.id">
      <section class="px-4 py-4">
        <div class="flex items-center justify-between mb-4">
          <h2 class="section-title mb-0">{{ section.category.name }}</h2>
          <NuxtLink
            :to="`/categories/${section.category.slug}`"
            class="text-sm text-primary-600 font-medium inline-flex items-center gap-1"
          >
            مشاهده همه
            <AppIcon name="lucide:chevron-left" size="sm" />
          </NuxtLink>
        </div>

        <div class="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
          <div
            v-for="product in section.products"
            :key="product.id"
            class="w-[44%] sm:w-[32%] md:w-[23%] shrink-0"
          >
            <ProductCard :product="product" />
          </div>
        </div>
      </section>

      <PromoSlider
        v-if="midSliders?.length && (index + 1) % 2 === 0 && index < categorySections.length - 1"
        :sliders="midSliders"
        aspect-class="aspect-[16/7]"
      />
    </template>

    <EmptyState
      v-if="!sectionsLoading && !categorySections.length"
      message="محصولی برای نمایش وجود ندارد"
    />
  </div>
</template>
