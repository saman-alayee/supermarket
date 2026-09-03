<script setup lang="ts">
import type { Category, HomeCategorySection } from '~/types';
import { SITE_NAME } from '~/constants/site';

const api = useApi();
const route = useRoute();

const { data: categories } = await useAsyncData('all-categories', async () => {
  const { data } = await api.get<Category[]>('/categories');
  return data;
});

const categorySections = ref<HomeCategorySection[]>([]);
const loading = ref(true);

async function loadCategorySections() {
  loading.value = true;
  try {
    const { data } = await api.get<HomeCategorySection[]>('/products/home-feed');
    categorySections.value = data;
  } catch {
    categorySections.value = [];
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
  void loadCategorySections();
});

useHead({ title: `دسته‌بندی‌ها - ${SITE_NAME}` });
</script>

<template>
  <div class="pb-8">
    <div class="sticky top-14 z-30 min-w-0 bg-gray-50/95 backdrop-blur border-b border-gray-100 px-4 pt-4 pb-3">
      <h1 class="section-title mb-3">دسته‌بندی‌ها</h1>

      <ChipStrip class="pb-1">
        <NuxtLink
          to="/categories"
          class="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors bg-primary-600 text-white"
          draggable="false"
        >
          همه
        </NuxtLink>
        <NuxtLink
          v-for="category in categories"
          :key="category.id"
          :to="`/categories/${category.slug}`"
          class="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200"
          draggable="false"
        >
          {{ category.name }}
        </NuxtLink>
      </ChipStrip>
    </div>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="space-y-0 pt-2">
      <section
        v-for="(section, index) in categorySections"
        :key="section.category.id"
        :class="['px-4 py-5', index % 2 === 1 ? 'bg-gray-50/70' : '']"
      >
        <HomeSection
          :title="section.category.name"
          :to="`/categories/${section.category.slug}`"
        />
        <ProductCardList
          :products="section.products.slice(0, 10)"
          layout="strip"
          density="compact"
        />
      </section>

      <EmptyState
        v-if="!categorySections.length"
        message="دسته‌بندی فعالی برای نمایش وجود ندارد"
      />
    </div>
  </div>
</template>
