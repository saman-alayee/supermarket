<script setup lang="ts">
import type { Product, Pagination } from '~/types';
import { SITE_NAME } from '~/constants/site';

const route = useRoute();
const api = useApi();

const PAGE_SIZE = 24;

const query = ref('');
const products = ref<Product[]>([]);
const pagination = ref<Pagination | null>(null);
const loading = ref(false);
const loadingMore = ref(false);
const pageTitle = ref('جستجو');

const hasMore = computed(() => {
  const p = pagination.value;
  return !!p && p.page < p.totalPages;
});

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function syncFromRoute() {
  query.value = (route.query.q as string) || '';
}

async function fetchProducts(page: number, append: boolean) {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    page: String(page),
  });

  if (route.query.discounted === '1') {
    pageTitle.value = 'محصولات تخفیف‌دار';
    params.set('discounted', 'true');
    const { data } = await api.get<{ products: Product[]; pagination: Pagination }>(
      `/products?${params}`
    );
    products.value = append ? [...products.value, ...data.products] : data.products;
    pagination.value = data.pagination;
    return;
  }
  if (route.query.featured === '1') {
    pageTitle.value = 'محصولات ویژه';
    params.set('featured', 'true');
    const { data } = await api.get<{ products: Product[]; pagination: Pagination }>(
      `/products?${params}`
    );
    products.value = append ? [...products.value, ...data.products] : data.products;
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
  products.value = append ? [...products.value, ...data.products] : data.products;
  pagination.value = data.pagination;
}

async function loadSearch() {
  loading.value = true;
  try {
    await fetchProducts(1, false);
  } catch {
    products.value = [];
    pagination.value = null;
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (loading.value || loadingMore.value || !hasMore.value) return;
  loadingMore.value = true;
  try {
    await fetchProducts((pagination.value?.page ?? 1) + 1, true);
  } catch {
    /* keep existing list */
  } finally {
    loadingMore.value = false;
  }
}

const { sentinel: loadMoreSentinel } = useInfiniteScroll(loadMore);

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

watch(
  () => [route.query.q, route.query.discounted, route.query.featured],
  () => {
    syncFromRoute();
    void loadSearch();
  },
  { immediate: true }
);

useHead(() => ({
  title: `${pageTitle.value} - ${SITE_NAME}`,
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

    <div
      v-if="!loading && products.length && (hasMore || loadingMore)"
      class="py-6 flex flex-col items-center gap-2"
    >
      <div ref="loadMoreSentinel" class="h-1 w-full" aria-hidden="true" />
      <LoadingSpinner :show="loadingMore" />
      <p v-if="loadingMore" class="text-xs text-gray-400">در حال بارگذاری محصولات بیشتر…</p>
    </div>

    <EmptyState v-if="!loading && !products.length" message="محصولی یافت نشد" />
  </div>
</template>
