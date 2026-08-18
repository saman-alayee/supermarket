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
  <component :is="link ? 'NuxtLink' : 'div'" :to="link ? '/' : undefined" class="inline-flex items-center shrink-0">
    <img
      src="/logo.png"
      alt="KIAA KALA"
      :class="[sizeClass[size], 'w-auto object-contain drop-shadow-sm scale-110']"
      style="filter: contrast(1.08) saturate(1.1);"
    />
  </component>
</template>
