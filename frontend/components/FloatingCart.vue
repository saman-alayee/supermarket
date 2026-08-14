<script setup lang="ts">
const route = useRoute();
const cartStore = useCartStore();
const { formatPrice, toPersianDigits } = useFormat();

const show = computed(() => {
  if (route.path === '/checkout' || route.path.startsWith('/checkout/')) {
    return false;
  }
  return cartStore.totalItems > 0;
});
</script>

<template>
  <Transition
    enter-active-class="transition-transform duration-300 ease-out"
    enter-from-class="translate-y-full"
    enter-to-class="translate-y-0"
    leave-active-class="transition-transform duration-200 ease-in"
    leave-from-class="translate-y-0"
    leave-to-class="translate-y-full"
  >
    <div
      v-if="show"
      class="fixed bottom-16 md:bottom-4 start-4 end-4 z-40 max-w-lg mx-auto"
    >
      <NuxtLink
        to="/cart"
        class="flex items-center gap-3 bg-gray-900 text-white rounded-2xl px-4 py-3 shadow-float"
      >
        <!-- Cart icon -->
        <div class="relative">
          <AppIcon name="lucide:shopping-cart" size="lg" />
          <span class="absolute -top-2 -start-2 badge">{{ toPersianDigits(cartStore.totalItems) }}</span>
        </div>

        <!-- Total -->
        <div class="flex-1">
          <p class="text-sm font-bold">{{ formatPrice(cartStore.totalPrice) }}</p>
          <p class="text-xs text-gray-400">{{ toPersianDigits(cartStore.totalItems) }} کالا در سبد خرید</p>
        </div>

        <!-- Checkout button -->
        <span class="btn-primary text-sm py-2 px-4 whitespace-nowrap">
          تسویه حساب
        </span>
      </NuxtLink>
    </div>
  </Transition>
</template>
