<script setup lang="ts">
import type { Product } from '~/types';

const route = useRoute();
const api = useApi();
const cartStore = useCartStore();
const { formatPrice, getProductImage, resolveMediaUrl } = useFormat();
const { isFavorite, toggleFavorite, fetchFavorites } = useFavorites();

const slug = route.params.slug as string;

const { data: product } = await useAsyncData(`product-${slug}`, async () => {
  const { data } = await api.get<Product>(`/products/${slug}`);
  return data;
});

const relatedProducts = ref<Product[]>([]);

const quantity = computed(() => cartStore.getItemQuantity(product.value?.id ?? ''));
const favorited = computed(() => (product.value ? isFavorite(product.value.id) : false));

const galleryImages = computed(() => {
  if (!product.value) return [] as string[];
  if (product.value.images?.length) return product.value.images;
  return product.value.image ? [product.value.image] : [];
});

const activeImageIndex = ref(0);
const activeImage = computed(() => galleryImages.value[activeImageIndex.value] ?? null);

watch(galleryImages, (images) => {
  if (activeImageIndex.value >= images.length) {
    activeImageIndex.value = 0;
  }
});

async function buyNow() {
  if (!product.value?.inStock) return;
  await cartStore.addItem(product.value.id);
  navigateTo('/checkout');
}

async function loadRelated() {
  if (!product.value) return;
  try {
    const { data } = await api.get<Product[]>(`/products/${slug}/related?limit=12`);
    relatedProducts.value = data;
  } catch {
    relatedProducts.value = [];
  }
}

onMounted(async () => {
  await fetchFavorites();
  await loadRelated();
});

watch(product, loadRelated);

useHead({ title: `${product.value?.name || 'محصول'} - KIAA KALA` });
</script>

<template>
  <div v-if="product" class="pb-28 max-w-lg mx-auto">
    <div class="relative bg-white px-4 pt-4">
      <button
        type="button"
        :class="[
          'absolute top-5 end-5 z-10 w-9 h-9 rounded-full flex items-center justify-center shadow-sm',
          favorited ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-400',
        ]"
        @click="toggleFavorite(product.id)"
      >
        <AppIcon name="lucide:heart" size="md" :class="favorited ? 'fill-current' : ''" />
      </button>

      <div class="flex items-start gap-4">
        <div class="w-28 h-28 shrink-0 rounded-2xl bg-gray-50 overflow-hidden flex items-center justify-center">
          <img
            :src="getProductImage(activeImage)"
            :alt="product.name"
            class="w-full h-full object-contain p-2"
          />
        </div>
        <div class="min-w-0 flex-1 pt-1">
          <p v-if="product.tag?.name" class="text-xs text-primary-600 font-medium mb-1">
            {{ product.tag.icon }} {{ product.tag.name }}
          </p>
          <h1 class="text-lg font-bold text-gray-800 leading-snug">{{ product.name }}</h1>
          <p v-if="product.unit" class="text-xs text-gray-400 mt-1">{{ product.unit }}</p>
        </div>
      </div>

      <div
        v-if="galleryImages.length > 1"
        class="flex gap-2 overflow-x-auto scrollbar-hide pt-3"
      >
        <button
          v-for="(image, index) in galleryImages"
          :key="`${image}-${index}`"
          type="button"
          :class="[
            'w-14 h-14 shrink-0 rounded-xl border-2 overflow-hidden bg-white',
            activeImageIndex === index ? 'border-primary-500' : 'border-gray-200',
          ]"
          @click="activeImageIndex = index"
        >
          <img
            :src="resolveMediaUrl(image)"
            :alt="`${product.name} ${index + 1}`"
            class="w-full h-full object-contain p-1"
          />
        </button>
      </div>
    </div>

    <div class="px-4 py-4">
      <p v-if="product.description" class="text-sm text-gray-600 mb-4 leading-relaxed">
        {{ product.description }}
      </p>

      <div class="flex items-end gap-3 mb-2">
        <p v-if="product.discountPrice" class="text-sm text-gray-400 line-through">
          {{ formatPrice(product.price) }}
        </p>
        <p class="text-2xl font-bold text-gray-800">{{ formatPrice(product.effectivePrice) }}</p>
        <span
          v-if="product.discountPercent > 0"
          class="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg"
        >
          {{ product.discountPercent }}٪ تخفیف
        </span>
      </div>

      <p v-if="product.inStock" class="text-sm text-green-600">موجود در انبار</p>
      <p v-else class="text-sm text-red-500">ناموجود</p>
    </div>

    <section v-if="relatedProducts.length" class="px-4 pb-4">
      <h2 class="section-title">
        {{ product.tag?.name ? `سایر ${product.tag.name}` : 'محصولات مرتبط' }}
      </h2>
      <div class="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
        <div
          v-for="item in relatedProducts"
          :key="item.id"
          class="w-[44%] sm:w-[32%] md:w-[24%] shrink-0"
        >
          <ProductCard :product="item" />
        </div>
      </div>
    </section>

    <div v-if="product.inStock" class="fixed bottom-16 md:bottom-0 inset-x-0 z-[55] px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 bg-white/95 backdrop-blur border-t border-gray-100">
      <div class="max-w-lg mx-auto">
        <div v-if="quantity === 0" class="flex gap-2">
          <button class="btn-primary flex-1 min-h-[52px]" @click="cartStore.addItem(product.id)">
            افزودن به سبد
          </button>
          <button class="btn-secondary flex-1 min-h-[52px]" @click="buyNow">
            خرید و پرداخت
          </button>
        </div>
        <div v-else class="flex items-center justify-center gap-4 bg-primary-50 rounded-2xl p-3">
          <button
            class="w-12 h-12 bg-white rounded-full flex items-center justify-center text-primary-600 shadow-sm"
            @click="quantity <= 1 ? cartStore.removeItem(product.id) : cartStore.updateQuantity(product.id, quantity - 1)"
          >
            <AppIcon name="lucide:minus" size="md" />
          </button>
          <span class="text-xl font-bold text-primary-700 w-8 text-center">{{ quantity }}</span>
          <button
            class="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white shadow-sm"
            @click="cartStore.updateQuantity(product.id, quantity + 1)"
          >
            <AppIcon name="lucide:plus" size="md" />
          </button>
        </div>
      </div>
    </div>

    <div
      v-else
      class="fixed bottom-16 md:bottom-0 inset-x-0 z-[55] px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 bg-white/95 backdrop-blur border-t border-gray-100"
    >
      <div class="max-w-lg mx-auto">
        <button type="button" class="btn-secondary w-full min-h-[52px] opacity-70 cursor-not-allowed" disabled>
          اتمام موجودی
        </button>
      </div>
    </div>
  </div>
</template>
