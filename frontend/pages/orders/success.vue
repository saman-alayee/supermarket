<script setup lang="ts">
const route = useRoute();
const orderNumber = route.query.number as string;

useHead({ title: 'سفارش ثبت شد - هایپرمارکت' });
</script>

<template>
  <div class="px-4 py-8 max-w-lg mx-auto text-center">
    <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
      <AppIcon name="lucide:circle-check" size="xl" class="text-green-600 w-10 h-10" />
    </div>

    <h1 class="text-2xl font-bold text-gray-800 mb-2">سفارش شما ثبت شد!</h1>
    <p class="text-gray-600 mb-6">سفارش شما با موفقیت ثبت شد و به زودی آماده و ارسال خواهد شد.</p>

    <div v-if="orderNumber" class="card p-4 mb-6">
      <p class="text-sm text-gray-500 mb-1">شماره سفارش</p>
      <p class="text-xl font-bold text-primary-600" dir="ltr">{{ orderNumber }}</p>
    </div>

    <div class="bg-yellow-50 text-yellow-800 text-sm p-4 rounded-xl mb-6">
      پرداخت مبلغ سفارش هنگام تحویل انجام می‌شود.
    </div>

    <div class="space-y-3">
      <NuxtLink to="/" class="btn-primary w-full block">بازگشت به فروشگاه</NuxtLink>
      <NuxtLink to="/profile/orders" class="btn-secondary w-full block">مشاهده سفارش‌ها</NuxtLink>
    </div>
  </div>
</template>
