<script setup lang="ts">
import type { Category, Product, Slider, HomeCategorySection } from '~/types';

const api = useApi();
const route = useRoute();

const { data: categories } = await useAsyncData('categories', async () => {
  const { data } = await api.get<Category[]>('/categories');
  return data;
});

const { data: topSliders, refresh: refreshTopSliders } = await useAsyncData('sliders-top', async () => {
  try {
    const { data } = await api.get<Slider[]>('/sliders?placement=HOME_TOP');
    return data.filter((item) => item.isActive);
  } catch {
    return [] as Slider[];
  }
});

const { data: midSliders, refresh: refreshMidSliders } = await useAsyncData('sliders-mid', async () => {
  try {
    const { data } = await api.get<Slider[]>('/sliders?placement=HOME_MID');
    return data.filter((item) => item.isActive);
  } catch {
    return [] as Slider[];
  }
});

const featuredProducts = ref<Product[]>([]);
const discountedProducts = ref<Product[]>([]);
const categorySections = ref<HomeCategorySection[]>([]);
const sectionsLoading = ref(true);
const dealTab = ref<'discounted' | 'featured'>('discounted');

const visibleCategories = computed(() => (categories.value ?? []).slice(0, 8));

const hasDeals = computed(() => discountedProducts.value.length > 0 || featuredProducts.value.length > 0);
const showDealTabs = computed(() => discountedProducts.value.length > 0 && featuredProducts.value.length > 0);

const activeDealProducts = computed(() => {
  if (dealTab.value === 'discounted' && discountedProducts.value.length) {
    return discountedProducts.value.slice(0, 10);
  }
  if (featuredProducts.value.length) {
    return featuredProducts.value.slice(0, 10);
  }
  return discountedProducts.value.slice(0, 10);
});

const visibleCategorySections = computed(() => categorySections.value);

const activeDealLink = computed(() =>
  dealTab.value === 'discounted' || !featuredProducts.value.length
    ? '/search?discounted=1'
    : '/search?featured=1'
);

const dealsSectionClass = computed(() => {
  if (dealTab.value === 'discounted') {
    return 'relative mx-4 mb-2 overflow-hidden rounded-2xl border-2 border-red-200 bg-gradient-to-b from-red-50 via-red-50/30 to-white px-3 py-4 shadow-[0_6px_24px_rgba(239,68,68,0.1)] scroll-mt-20';
  }
  return 'relative mx-4 mb-2 overflow-hidden rounded-2xl border-2 border-primary-100 bg-gradient-to-b from-primary-50/80 via-white to-white px-3 py-4 shadow-[0_6px_24px_rgba(22,163,74,0.06)] scroll-mt-20';
});

const dealsTabsClass = computed(() =>
  dealTab.value === 'discounted'
    ? 'flex gap-2 mb-3 p-1 rounded-xl border border-red-200 bg-white/90'
    : 'flex gap-2 mb-3 p-1 rounded-xl border border-primary-100 bg-white/90'
);

watch(showDealTabs, (both) => {
  if (!both && featuredProducts.value.length && !discountedProducts.value.length) {
    dealTab.value = 'featured';
  }
});

async function loadHomeSections() {
  sectionsLoading.value = true;
  try {
    const [featuredRes, discountedRes, feedRes] = await Promise.all([
      api.get<{ products: Product[] }>('/products?featured=true&limit=10').catch(() => ({ data: { products: [] } })),
      api.get<{ products: Product[] }>('/products?discounted=true&limit=10').catch(() => ({ data: { products: [] } })),
      api.get<HomeCategorySection[]>('/products/home-feed').catch(() => ({ data: [] as HomeCategorySection[] })),
    ]);
    featuredProducts.value = featuredRes.data.products;
    discountedProducts.value = discountedRes.data.products;
    categorySections.value = feedRes.data;
  } finally {
    sectionsLoading.value = false;
  }
}

onMounted(() => {
  loadHomeSections();
  if (!topSliders.value?.length) refreshTopSliders();
  if (!midSliders.value?.length) refreshMidSliders();
});

const sectionAnchors = {
  featured: 'home-featured',
  discounted: 'home-discounted',
} as const;

watch(
  () => route.query.section,
  (section) => {
    const key = section as keyof typeof sectionAnchors | undefined;
    if (!key || !sectionAnchors[key]) return;
    dealTab.value = key === 'featured' ? 'featured' : 'discounted';
    nextTick(() => {
      document.getElementById('home-deals')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  },
  { immediate: true }
);

useHead({ title: 'KIAA KALA - فروشگاه اینترنتی' });
</script>

<template>
  <div class="pb-8 bg-white">
    <PromoSlider
      v-if="topSliders?.length"
      :sliders="topSliders"
      variant="tiles"
      height-class="h-[68px] sm:h-[76px] md:h-[88px]"
      compact
    />

    <!-- Quick shortcuts -->
    <section class="px-4 pt-3 pb-1">
      <div class="flex gap-2 overflow-x-auto scrollbar-hide">
        <NuxtLink
          to="/search?discounted=1"
          class="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-red-50 text-red-700 text-xs font-semibold border border-red-100"
        >
          <AppIcon name="lucide:percent" size="sm" />
          تخفیف‌دار
        </NuxtLink>
        <NuxtLink
          to="/search?featured=1"
          class="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold border border-primary-100"
        >
          <AppIcon name="lucide:sparkles" size="sm" />
          پیشنهاد ویژه
        </NuxtLink>
        <NuxtLink
          to="/categories"
          class="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gray-50 text-gray-700 text-xs font-semibold border border-gray-100"
        >
          <AppIcon name="lucide:layout-grid" size="sm" />
          همه دسته‌ها
        </NuxtLink>
        <NuxtLink
          to="/profile/orders"
          class="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gray-50 text-gray-700 text-xs font-semibold border border-gray-100"
        >
          <AppIcon name="lucide:package-search" size="sm" />
          پیگیری سفارش
        </NuxtLink>
      </div>
    </section>

    <!-- Categories grid -->
    <section v-if="visibleCategories.length" class="px-4 py-4">
      <HomeSection title="دسته‌بندی‌ها" to="/categories" />
      <div class="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-6 md:grid-cols-8">
        <CategoryCard
          v-for="category in visibleCategories"
          :key="category.id"
          :category="category"
          size="md"
        />
      </div>
    </section>

    <section v-if="hasDeals" id="home-deals" :class="dealsSectionClass">
      <div
        :class="[
          'absolute inset-x-0 top-0 h-1',
          dealTab === 'discounted' ? 'bg-gradient-to-r from-red-500 via-red-400 to-red-500' : 'bg-gradient-to-r from-primary-600 via-primary-500 to-primary-600',
        ]"
      />

      <HomeSection
        :title="dealTab === 'discounted' ? 'پیشنهادهای تخفیف‌دار' : 'محصولات ویژه'"
        :to="activeDealLink"
        subtitle="منتخب امروز فروشگاه"
        :variant="dealTab === 'discounted' ? 'discount' : 'featured'"
      />

      <div v-if="showDealTabs" :class="dealsTabsClass">
        <button
          type="button"
          :class="[
            'flex-1 py-2 text-xs font-semibold rounded-lg transition-colors',
            dealTab === 'discounted' ? 'bg-red-500 text-white shadow-sm shadow-red-200' : 'text-gray-600 hover:bg-red-50 hover:text-red-600',
          ]"
          @click="dealTab = 'discounted'"
        >
          تخفیف‌دار
        </button>
        <button
          type="button"
          :class="[
            'flex-1 py-2 text-xs font-semibold rounded-lg transition-colors',
            dealTab === 'featured' ? 'bg-primary-600 text-white shadow-sm shadow-primary-200' : 'text-gray-600 hover:bg-primary-50 hover:text-primary-700',
          ]"
          @click="dealTab = 'featured'"
        >
          ویژه
        </button>
      </div>

      <ProductCardList :products="activeDealProducts" layout="strip" density="compact" />
    </section>

    <LoadingSpinner :show="sectionsLoading" />

    <!-- Category product rows -->
    <template v-for="(section, index) in visibleCategorySections" :key="section.category.id">
      <section
        :class="[
          'px-4 py-5',
          index % 2 === 1 ? 'bg-gray-50/70' : '',
        ]"
      >
        <HomeSection
          :title="section.category.name"
          :to="`/categories/${section.category.slug}`"
        />
        <ProductCardList :products="section.products.slice(0, 10)" layout="strip" density="compact" />
      </section>

      <PromoSlider
        v-if="midSliders?.length && index === 1 && index < visibleCategorySections.length - 1"
        :sliders="midSliders"
        variant="carousel"
        height-class="h-[52px] sm:h-[60px] md:h-[68px]"
        compact
      />
    </template>

    <EmptyState
      v-if="!sectionsLoading && !visibleCategorySections.length && !hasDeals"
      message="محصولی برای نمایش وجود ندارد"
    />
  </div>
</template>
