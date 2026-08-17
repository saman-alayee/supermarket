<script setup lang="ts">
import type { Product } from '~/types';

const route = useRoute();
const api = useApi();

const query = ref('');
const products = ref<Product[]>([]);
const loading = ref(false);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function syncFromRoute() {
  query.value = (route.query.q as string) || '';
}

async function loadSearch() {
  const term = query.value.trim();
  if (!term) {
    products.value = [];
    loading.value = false;
    return;
  }

  loading.value = true;
  try {
    const { data } = await api.get<{ products: Product[] }>(
      `/products?search=${encodeURIComponent(term)}&limit=30`
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
  () => route.query.q,
  () => {
    syncFromRoute();
    loadSearch();
  },
  { immediate: true }
);

useHead(() => ({
  title: query.value ? `جستجو: ${query.value} - KIAA KALA` : 'جستجو - KIAA KALA',
}));
</script>

<template>
  <div class="px-4 py-4">
    <form class="mb-5" @submit.prevent="loadSearch">
      <div class="relative">
        <input
          v-model="query"
          type="search"
          placeholder="جستجوی محصول..."
          class="input-field pe-12 bg-gray-50"
          @input="onQueryInput"
        />
        <button type="submit" class="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600">
          <AppIcon name="lucide:search" size="md" />
        </button>
      </div>
    </form>

    <h1 v-if="query" class="section-title">
      نتایج جستجو
      <span class="text-primary-600">«{{ query }}»</span>
    </h1>
    <p v-else class="text-sm text-gray-500 mb-4">نام محصول مورد نظر را جستجو کنید.</p>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading && products.length" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      <ProductCard v-for="product in products" :key="product.id" :product="product" />
    </div>

    <EmptyState v-if="!loading && query && !products.length" message="محصولی یافت نشد" />
  </div>
</template>
