<script setup lang="ts">
import { useOrdersStore } from '~/stores/orders';

const authStore = useAuthStore();
const cartStore = useCartStore();
const ordersStore = useOrdersStore();

onMounted(() => {
  authStore.init();
  cartStore.fetchCart();
  ordersStore.fetchCount();
});

watch(
  () => authStore.isLoggedIn,
  (loggedIn) => {
    if (loggedIn) ordersStore.fetchCount();
    else ordersStore.totalCount = 0;
  }
);
</script>

<template>
  <div class="min-h-screen flex min-w-0 flex-col overflow-x-clip">
    <AppHeader />
    <main class="min-w-0 flex-1 safe-bottom">
      <slot />
    </main>
    <FloatingCart />
    <AppFooter />
    <BottomNav />
  </div>
</template>
