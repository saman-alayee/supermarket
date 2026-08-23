<script setup lang="ts">
import type { Product } from '~/types';

const cartStore = useCartStore();
const api = useApi();
const { formatPrice, getProductImage } = useFormat();

const suggestedProducts = ref<Product[]>([]);
const suggestionsLoading = ref(false);

async function loadSuggestions() {
  if (cartStore.isEmpty) {
    suggestedProducts.value = [];
    return;
  }

  suggestionsLoading.value = true;
  try {
    const inCart = new Set(cartStore.items.map((item) => item.productId));
    const { data } = await api.get<{ products: Product[] }>('/products?discounted=true&limit=20');
    suggestedProducts.value = data.products.filter((product) => !inCart.has(product.id)).slice(0, 12);
  } catch {
    suggestedProducts.value = [];
  } finally {
    suggestionsLoading.value = false;
  }
}

onMounted(async () => {
  await cartStore.fetchCart();
  await loadSuggestions();
});

watch(
  () => cartStore.items.map((item) => item.productId).join(','),
  loadSuggestions
);

useHead({ title: 'سبد خرید - KIAA KALA' });
</script>

<template>
  <div class="py-4 pb-28 md:pb-10">
    <div class="px-4 max-w-lg md:max-w-2xl mx-auto">
      <h1 class="section-title">سبد خرید</h1>

      <LoadingSpinner :show="cartStore.loading" />

      <div v-if="!cartStore.loading && !cartStore.isEmpty">
        <div class="space-y-3 mb-6">
          <div
            v-for="item in cartStore.items"
            :key="item.id"
            class="card flex items-center gap-3 p-3.5 md:p-4"
          >
            <NuxtLink :to="`/products/${item.slug}`" class="shrink-0">
              <img
                :src="getProductImage(item.image)"
                :alt="item.name"
                class="h-[88px] w-[88px] rounded-xl object-cover md:h-[96px] md:w-[96px]"
              />
            </NuxtLink>

            <div class="min-w-0 flex-1">
              <NuxtLink :to="`/products/${item.slug}`">
                <h3 class="line-clamp-2 text-sm font-semibold leading-snug text-gray-800 md:text-base">
                  {{ item.name }}
                </h3>
              </NuxtLink>
              <p v-if="item.unit" class="mt-0.5 text-xs text-gray-400 md:text-sm">{{ item.unit }}</p>
              <p class="price-text mt-1.5 text-base font-bold text-gray-900 md:text-lg">
                {{ formatPrice(item.effectivePrice) }}
              </p>
            </div>

            <div class="flex shrink-0 items-center gap-0.5 rounded-full bg-gray-50 px-1 py-0.5">
              <button
                type="button"
                class="flex h-10 w-10 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
                @click="item.quantity <= 1 ? cartStore.removeItem(item.productId) : cartStore.updateQuantity(item.productId, item.quantity - 1)"
              >
                <AppIcon name="lucide:minus" size="sm" />
              </button>
              <span class="w-7 text-center text-base font-bold">{{ item.quantity }}</span>
              <button
                type="button"
                class="flex h-10 w-10 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
                @click="cartStore.updateQuantity(item.productId, item.quantity + 1)"
              >
                <AppIcon name="lucide:plus" size="sm" />
              </button>
            </div>
          </div>
        </div>

        <div class="card mb-5 p-4 md:p-5">
          <div class="flex items-center justify-between">
            <span class="text-base text-gray-600">جمع کل</span>
            <span class="price-text text-xl font-bold md:text-2xl">{{ formatPrice(cartStore.totalPrice) }}</span>
          </div>
        </div>

        <div class="space-y-3">
          <NuxtLink to="/checkout" class="btn-primary btn-action w-full">
            ادامه و ثبت سفارش
          </NuxtLink>
          <NuxtLink to="/" class="btn-secondary btn-action w-full">
            ادامه خرید
          </NuxtLink>
        </div>
      </div>

      <EmptyState v-if="!cartStore.loading && cartStore.isEmpty" message="سبد خرید شما خالی است">
        <NuxtLink to="/" class="btn-primary btn-action mt-4 inline-flex px-8">شروع خرید</NuxtLink>
      </EmptyState>
    </div>

    <section v-if="!cartStore.isEmpty" class="mx-auto mt-8 max-w-6xl px-4">
      <h2 class="section-title">پیشنهاد برای تکمیل خرید</h2>
      <LoadingSpinner :show="suggestionsLoading" />
      <ProductCardList v-if="!suggestionsLoading && suggestedProducts.length" :products="suggestedProducts" layout="grid" />
      <EmptyState
        v-else-if="!suggestionsLoading && !suggestedProducts.length"
        message="پیشنهاد دیگری موجود نیست"
      />
    </section>
  </div>
</template>
