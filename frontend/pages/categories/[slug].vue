<script setup lang="ts">
import type { Category, Product, Tag } from '~/types';

const route = useRoute();
const api = useApi();
const slug = route.params.slug as string;

const selectedTag = ref<string>('all');

const { data: category } = await useAsyncData(`category-${slug}`, async () => {
  const { data } = await api.get<Category>(`/categories/${slug}`);
  return data;
});

const tags = ref<Tag[]>([]);
const products = ref<Product[]>([]);
const loading = ref(true);

const groupedSections = computed(() => {
  const activeTags = tags.value.filter((tag) => tag.isActive);
  const sections: { tag: Tag | null; products: Product[] }[] = [];

  if (selectedTag.value === 'all') {
    for (const tag of activeTags) {
      const tagProducts = products.value.filter((product) => product.tagId === tag.id);
      if (tagProducts.length) {
        sections.push({ tag, products: tagProducts });
      }
    }

    const untagged = products.value.filter(
      (product) => !product.tagId || !activeTags.some((tag) => tag.id === product.tagId)
    );
    if (untagged.length) {
      sections.push({ tag: null, products: untagged });
    }
    return sections;
  }

  const tag = activeTags.find((item) => item.slug === selectedTag.value);
  if (!tag) return [];

  return [{
    tag,
    products: products.value.filter((product) => product.tagId === tag.id),
  }];
});

async function loadPageData() {
  loading.value = true;
  try {
    const [tagsRes, productsRes] = await Promise.all([
      api.get<Tag[]>(`/categories/${slug}/tags`).catch(() => ({ data: [] as Tag[] })),
      api.get<{ products: Product[] }>(`/products?category=${slug}&limit=100`),
    ]);
    tags.value = tagsRes.data.filter((tag) => tag.isActive);
    products.value = productsRes.data.products;
  } finally {
    loading.value = false;
  }
}

onMounted(loadPageData);

function selectTag(tagSlug: string) {
  selectedTag.value = tagSlug;
}

useHead({ title: `${category.value?.name || 'دسته‌بندی'} - KIAA KALA` });
</script>

<template>
  <div class="pb-8">
    <div class="px-4 pt-4 pb-3">
      <h1 class="section-title mb-3">{{ category?.name }}</h1>

      <div v-if="tags.length" class="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        <button
          type="button"
          :class="[
            'shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors',
            selectedTag === 'all'
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
          ]"
          @click="selectTag('all')"
        >
          همه
        </button>
        <button
          v-for="tag in tags"
          :key="tag.id"
          type="button"
          :class="[
            'shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors inline-flex items-center gap-1.5',
            selectedTag === tag.slug
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
          ]"
          @click="selectTag(tag.slug)"
        >
          <span v-if="tag.icon">{{ tag.icon }}</span>
          {{ tag.name }}
        </button>
      </div>
    </div>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="space-y-6">
      <section
        v-for="section in groupedSections"
        :key="section.tag?.id || 'other'"
        class="px-4"
      >
        <div v-if="selectedTag === 'all'" class="flex items-center justify-between mb-3">
          <h2 class="text-base font-bold text-gray-800">
            {{ section.tag?.name || 'سایر محصولات' }}
          </h2>
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
        v-if="!groupedSections.length"
        message="محصولی در این دسته‌بندی یافت نشد"
      />
    </div>
  </div>
</template>
