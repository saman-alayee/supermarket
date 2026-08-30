<script setup lang="ts">
import type { Category, Product, Pagination } from '~/types';
import { SITE_NAME } from '~/constants/site';

const api = useApi();
const route = useRoute();

const { data: categories } = await useAsyncData('all-categories', async () => {
  const { data } = await api.get<Category[]>('/categories');
  return data;
});

const products = ref<Product[]>([]);
const loading = ref(false);

async function loadProducts() {
  loading.value = true;
  try {
    const { data } = await api.get<{ products: Product[]; pagination: Pagination }>(
      '/products?limit=20'
    );
    products.value = data.products;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  const categorySlug = route.query.category as string | undefined;
  if (categorySlug) {
    navigateTo(`/categories/${categorySlug}`, { replace: true });
    return;
  }
  loadProducts();
});

useHead({ title: `دسته‌بندی‌ها - ${SITE_NAME}` });
</script>

<template>
  <div class="px-4 py-4">
    <h1 class="section-title">دسته‌بندی‌ها</h1>

    <div class="flex gap-3 overflow-x-auto scrollbar-hide pb-4 mb-4">
      <NuxtLink
        to="/categories"
        class="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors bg-primary-600 text-white"
      >
        همه
      </NuxtLink>
      <NuxtLink
        v-for="category in categories"
        :key="category.id"
        :to="`/categories/${category.slug}`"
        class="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200"
      >
        {{ category.name }}
      </NuxtLink>
    </div>

    <LoadingSpinner :show="loading" />

    <ProductCardList v-if="!loading && products.length" :products="products" />

    <EmptyState v-if="!loading && !products.length" message="محصولی یافت نشد" />
  </div>
</template>
