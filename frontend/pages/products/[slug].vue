<script setup lang="ts">
import type { Product } from '~/types';

const route = useRoute();
const api = useApi();
const cartStore = useCartStore();
const { formatPrice, getProductImage, resolveMediaUrl } = useFormat();

const slug = route.params.slug as string;

const { data: product } = await useAsyncData(`product-${slug}`, async () => {
  const { data } = await api.get<Product>(`/products/${slug}`);
  return data;
});

const quantity = computed(() => cartStore.getItemQuantity(product.value?.id ?? ''));
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

useHead({ title: `${product.value?.name || 'محصول'} - هایپرمارکت` });
</script>

<template>
  <div v-if="product" class="px-4 py-4 max-w-lg mx-auto">
    <div class="mb-6">
      <div class="aspect-square bg-gray-50 rounded-2xl p-8 mb-3">
        <img
          :src="getProductImage(activeImage)"
          :alt="product.name"
          class="w-full h-full object-contain"
        />
      </div>

      <div v-if="galleryImages.length > 1" class="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        <button
          v-for="(image, index) in galleryImages"
          :key="`${image}-${index}`"
          type="button"
          :class="[
            'w-16 h-16 shrink-0 rounded-xl border-2 overflow-hidden bg-gray-50',
            activeImageIndex === index ? 'border-primary-500' : 'border-gray-200',
          ]"
          @click="activeImageIndex = index"
        >
          <img :src="resolveMediaUrl(image)" :alt="`${product.name} ${index + 1}`" class="w-full h-full object-contain p-1" />
        </button>
      </div>
    </div>

    <div class="mb-6">
      <h1 class="text-xl font-bold text-gray-800 mb-2">{{ product.name }}</h1>
      <p v-if="product.unit" class="text-sm text-gray-400 mb-3">{{ product.unit }}</p>
      <p v-if="product.description" class="text-sm text-gray-600 mb-4">{{ product.description }}</p>

      <div class="flex items-end gap-3">
        <p v-if="product.discountPrice" class="text-sm text-gray-400 line-through">
          {{ formatPrice(product.price) }}
        </p>
        <p class="text-2xl font-bold text-gray-800">{{ formatPrice(product.effectivePrice) }}</p>
        <span v-if="product.discountPercent > 0" class="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg">
          {{ product.discountPercent }}٪ تخفیف
        </span>
      </div>

      <p v-if="product.inStock" class="text-sm text-green-600 mt-2">موجود در انبار</p>
      <p v-else class="text-sm text-red-500 mt-2">ناموجود</p>
    </div>

    <div v-if="product.inStock" class="sticky bottom-20 md:bottom-4">
      <div v-if="quantity === 0">
        <button class="btn-primary w-full" @click="cartStore.addItem(product.id)">
          افزودن به سبد خرید
        </button>
      </div>
      <div v-else class="flex items-center justify-center gap-4 bg-primary-50 rounded-2xl p-4">
        <button
          class="w-12 h-12 bg-white rounded-full flex items-center justify-center text-primary-600 shadow-sm"
          @click="quantity <= 1 ? cartStore.removeItem(product.id) : cartStore.updateQuantity(product.id, quantity - 1)"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M20 12H4" />
          </svg>
        </button>
        <span class="text-xl font-bold text-primary-700 w-8 text-center">{{ quantity }}</span>
        <button
          class="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white shadow-sm"
          @click="cartStore.updateQuantity(product.id, quantity + 1)"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
