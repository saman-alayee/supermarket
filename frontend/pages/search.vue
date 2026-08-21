<script setup lang="ts">
import type { Product } from '~/types';

const route = useRoute();
const api = useApi();

const query = ref('');
const products = ref<Product[]>([]);
const loading = ref(false);
const pageTitle = ref('جستجو');

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function syncFromRoute() {
  query.value = (route.query.q as string) || '';
}

async function loadSearch() {
  loading.value = true;
  try {
    if (route.query.discounted === '1') {
      pageTitle.value = 'محصولات تخفیف‌دار';
      const { data } = await api.get<{ products: Product[] }>('/products?discounted=true&limit=50');
      products.value = data.products;
      return;
    }
    if (route.query.featured === '1') {
      pageTitle.value = 'محصولات ویژه';
      const { data } = await api.get<{ products: Product[] }>('/products?featured=true&limit=50');
      products.value = data.products;
      return;
    }

    pageTitle.value = 'جستجو';
    const term = query.value.trim();
    if (!term) {
      products.value = [];
      return;
    }

    const { data } = await api.get<{ products: Product[] }>(
      `/products?search=${encodeURIComponent(term)}&limit=50`
    );
    products.value = data.products;
  } catch {
    products.value = [];
  } finally {
    loading.value = false;
  }
}

function onQueryInput() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    navigateTo({ path: '/search', query: query.value.trim() ? { q: query.value.trim() } : {} }, { replace: true });
  }, 350);
}

watch(
  () => [route.query.q, route.query.discounted, route.query.featured],
  () => {
    syncFromRoute();
    loadSearch();
  },
  { immediate: true }
);

useHead(() => ({
  title: `${pageTitle.value} - KIAA KALA`,
}));
</script>

<template>
  <div class="px-4 py-4">
    <h1 class="section-title">{{ pageTitle }}</h1>

    <form v-if="!route.query.discounted && !route.query.featured" class="mb-5" @submit.prevent="loadSearch">
      <div class="relative">
        <input
          v-model="query"
          type="search"
          class="input-field pe-12"
          placeholder="نام محصول را جستجو کنید..."
          @input="onQueryInput"
        />
        <button type="submit" class="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400">
          <AppIcon name="lucide:search" size="md" />
        </button>
      </div>
    </form>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
      <ProductCard v-for="product in products" :key="product.id" :product="product" />
    </div>

    <EmptyState v-if="!loading && !products.length" message="محصولی یافت نشد" />
  </div>
</template>
