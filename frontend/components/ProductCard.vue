<script setup lang="ts">
import type { Product } from '~/types';

const props = defineProps<{ product: Product }>();

const cartStore = useCartStore();
const { formatPrice, getProductImage } = useFormat();
const { isFavorite, toggleFavorite, fetchFavorites } = useFavorites();

const quantity = computed(() => cartStore.getItemQuantity(props.product.id));
const isAdding = computed(() => cartStore.addingProductId === props.product.id);
const favorited = computed(() => isFavorite(props.product.id));
const favLoading = ref(false);

onMounted(() => {
  fetchFavorites();
});

async function handleFavorite(event: Event) {
  event.preventDefault();
  event.stopPropagation();
  if (favLoading.value) return;
  favLoading.value = true;
  try {
    await toggleFavorite(props.product.id);
  } finally {
    favLoading.value = false;
  }
}

async function handleAdd() {
  await cartStore.addItem(props.product.id);
}

async function handleIncrease() {
  await cartStore.updateQuantity(props.product.id, quantity.value + 1);
}

async function handleDecrease() {
  if (quantity.value <= 1) {
    await cartStore.removeItem(props.product.id);
  } else {
    await cartStore.updateQuantity(props.product.id, quantity.value - 1);
  }
}
</script>

<template>
  <div class="group relative bg-white border border-gray-100 overflow-hidden rounded-lg">
    <button
      type="button"
      :class="[
        'absolute top-1 end-1 z-20 w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-sm',
        favorited ? 'bg-red-50 text-red-500' : 'bg-white/90 text-gray-400 hover:text-red-400',
      ]"
      :disabled="favLoading"
      aria-label="علاقه‌مندی"
      @click="handleFavorite"
    >
      <AppIcon
        :name="favorited ? 'lucide:heart' : 'lucide:heart'"
        size="sm"
        :class="favorited ? 'fill-current' : ''"
      />
    </button>

    <div
      v-if="product.discountPercent > 0"
      class="absolute top-1 start-1 z-10 bg-red-500 text-white text-[9px] font-bold px-1 py-0.5"
    >
      {{ product.discountPercent }}٪
    </div>

    <div
      v-if="product.isNew"
      class="absolute top-8 end-1 z-10 bg-accent-500 text-white text-[9px] font-bold px-1 py-0.5"
    >
      جدید
    </div>

    <NuxtLink :to="`/products/${product.slug}`" class="block aspect-[5/4] overflow-hidden bg-gray-100">
      <img
        :src="getProductImage(product.image)"
        :alt="product.name"
        class="w-full h-full object-cover"
        loading="lazy"
      />
    </NuxtLink>

    <div class="px-1.5 pt-1 pb-1.5">
      <NuxtLink :to="`/products/${product.slug}`">
        <h3 class="font-medium text-[11px] text-gray-800 line-clamp-2 leading-snug mb-0.5 min-h-[1.75rem]">
          {{ product.name }}
        </h3>
      </NuxtLink>

      <p v-if="product.unit" class="text-[9px] text-gray-400 mb-1">{{ product.unit }}</p>

      <div class="flex items-end justify-between gap-0.5">
        <div class="min-w-0">
          <p v-if="product.discountPrice" class="text-[9px] text-gray-400 line-through leading-none mb-0.5">
            {{ formatPrice(product.price) }}
          </p>
          <p class="text-[11px] font-bold text-gray-900 leading-tight">
            {{ formatPrice(product.effectivePrice) }}
          </p>
        </div>

        <div v-if="!product.inStock" class="text-[9px] text-red-500 font-medium shrink-0">
          ناموجود
        </div>
        <div v-else-if="quantity === 0" class="relative shrink-0">
          <button
            class="w-7 h-7 bg-primary-600 text-white rounded-full flex items-center justify-center
                   hover:bg-primary-700 active:scale-95 transition-all"
            :disabled="isAdding"
            @click.stop="handleAdd"
          >
            <svg v-if="!isAdding" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <svg v-else class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </button>
        </div>
        <div v-else class="flex items-center bg-primary-50 shrink-0">
          <button
            class="w-6 h-6 flex items-center justify-center text-primary-600 hover:bg-primary-100"
            @click.stop="handleDecrease"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M20 12H4" />
            </svg>
          </button>
          <span class="w-4 text-center text-[11px] font-bold text-primary-700">{{ quantity }}</span>
          <button
            class="w-6 h-6 flex items-center justify-center text-primary-600 hover:bg-primary-100"
            @click.stop="handleIncrease"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
