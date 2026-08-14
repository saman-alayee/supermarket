<script setup lang="ts">
import type { Category, HomeSections } from '~/types';

const api = useApi();

const { data: categories } = await useAsyncData('categories', async () => {
  const { data } = await api.get<Category[]>('/categories');
  return data;
});

const { data: homeSections } = await useAsyncData('home-sections', async () => {
  const { data } = await api.get<HomeSections>('/products/home');
  return data;
});

useHead({ title: 'هایپرمارکت - فروشگاه اینترنتی' });
</script>

<template>
  <div>
    <!-- Categories -->
    <section class="px-4 py-4">
      <div class="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
        <CategoryCard
          v-for="category in categories"
          :key="category.id"
          :category="category"
        />
      </div>
    </section>

    <!-- Featured Products -->
    <section v-if="homeSections?.featured?.length" class="px-4 py-4">
      <div class="flex items-center justify-between mb-4">
        <h2 class="section-title mb-0">پیشنهادهای ویژه</h2>
        <NuxtLink to="/?section=featured" class="text-sm text-primary-600 font-medium">
          مشاهده همه
        </NuxtLink>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <ProductCard
          v-for="product in homeSections.featured"
          :key="product.id"
          :product="product"
        />
      </div>
    </section>

    <!-- Discounted Products -->
    <section v-if="homeSections?.discounted?.length" class="px-4 py-4">
      <div class="flex items-center justify-between mb-4">
        <h2 class="section-title mb-0">تخفیف‌دار</h2>
        <NuxtLink to="/?section=discounted" class="text-sm text-primary-600 font-medium">
          مشاهده همه
        </NuxtLink>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <ProductCard
          v-for="product in homeSections.discounted"
          :key="product.id"
          :product="product"
        />
      </div>
    </section>

    <!-- New Products -->
    <section v-if="homeSections?.newProducts?.length" class="px-4 py-4 pb-8">
      <div class="flex items-center justify-between mb-4">
        <h2 class="section-title mb-0">محصولات جدید</h2>
        <NuxtLink to="/?section=new" class="text-sm text-primary-600 font-medium">
          مشاهده همه
        </NuxtLink>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <ProductCard
          v-for="product in homeSections.newProducts"
          :key="product.id"
          :product="product"
        />
      </div>
    </section>
  </div>
</template>
