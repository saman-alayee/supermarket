<script setup lang="ts">
import type { Product, Pagination } from '~/types';

const route = useRoute();
const api = useApi();

const PAGE_SIZE = 24;

const query = ref('');
const products = ref<Product[]>([]);
const pagination = ref<Pagination | null>(null);
const page = ref(1);
const loading = ref(false);
const pageTitle = ref('جستجو');

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function syncFromRoute() {
  query.value = (route.query.q as string) || '';
  page.value = Math.max(1, parseInt(String(route.query.page || '1'), 10) || 1);
}

async function loadSearch() {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      page: String(page.value),
    });

    if (route.query.discounted === '1') {
      pageTitle.value = 'محصولات تخفیف‌دار';
      params.set('discounted', 'true');
      const { data } = await api.get<{ products: Product[]; pagination: Pagination }>(
        `/products?${params}`
      );
      products.value = data.products;
      pagination.value = data.pagination;
      return;
    }
    if (route.query.featured === '1') {
      pageTitle.value = 'محصولات ویژه';
      params.set('featured', 'true');
      const { data } = await api.get<{ products: Product[]; pagination: Pagination }>(
        `/products?${params}`
      );
      products.value = data.products;
      pagination.value = data.pagination;
      return;
    }

    pageTitle.value = 'جستجو';
    const term = query.value.trim();
    if (!term) {
      products.value = [];
      pagination.value = null;
      return;
    }

    params.set('search', term);
    const { data } = await api.get<{ products: Product[]; pagination: Pagination }>(
      `/products?${params}`
    );
    products.value = data.products;
    pagination.value = data.pagination;
  } catch {
    products.value = [];
    pagination.value = null;
  } finally {
    loading.value = false;
  }
}

function onQueryInput() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    navigateTo(
      {
        path: '/search',
        query: query.value.trim() ? { q: query.value.trim() } : {},
      },
      { replace: true }
    );
  }, 350);
}

function goToPage(next: number) {
  const q: Record<string, string> = {};
  if (route.query.discounted === '1') q.discounted = '1';
  else if (route.query.featured === '1') q.featured = '1';
  else if (query.value.trim()) q.q = query.value.trim();
  if (next > 1) q.page = String(next);
  navigateTo({ path: '/search', query: q });
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' });
}

watch(
  () => [route.query.q, route.query.discounted, route.query.featured, route.query.page],
  () => {
    syncFromRoute();
    void loadSearch();
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

    <ProductCardList v-if="!loading" :products="products" />

    <AppPagination :pagination="pagination" @update:page="goToPage" />

    <EmptyState v-if="!loading && !products.length" message="محصولی یافت نشد" />
  </div>
</template>
