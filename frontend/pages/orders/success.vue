<script setup lang="ts">
const route = useRoute();
const orderNumber = route.query.number as string;

useHead({ title: 'سفارش ثبت شد - KIAA KALA' });
</script>

<template>
  <div class="px-4 py-8 max-w-lg mx-auto text-center pb-24">
    <div class="relative mx-auto w-48 h-48 mb-6">
      <div class="absolute inset-0 bg-primary-50 rounded-full animate-pulse" />
      <div class="relative flex flex-col items-center justify-center h-full">
        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-2">
          <AppIcon name="lucide:circle-check" size="xl" class="text-green-600 w-8 h-8" />
        </div>
        <AppIcon name="lucide:truck" size="xl" class="text-primary-600 w-10 h-10" />
      </div>
    </div>

    <h1 class="text-2xl font-bold text-gray-800 mb-2">سفارش شما ثبت شد!</h1>
    <p class="text-gray-600 mb-2 leading-relaxed">سفارش در حال آماده‌سازی و ارسال است.</p>
    <p class="text-sm text-primary-700 font-medium mb-6">پیک کیا کالا به زودی در راه است 🚚</p>

    <div v-if="orderNumber" class="card p-4 mb-6">
      <p class="text-sm text-gray-500 mb-1">شماره سفارش</p>
      <p class="text-xl font-bold text-primary-600" dir="ltr">{{ orderNumber }}</p>
    </div>

    <div class="bg-amber-50 text-amber-900 text-sm p-4 rounded-xl mb-6 leading-relaxed text-start">
      مبلغ سفارش هنگام تحویل یا از طریق روش انتخاب‌شده در فروشگاه ثبت می‌شود. پرداخت آنلاین در سایت انجام نشده است.
    </div>

    <div class="mx-auto max-w-lg space-y-3 md:max-w-md">
      <NuxtLink to="/" class="btn-primary btn-action w-full">بازگشت به فروشگاه</NuxtLink>
      <NuxtLink to="/profile/orders" class="btn-secondary btn-action w-full">مشاهده سفارش‌ها</NuxtLink>
    </div>
  </div>
</template>
