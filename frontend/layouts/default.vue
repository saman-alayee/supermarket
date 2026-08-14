<script setup lang="ts">
const authStore = useAuthStore();
const cartStore = useCartStore();

onMounted(() => {
  authStore.init();
  cartStore.fetchCart();
});
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 safe-bottom">
      <slot />
    </main>
    <FloatingCart />
    <AppFooter />
    <BottomNav />
  </div>
</template>
