<script setup lang="ts">
import type { Category, Product, Pagination } from '~/types';

const route = useRoute();
const api = useApi();
const slug = route.params.slug as string;

const { data: category } = await useAsyncData(`category-${slug}`, async () => {
  const { data } = await api.get<Category>(`/categories/${slug}`);
  return data;
});

const products = ref<Product[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const { data } = await api.get<{ products: Product[]; pagination: Pagination }>(
      `/products?category=${slug}&limit=50`
    );
    products.value = data.products;
  } finally {
    loading.value = false;
  }
});

useHead({ title: `${category.value?.name || 'دسته‌بندی'} - هایپرمارکت` });
</script>

<template>
  <div class="px-4 py-4">
    <h1 class="section-title">{{ category?.name }}</h1>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading && products.length" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      <ProductCard v-for="product in products" :key="product.id" :product="product" />
    </div>

    <EmptyState v-if="!loading && !products.length" message="محصولی در این دسته‌بندی یافت نشد" />
  </div>
</template>
