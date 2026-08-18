<script setup lang="ts">
const cartStore = useCartStore();
const { formatPrice, getProductImage } = useFormat();

onMounted(() => {
  cartStore.fetchCart();
});

useHead({ title: 'سبد خرید - هایپرمارکت' });
</script>

<template>
  <div class="px-4 py-4 max-w-lg mx-auto">
    <h1 class="section-title">سبد خرید</h1>

    <LoadingSpinner :show="cartStore.loading" />

    <div v-if="!cartStore.loading && !cartStore.isEmpty">
      <!-- Cart items -->
      <div class="space-y-3 mb-6">
        <div
          v-for="item in cartStore.items"
          :key="item.id"
          class="card flex items-center gap-3 p-3"
        >
          <img
            :src="getProductImage(item.image)"
            :alt="item.name"
            class="w-16 h-16 object-cover shrink-0"
          />
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-medium text-gray-800 truncate">{{ item.name }}</h3>
            <p v-if="item.unit" class="text-xs text-gray-400">{{ item.unit }}</p>
            <p class="text-sm font-bold text-gray-800 mt-1">{{ formatPrice(item.effectivePrice) }}</p>
          </div>
          <div class="flex items-center gap-1 bg-gray-50 rounded-full px-1">
            <button
              class="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-full"
              @click="item.quantity <= 1 ? cartStore.removeItem(item.productId) : cartStore.updateQuantity(item.productId, item.quantity - 1)"
            >
              <AppIcon name="lucide:minus" size="sm" />
            </button>
            <span class="w-6 text-center text-sm font-bold">{{ item.quantity }}</span>
            <button
              class="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-full"
              @click="cartStore.updateQuantity(item.productId, item.quantity + 1)"
            >
              <AppIcon name="lucide:plus" size="sm" />
            </button>
          </div>
        </div>
      </div>

      <!-- Summary -->
      <div class="card p-4 mb-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-gray-600">جمع کل</span>
          <span class="text-lg font-bold">{{ formatPrice(cartStore.totalPrice) }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="space-y-3 pb-24">
        <NuxtLink to="/checkout" class="btn-primary w-full block text-center">
          ادامه و ثبت سفارش
        </NuxtLink>
        <NuxtLink to="/" class="btn-secondary w-full block text-center">
          ادامه خرید
        </NuxtLink>
      </div>
    </div>

    <EmptyState v-if="!cartStore.loading && cartStore.isEmpty" message="سبد خرید شما خالی است">
      <NuxtLink to="/" class="btn-primary mt-4 inline-block">شروع خرید</NuxtLink>
    </EmptyState>
  </div>
</template>
