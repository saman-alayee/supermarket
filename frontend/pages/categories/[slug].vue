<script setup lang="ts">
import type { Category, Product, Tag } from '~/types';

const route = useRoute();
const api = useApi();
const slug = computed(() => route.params.slug as string);

const selectedTag = ref<string>((route.query.tag as string) || 'all');

const { data: category } = await useAsyncData(
  () => `category-${slug.value}`,
  async () => {
    const { data } = await api.get<Category>(`/categories/${slug.value}`);
    return data;
  }
);

const tags = ref<Tag[]>([]);
const grouped = ref<{ tag: Tag; products: Product[]; total: number }[]>([]);
const tagProducts = ref<Product[]>([]);
const loading = ref(true);

const visibleSections = computed(() => {
  if (selectedTag.value === 'all') return grouped.value.filter((s) => s.products.length);
  const tag =
    tags.value.find((item) => item.slug === selectedTag.value) ||
    grouped.value.find((item) => item.tag.slug === selectedTag.value)?.tag;
  if (!tag) return [];
  return [{ tag, products: tagProducts.value, total: tagProducts.value.length }];
});

async function loadGrouped() {
  loading.value = true;
  try {
    const [tagsRes, groupedRes] = await Promise.all([
      api.get<Tag[]>(`/categories/${slug.value}/tags`).catch(() => ({ data: [] as Tag[] })),
      api.get<{ groups: { tag: Tag; products: Product[]; total: number }[] }>(
        `/products/category/${slug.value}/by-tags`
      ).catch(() => ({ data: { groups: [] } })),
    ]);
    tags.value = tagsRes.data;
    grouped.value = groupedRes.data.groups || [];
  } finally {
    loading.value = false;
  }
}

async function loadTagProducts(tagSlug: string) {
  loading.value = true;
  try {
    const tag = tags.value.find((item) => item.slug === tagSlug);
    const params = new URLSearchParams({ category: slug.value, limit: '100' });
    if (tag && tag.id !== 'other') params.set('tagId', tag.id);
    if (tagSlug === 'other') params.set('tagId', '');
    const { data } = await api.get<{ products: Product[] }>(`/products?${params}`);
    if (tagSlug === 'other') {
      tagProducts.value = data.products.filter((p) => !p.tagId);
    } else if (tag) {
      tagProducts.value = data.products.filter((p) => p.tagId === tag.id);
    } else {
      tagProducts.value = data.products;
    }
  } finally {
    loading.value = false;
  }
}

async function loadPageData() {
  await loadGrouped();
  if (selectedTag.value !== 'all') {
    await loadTagProducts(selectedTag.value);
  }
}

onMounted(loadPageData);
watch(slug, loadPageData);

function selectTag(tagSlug: string) {
  selectedTag.value = tagSlug;
  navigateTo({ path: route.path, query: tagSlug === 'all' ? {} : { tag: tagSlug } }, { replace: true });
  if (tagSlug === 'all') return;
  loadTagProducts(tagSlug);
}

useHead({ title: `${category.value?.name || 'دسته‌بندی'} - KIAA KALA` });
</script>

<template>
  <div class="pb-8">
    <div class="px-4 pt-4 pb-3">
      <h1 class="section-title mb-3">{{ category?.name }}</h1>

      <div v-if="tags.length" class="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
        <button
          type="button"
          :class="[
            'shrink-0 min-w-[72px] px-3 py-2 rounded-2xl text-sm font-medium border transition-colors flex flex-col items-center gap-1',
            selectedTag === 'all'
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-white text-gray-600 border-gray-200',
          ]"
          @click="selectTag('all')"
        >
          <span class="text-lg">🛒</span>
          همه
        </button>
        <button
          v-for="tag in tags"
          :key="tag.id"
          type="button"
          :class="[
            'shrink-0 min-w-[72px] px-3 py-2 rounded-2xl text-sm font-medium border transition-colors flex flex-col items-center gap-1',
            selectedTag === tag.slug
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-white text-gray-600 border-gray-200',
          ]"
          @click="selectTag(tag.slug)"
        >
          <span class="text-lg leading-none">{{ tag.icon || '🏷️' }}</span>
          {{ tag.name }}
        </button>
      </div>
    </div>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="space-y-8">
      <section
        v-for="section in visibleSections"
        :key="section.tag?.id || 'other'"
        class="px-4"
      >
        <div v-if="selectedTag === 'all'" class="flex items-center justify-between mb-3">
          <h2 class="text-base font-bold text-gray-800 inline-flex items-center gap-1.5">
            <span v-if="section.tag?.icon">{{ section.tag.icon }}</span>
            {{ section.tag?.name || 'سایر محصولات' }}
          </h2>
          <button
            v-if="section.total > section.products.length"
            type="button"
            class="text-sm text-primary-600 font-medium"
            @click="selectTag(section.tag.slug)"
          >
            ادامه
          </button>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <ProductCard
            v-for="product in section.products"
            :key="product.id"
            :product="product"
          />
        </div>
      </section>

      <EmptyState
        v-if="!visibleSections.length"
        message="محصولی در این دسته‌بندی یافت نشد"
      />
    </div>
  </div>
</template>
