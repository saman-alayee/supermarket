<script setup lang="ts">
import type { Category, Product, Pagination } from '~/types';

const api = useApi();
const route = useRoute();

const { data: categories } = await useAsyncData('all-categories', async () => {
  const { data } = await api.get<Category[]>('/categories');
  return data;
});

const selectedCategory = ref<string | null>(null);
const products = ref<Product[]>([]);
const pagination = ref<Pagination | null>(null);
const loading = ref(false);

async function loadProducts(categorySlug?: string | null) {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (categorySlug) params.set('category', categorySlug);
    params.set('limit', '20');

    const { data } = await api.get<{ products: Product[]; pagination: Pagination }>(
      `/products?${params.toString()}`
    );
    products.value = data.products;
    pagination.value = data.pagination;
  } finally {
    loading.value = false;
  }
}

function selectCategory(slug: string | null) {
  selectedCategory.value = slug;
  loadProducts(slug);
}

onMounted(() => {
  loadProducts();
});

useHead({ title: 'دسته‌بندی‌ها - هایپرمارکت' });
</script>

<template>
  <div class="px-4 py-4">
    <h1 class="section-title">دسته‌بندی‌ها</h1>

    <!-- Category filter -->
    <div class="flex gap-3 overflow-x-auto scrollbar-hide pb-4 mb-4">
      <button
        :class="[
          'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
          !selectedCategory ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600',
        ]"
        @click="selectCategory(null)"
      >
        همه
      </button>
      <button
        v-for="category in categories"
        :key="category.id"
        :class="[
          'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
          selectedCategory === category.slug ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600',
        ]"
        @click="selectCategory(category.slug)"
      >
        {{ category.name }}
      </button>
    </div>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading && products.length" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      <ProductCard v-for="product in products" :key="product.id" :product="product" />
    </div>

    <EmptyState v-if="!loading && !products.length" message="محصولی در این دسته‌بندی یافت نشد" />
  </div>
</template>
