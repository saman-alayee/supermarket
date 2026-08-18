<script setup lang="ts">
import type { NuxtError } from '#app';

const props = defineProps<{ error: NuxtError }>();

const is404 = computed(() => props.error?.statusCode === 404);

const title = computed(() => (is404.value ? 'صفحه پیدا نشد' : 'خطایی رخ داد'));

const description = computed(() => {
  if (is404.value) {
    return 'آدرس وارد شده وجود ندارد یا منتقل شده است.';
  }
  return props.error?.statusMessage || props.error?.message || 'مشکلی پیش آمده است. لطفاً دوباره تلاش کنید.';
});

function goHome() {
  clearError({ redirect: '/' });
}

function goBack() {
  if (import.meta.client && window.history.length > 1) {
    clearError();
    window.history.back();
    return;
  }
  goHome();
}
</script>

<template>
  <div class="error-page min-h-screen flex flex-col items-center justify-center px-6 text-center">
    <img src="/logo.png" alt="KIAA KALA" class="w-16 h-16 object-contain mb-6" />

    <p class="text-6xl font-bold text-primary-600 tabular-nums tracking-tight">
      {{ error?.statusCode || 404 }}
    </p>
    <h1 class="mt-3 text-xl font-semibold text-gray-900">{{ title }}</h1>
    <p class="mt-2 text-sm text-gray-500 max-w-sm leading-relaxed">{{ description }}</p>

    <div class="mt-8 flex flex-col sm:flex-row gap-3 w-full max-w-xs">
      <button type="button" class="btn-primary w-full" @click="goHome">
        بازگشت به فروشگاه
      </button>
      <button type="button" class="btn-secondary w-full" @click="goBack">
        صفحه قبل
      </button>
    </div>
  </div>
</template>

<style scoped>
.error-page {
  background: linear-gradient(180deg, #ffffff 0%, #ecfdf5 55%, #dbeafe 100%);
}
</style>
