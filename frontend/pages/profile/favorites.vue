<script setup lang="ts">
definePageMeta({ layout: 'profile' });

const { fetchFavorites } = useFavorites();
const products = ref<import('~/types').Product[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    products.value = await fetchFavorites();
  } finally {
    loading.value = false;
  }
});

useHead({ title: 'علاقه‌مندی‌ها - KIAA KALA' });
</script>

<template>
  <div>
    <ProfilePageHeader title="علاقه‌مندی‌ها" subtitle="محصولات منتخب شما" back-to="/profile" />

    <LoadingSpinner :show="loading" />

    <ProductCardList v-if="!loading && products.length" :products="products" />

    <EmptyState v-if="!loading && !products.length" message="محصولی به علاقه‌مندی‌ها اضافه نشده" icon="lucide:heart">
      <NuxtLink to="/" class="btn-primary mt-4 text-sm inline-flex min-h-[44px] items-center px-6">رفتن به فروشگاه</NuxtLink>
    </EmptyState>
  </div>
</template>
