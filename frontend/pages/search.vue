<script setup lang="ts">
import type { Product, Pagination } from '~/types';

const route = useRoute();
const api = useApi();

const query = computed(() => route.query.q as string || '');
const products = ref<Product[]>([]);
const loading = ref(true);

watch(query, loadSearch, { immediate: true });

async function loadSearch() {
  if (!query.value) {
    products.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const { data } = await api.get<{ products: Product[]; pagination: Pagination }>(
      `/products?search=${encodeURIComponent(query.value)}&limit=30`
    );
    products.value = data.products;
  } finally {
    loading.value = false;
  }
}

useHead({ title: `جستجو: ${query.value} - هایپرمارکت` });
</script>

<template>
  <div class="px-4 py-4">
    <h1 class="section-title">
      نتایج جستجو
      <span v-if="query" class="text-primary-600">«{{ query }}»</span>
    </h1>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading && products.length" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      <ProductCard v-for="product in products" :key="product.id" :product="product" />
    </div>

    <EmptyState v-if="!loading && query && !products.length" message="محصولی یافت نشد" />
  </div>
</template>
