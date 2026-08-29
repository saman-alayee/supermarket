<script setup lang="ts">
import { SITE_NAME } from '~/constants/site';

withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg';
    link?: boolean;
  }>(),
  {
    size: 'md',
    link: true,
  }
);

const sizeClass = {
  sm: 'h-11',
  md: 'h-14 md:h-16',
  lg: 'h-16 md:h-20',
};
</script>

<template>
  <NuxtLink
    v-if="link"
    to="/"
    class="inline-flex items-center shrink-0 relative z-10 cursor-pointer"
    :aria-label="`صفحه اصلی ${SITE_NAME}`"
  >
    <img
      src="/logo.png"
      :alt="SITE_NAME"
      :class="[sizeClass[size], 'w-auto object-contain']"
    />
  </NuxtLink>
  <div v-else class="inline-flex items-center shrink-0">
    <img
      src="/logo.png"
      :alt="SITE_NAME"
      :class="[sizeClass[size], 'w-auto object-contain']"
    />
  </div>
</template>
