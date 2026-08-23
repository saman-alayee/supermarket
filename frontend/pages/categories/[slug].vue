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

const { data: categories } = await useAsyncData('all-categories', async () => {
  const { data } = await api.get<Category[]>('/categories');
  return data;
});



const tags = ref<Tag[]>([]);

const grouped = ref<{ tag: Tag; products: Product[]; total: number }[]>([]);

const tagProducts = ref<Product[]>([]);

const fallbackProducts = ref<Product[]>([]);

const loading = ref(true);



const hasOtherGroup = computed(() => grouped.value.some((section) => section.tag.slug === 'other'));



const displayTags = computed(() => {

  const fromApi = tags.value.filter((tag) => tag.slug !== 'other');

  if (fromApi.length) return fromApi;

  return grouped.value.filter((section) => section.tag.slug !== 'other').map((section) => section.tag);

});



const showTagBar = computed(() => displayTags.value.length > 0 || hasOtherGroup.value);



const visibleSections = computed(() => {

  if (selectedTag.value === 'all') {

    return grouped.value.filter((section) => section.products.length > 0);

  }

  const tag =

    displayTags.value.find((item) => item.slug === selectedTag.value) ||

    grouped.value.find((item) => item.tag.slug === selectedTag.value)?.tag;

  if (!tag) return [];

  return [{ tag, products: tagProducts.value, total: tagProducts.value.length }];

});



function resolveTag(tagSlug: string): Tag | undefined {

  return (

    tags.value.find((item) => item.slug === tagSlug) ||

    grouped.value.find((item) => item.tag.slug === tagSlug)?.tag

  );

}



async function loadGrouped() {

  const [tagsRes, groupedRes] = await Promise.all([

    api.get<Tag[]>(`/categories/${slug.value}/tags`).catch(() => ({ data: [] as Tag[] })),

    api.get<{ groups: { tag: Tag; products: Product[]; total: number }[] }>(

      `/products/category/${slug.value}/by-tags`

    ).catch(() => ({ data: { groups: [] } })),

  ]);

  tags.value = tagsRes.data;

  grouped.value = groupedRes.data.groups || [];



  if (!grouped.value.length) {

    const { data } = await api.get<{ products: Product[] }>(

      `/products?category=${slug.value}&limit=100`

    );

    fallbackProducts.value = data.products;

  } else {

    fallbackProducts.value = [];

  }

}



async function loadTagProducts(tagSlug: string) {

  const cached = grouped.value.find((section) => section.tag.slug === tagSlug);

  if (cached && cached.total <= 100 && cached.products.length >= Math.min(cached.total, 8)) {

    if (tagSlug === 'other' || cached.total === cached.products.length) {

      tagProducts.value = cached.products;

      return;

    }

  }



  const tag = resolveTag(tagSlug);

  if (!tag && tagSlug !== 'other') {

    tagProducts.value = [];

    return;

  }



  const params = new URLSearchParams({ category: slug.value, limit: '100' });

  if (tag && tagSlug !== 'other') {

    params.set('tagId', tag.id);

  }



  const { data } = await api.get<{ products: Product[] }>(`/products?${params}`);

  if (tagSlug === 'other') {

    tagProducts.value = data.products.filter((product) => !product.tagId);

  } else if (tag) {

    tagProducts.value = data.products.filter((product) => product.tagId === tag.id);

  } else {

    tagProducts.value = [];

  }

}



async function loadPageData() {

  loading.value = true;

  try {

    await loadGrouped();

    if (selectedTag.value !== 'all') {

      await loadTagProducts(selectedTag.value);

    }

  } finally {

    loading.value = false;

  }

}



function selectTag(tagSlug: string) {

  selectedTag.value = tagSlug;

  navigateTo({ path: route.path, query: tagSlug === 'all' ? {} : { tag: tagSlug } }, { replace: true });

  if (tagSlug === 'all') return;

  loadTagProducts(tagSlug);

}



watch(

  () => route.query.tag,

  async (tag) => {

    selectedTag.value = (tag as string) || 'all';

    if (selectedTag.value !== 'all') {

      if (!grouped.value.length) await loadGrouped();

      await loadTagProducts(selectedTag.value);

    }

  }

);



watch(slug, () => {

  selectedTag.value = 'all';

  loadPageData();

});



onMounted(loadPageData);



useHead({ title: `${category.value?.name || 'دسته‌بندی'} - KIAA KALA` });

</script>



<template>

  <div class="pb-8">

    <div class="px-4 pt-4 pb-3 sticky top-14 z-30 bg-gray-50/95 backdrop-blur border-b border-gray-100">
      <h1 class="section-title mb-3">{{ category?.name }}</h1>

      <div class="flex gap-2 overflow-x-auto scrollbar-hide pb-3 mb-1">
        <NuxtLink
          to="/categories"
          class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-gray-100 text-gray-600"
        >
          همه
        </NuxtLink>
        <NuxtLink
          v-for="item in categories"
          :key="item.id"
          :to="`/categories/${item.slug}`"
          :class="[
            'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
            item.slug === slug
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          ]"
        >
          {{ item.name }}
        </NuxtLink>
      </div>

      <div v-if="showTagBar" class="flex gap-2 overflow-x-auto scrollbar-hide pb-1">

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

          همه برچسب‌ها

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

      </div>

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

          <button

            v-if="section.tag?.slug && section.total > section.products.length"

            type="button"

            class="text-xs text-primary-600 font-medium"

            @click="selectTag(section.tag.slug)"

          >

            ادامه

          </button>

        </div>



        <ProductCardList :products="section.products" layout="strip" />

      </section>



      <EmptyState

        v-if="!visibleSections.length && !fallbackProducts.length"

        message="محصولی در این دسته‌بندی یافت نشد"

      />



      <section v-if="!visibleSections.length && fallbackProducts.length" class="px-4">

        <ProductCardList :products="fallbackProducts" />

      </section>

    </div>

  </div>

</template>

