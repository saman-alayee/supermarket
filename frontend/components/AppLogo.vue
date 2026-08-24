<script setup lang="ts">
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
    aria-label="صفحه اصلی KIAA KALA"
  >
    <img
      src="/logo.png"
      alt="KIAA KALA"
      :class="[sizeClass[size], 'w-auto object-contain drop-shadow-sm scale-110']"
      style="filter: contrast(1.08) saturate(1.1);"
    />
  </NuxtLink>
  <div v-else class="inline-flex items-center shrink-0">
    <img
      src="/logo.png"
      alt="KIAA KALA"
      :class="[sizeClass[size], 'w-auto object-contain drop-shadow-sm scale-110']"
      style="filter: contrast(1.08) saturate(1.1);"
    />
  </div>
</template>
