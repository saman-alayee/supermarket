<script setup lang="ts">
const { neshanMapsLink } = useGeocoding();

const STORE_LAT = 37.419493;
const STORE_LNG = 49.946101;
const address = 'کیاشهر، خیابان امام، ساختمان دیلی مارکت';
const phones = [
  { label: 'سفارش و پشتیبانی', value: '02191559543', href: 'tel:02191559543' },
  { label: 'پشتیبانی', value: '01342820303', href: 'tel:01342820303' },
];

useHead({ title: 'تماس با ما - Jetkala' });
</script>

<template>
  <div class="px-4 py-6 max-w-lg mx-auto pb-24">
    <h1 class="section-title">تماس با ما</h1>
    <p class="text-sm text-gray-600 mb-6 leading-relaxed">
      برای ثبت سفارش تلفنی، پیگیری سفارش یا پشتیبانی با شماره‌های زیر تماس بگیرید.
    </p>

    <div class="card p-4 space-y-4 mb-4">
      <div>
        <p class="text-xs text-gray-500 mb-1">آدرس فروشگاه</p>
        <p class="text-sm font-medium text-gray-800 leading-relaxed">{{ address }}</p>
        <a
          :href="neshanMapsLink(STORE_LAT, STORE_LNG)"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center gap-1 text-xs text-primary-600 mt-2 font-medium"
        >
          <AppIcon name="lucide:map-pin" size="sm" />
          مشاهده روی نقشه نشان
        </a>
        <AppMapPicker
          :latitude="STORE_LAT"
          :longitude="STORE_LNG"
          readonly
          height="200px"
          :zoom="16"
          class="mt-3"
        />
      </div>

      <div v-for="phone in phones" :key="phone.href" class="border-t border-gray-100 pt-3">
        <p class="text-xs text-gray-500 mb-1">{{ phone.label }}</p>
        <a :href="phone.href" class="text-lg font-bold text-primary-700" dir="ltr">{{ phone.value }}</a>
      </div>
    </div>

    <NuxtLink to="/" class="btn-secondary w-full inline-flex justify-center min-h-[48px] items-center">
      بازگشت به فروشگاه
    </NuxtLink>
  </div>
</template>
