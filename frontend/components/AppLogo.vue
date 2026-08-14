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
  sm: 'h-8',
  md: 'h-10 md:h-11',
  lg: 'h-12 md:h-14',
};
</script>

<template>
  <component :is="link ? 'NuxtLink' : 'div'" :to="link ? '/' : undefined" class="inline-flex items-center shrink-0">
    <img
      src="/logo.svg"
      alt="KIAA KALA"
      :class="[sizeClass[size], 'w-auto object-contain']"
    />
  </component>
</template>
