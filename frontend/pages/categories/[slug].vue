<script setup lang="ts">
import type { Category, Product, Tag, Pagination } from '~/types';
import { SITE_NAME } from '~/constants/site';

const route = useRoute();
const api = useApi();
const slug = computed(() => route.params.slug as string);

const PAGE_SIZE = 24;
const STRIP_CHUNK = 8;
const selectedTag = ref<string>((route.query.tag as string) || 'all');

const { data: category } = await useAsyncData(
  () => `category-${slug.value}`,
  async () => {
    const { data } = await api.get<Category>(`/categories/${slug.value}`);
    return data;
  }
);

const { data: categories } = await useAsyncData('all-categories', async () => {
  const { data } = await api.get<Category[]>('/categories');
  return data;
});

const tags = ref<Tag[]>([]);
const grouped = ref<{ tag: Tag; products: Product[]; total: number }[]>([]);
const tagProducts = ref<Product[]>([]);
const fallbackProducts = ref<Product[]>([]);
const listPagination = ref<Pagination | null>(null);
const loading = ref(true);
const loadingMore = ref(false);

type SectionState = {
  products: Product[];
  page: number;
  total: number;
  loading: boolean;
};

const sectionStates = ref<Record<string, SectionState>>({});

const hasMore = computed(() => {
  const p = listPagination.value;
  return !!p && p.page < p.totalPages;
});

const hasOtherGroup = computed(() => grouped.value.some((section) => section.tag.slug === 'other'));

const displayTags = computed(() => {
  const fromApi = tags.value.filter((tag) => tag.slug !== 'other');
  if (fromApi.length) return fromApi;
  return grouped.value.filter((section) => section.tag.slug !== 'other').map((section) => section.tag);
});

const showTagBar = computed(() => displayTags.value.length > 0 || hasOtherGroup.value);

const visibleSections = computed(() => {
  if (selectedTag.value === 'all') {
    return grouped.value
      .filter((section) => section.products.length > 0)
      .map((section) => {
        const tagSlug = section.tag.slug;
        const state = sectionStates.value[tagSlug];
        const products = state?.products ?? section.products;
        const total = state?.total ?? section.total;
        return {
          tag: section.tag,
          products,
          total,
          hasMore: products.length < total,
          loadingMore: state?.loading ?? false,
        };
      });
  }
  const tag =
    displayTags.value.find((item) => item.slug === selectedTag.value) ||
    grouped.value.find((item) => item.tag.slug === selectedTag.value)?.tag;
  if (!tag) return [];
  return [{ tag, products: tagProducts.value, total: listPagination.value?.total ?? tagProducts.value.length }];
});

function syncSectionStates() {
  const next: Record<string, SectionState> = {};
  for (const section of grouped.value) {
    const tagSlug = section.tag.slug;
    const existing = sectionStates.value[tagSlug];
    next[tagSlug] = existing ?? {
      products: section.products,
      page: 1,
      total: section.total,
      loading: false,
    };
  }
  sectionStates.value = next;
}

async function loadMoreForSection(tagSlug: string) {
  const state = sectionStates.value[tagSlug];
  if (!state || state.loading || state.products.length >= state.total) return;

  sectionStates.value = {
    ...sectionStates.value,
    [tagSlug]: { ...state, loading: true },
  };

  try {
    const tag = resolveTag(tagSlug);
    const nextPage = Math.floor(state.products.length / STRIP_CHUNK) + 1;
    const params = new URLSearchParams({
      category: slug.value,
      limit: String(STRIP_CHUNK),
      page: String(nextPage),
    });

    if (tag && tagSlug !== 'other') {
      params.set('tagId', tag.id);
    }

    const { data } = await api.get<{ products: Product[]; pagination: Pagination }>(
      `/products?${params}`
    );

    const existingIds = new Set(state.products.map((product) => product.id));
    const batch =
      tagSlug === 'other'
        ? data.products.filter((product) => !product.tagId && !existingIds.has(product.id))
        : data.products.filter((product) => !existingIds.has(product.id));

    sectionStates.value = {
      ...sectionStates.value,
      [tagSlug]: {
        products: [...state.products, ...batch],
        page: nextPage,
        total: state.total,
        loading: false,
      },
    };
  } catch {
    sectionStates.value = {
      ...sectionStates.value,
      [tagSlug]: { ...state, loading: false },
    };
  }
}

function resolveTag(tagSlug: string): Tag | undefined {
  return (
    tags.value.find((item) => item.slug === tagSlug) ||
    grouped.value.find((item) => item.tag.slug === tagSlug)?.tag
  );
}

async function loadGrouped() {
  const [tagsRes, groupedRes] = await Promise.all([
    api.get<Tag[]>(`/categories/${slug.value}/tags`).catch(() => ({ data: [] as Tag[] })),
    api
      .get<{ groups: { tag: Tag; products: Product[]; total: number }[] }>(
        `/products/category/${slug.value}/by-tags`
      )
      .catch(() => ({ data: { groups: [] } })),
  ]);

  tags.value = tagsRes.data;
  grouped.value = groupedRes.data.groups || [];
  syncSectionStates();

  if (!grouped.value.length) {
    await loadFallbackPage(1);
  } else {
    fallbackProducts.value = [];
    listPagination.value = null;
  }
}

async function loadFallbackPage(nextPage: number, append = false) {
  const params = new URLSearchParams({
    category: slug.value,
    limit: String(PAGE_SIZE),
    page: String(nextPage),
  });
  const { data } = await api.get<{ products: Product[]; pagination: Pagination }>(
    `/products?${params}`
  );
  fallbackProducts.value = append
    ? [...fallbackProducts.value, ...data.products]
    : data.products;
  listPagination.value = data.pagination;
}

async function loadTagProducts(tagSlug: string, nextPage = 1, append = false) {
  // Overview strips already show first 8 — only skip fetch when viewing full list on page 1
  // and cache already has the complete set
  const cached = grouped.value.find((section) => section.tag.slug === tagSlug);
  if (
    nextPage === 1 &&
    cached &&
    cached.total <= cached.products.length &&
    cached.products.length > 0 &&
    cached.total <= 8
  ) {
    tagProducts.value = cached.products;
    listPagination.value = {
      page: 1,
      limit: PAGE_SIZE,
      total: cached.total,
      totalPages: 1,
    };
    return;
  }

  const tag = resolveTag(tagSlug);
  if (!tag && tagSlug !== 'other') {
    tagProducts.value = [];
    listPagination.value = null;
    return;
  }

  const params = new URLSearchParams({
    category: slug.value,
    limit: String(PAGE_SIZE),
    page: String(nextPage),
  });

  if (tag && tagSlug !== 'other') {
    params.set('tagId', tag.id);
  }

  const { data } = await api.get<{ products: Product[]; pagination: Pagination }>(
    `/products?${params}`
  );

  if (tagSlug === 'other') {
    const batch = data.products.filter((product) => !product.tagId);
    tagProducts.value = append ? [...tagProducts.value, ...batch] : batch;
    listPagination.value = data.pagination;
  } else {
    tagProducts.value = append ? [...tagProducts.value, ...data.products] : data.products;
    listPagination.value = data.pagination;
  }
}

async function loadPageData() {
  loading.value = true;
  try {
    await loadGrouped();
    if (selectedTag.value !== 'all') {
      await loadTagProducts(selectedTag.value, 1);
    }
  } finally {
    loading.value = false;
  }
}

function selectTag(tagSlug: string) {
  selectedTag.value = tagSlug;
  tagProducts.value = [];
  fallbackProducts.value = [];
  listPagination.value = null;
  navigateTo(
    {
      path: route.path,
      query: tagSlug === 'all' ? {} : { tag: tagSlug },
    },
    { replace: true }
  );
  if (tagSlug === 'all') {
    syncSectionStates();
    return;
  }
  void loadTagProducts(tagSlug, 1);
}

async function loadMore() {
  if (loading.value || loadingMore.value || !hasMore.value) return;
  loadingMore.value = true;
  try {
    const nextPage = (listPagination.value?.page ?? 1) + 1;
    if (selectedTag.value === 'all' && !grouped.value.length) {
      await loadFallbackPage(nextPage, true);
    } else if (selectedTag.value !== 'all') {
      await loadTagProducts(selectedTag.value, nextPage, true);
    }
  } finally {
    loadingMore.value = false;
  }
}

const { sentinel: loadMoreSentinel } = useInfiniteScroll(loadMore);

watch(
  () => route.query.tag,
  async (tag) => {
    selectedTag.value = (tag as string) || 'all';
    if (selectedTag.value !== 'all') {
      if (!grouped.value.length) await loadGrouped();
      tagProducts.value = [];
      await loadTagProducts(selectedTag.value, 1);
    }
  }
);

watch(slug, () => {
  selectedTag.value = 'all';
  tagProducts.value = [];
  fallbackProducts.value = [];
  listPagination.value = null;
  sectionStates.value = {};
  void loadPageData();
});

onMounted(loadPageData);

useHead({ title: `${category.value?.name || 'دسته‌بندی'} - ${SITE_NAME}` });
</script>

<template>
  <div class="pb-8">
    <div class="sticky top-14 z-30 min-w-0 bg-gray-50/95 backdrop-blur border-b border-gray-100 px-4 pt-4 pb-3">
      <h1 class="section-title mb-3">{{ category?.name }}</h1>

      <ChipStrip class="pb-3 mb-1">
        <NuxtLink
          to="/categories"
          class="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-gray-100 text-gray-600"
          draggable="false"
        >
          همه
        </NuxtLink>
        <NuxtLink
          v-for="item in categories"
          :key="item.id"
          :to="`/categories/${item.slug}`"
          :class="[
            'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
            item.slug === slug
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          ]"
          draggable="false"
        >
          {{ item.name }}
        </NuxtLink>
      </ChipStrip>

      <ChipStrip v-if="showTagBar" class="pb-1">
        <button
          type="button"
          :class="[
            'shrink-0 min-w-[68px] px-2.5 py-2 rounded-2xl text-xs font-medium border transition-colors flex flex-col items-center gap-1',
            selectedTag === 'all'
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-white text-gray-600 border-gray-200',
          ]"
          @click="selectTag('all')"
        >
          <span class="text-base">🛒</span>
          همه محصولات
        </button>

        <button
          v-for="tag in displayTags"
          :key="tag.id"
          type="button"
          :class="[
            'shrink-0 min-w-[68px] px-2.5 py-2 rounded-2xl text-xs font-medium border transition-colors flex flex-col items-center gap-1',
            selectedTag === tag.slug
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-white text-gray-600 border-gray-200',
          ]"
          @click="selectTag(tag.slug)"
        >
          <span class="text-base leading-none">{{ tag.icon || '🏷️' }}</span>
          {{ tag.name }}
        </button>

        <button
          v-if="hasOtherGroup"
          type="button"
          :class="[
            'shrink-0 min-w-[68px] px-2.5 py-2 rounded-2xl text-xs font-medium border transition-colors flex flex-col items-center gap-1',
            selectedTag === 'other'
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-white text-gray-600 border-gray-200',
          ]"
          @click="selectTag('other')"
        >
          <span class="text-base">📦</span>
          سایر
        </button>
      </ChipStrip>
    </div>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="space-y-6 pt-4">
      <section
        v-for="section in visibleSections"
        :key="section.tag?.id || 'other'"
        class="px-4"
      >
        <div v-if="selectedTag === 'all'" class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-bold text-gray-800 inline-flex items-center gap-1.5">
            <span v-if="section.tag?.icon">{{ section.tag.icon }}</span>
            {{ section.tag?.name || 'سایر محصولات' }}
          </h2>
          <span v-if="section.total > section.products.length" class="text-xs text-gray-400">
            {{ section.products.length }} از {{ section.total }}
          </span>
        </div>

        <ProductCardList
          :products="section.products"
          :layout="selectedTag === 'all' ? 'strip' : 'grid'"
          :has-more="section.hasMore"
          :loading-more="section.loadingMore"
          :reset-scroll-key="`${slug}-${section.tag?.slug || 'other'}`"
          @load-more="loadMoreForSection(section.tag?.slug || 'other')"
        />
      </section>

      <EmptyState
        v-if="!visibleSections.length && !fallbackProducts.length"
        message="محصولی در این دسته‌بندی یافت نشد"
      />

      <section v-if="!visibleSections.length && fallbackProducts.length" class="px-4">
        <ProductCardList :products="fallbackProducts" />
      </section>

      <div
        v-if="(selectedTag !== 'all' || (!grouped.length && fallbackProducts.length)) && (hasMore || loadingMore)"
        class="px-4 py-6 flex flex-col items-center gap-2"
      >
        <div ref="loadMoreSentinel" class="h-1 w-full" aria-hidden="true" />
        <LoadingSpinner :show="loadingMore" />
        <p v-if="loadingMore" class="text-xs text-gray-400">در حال بارگذاری محصولات بیشتر…</p>
      </div>
    </div>
  </div>
</template>
