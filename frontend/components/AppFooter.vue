<script setup lang="ts">
import { SITE_NAME } from '~/constants/site';

const { formatJalaliYear } = useFormat();

const links = [
  { to: '/contact', label: 'تماس با ما' },
  { to: '/pages/terms', label: 'قوانین و مقررات' },
  { to: '/profile/orders', label: 'پیگیری سفارش' },
  { to: '/auth/login', label: 'ورود' },
];
</script>

<template>
  <footer class="hidden md:block bg-white border-t border-gray-100 mt-8 pb-6">
    <div class="max-w-7xl mx-auto px-4 py-6">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <AppLogo size="sm" />
        <nav class="flex flex-wrap gap-4 text-sm text-gray-500">
          <NuxtLink v-for="link in links" :key="link.to" :to="link.to" class="hover:text-primary-600">
            {{ link.label }}
          </NuxtLink>
        </nav>
      </div>
      <p class="text-xs text-gray-400 mt-4">© {{ formatJalaliYear() }} {{ SITE_NAME }} — فروشگاه آنلاین</p>
    </div>
  </footer>
</template>
