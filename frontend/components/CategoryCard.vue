<script setup lang="ts">
import type { Category } from '~/types';

withDefaults(
  defineProps<{
    category: Category;
    active?: boolean;
    size?: 'md' | 'lg';
  }>(),
  {
    active: false,
    size: 'lg',
  }
);

const { getCategoryImage } = useFormat();

const categoryColors: Record<string, string> = {
  labaniat: 'bg-blue-50',
  noshedani: 'bg-cyan-50',
  tangholat: 'bg-orange-50',
  'mavad-ghazaei': 'bg-yellow-50',
  'mive-sabzi': 'bg-green-50',
  shoyandeha: 'bg-purple-50',
  'mahsulat-khane': 'bg-pink-50',
};

const sizeClasses = {
  md: {
    wrap: 'min-w-[80px]',
    box: 'w-16 h-16 rounded-2xl',
    img: 'w-11 h-11',
    text: 'text-xs',
  },
  lg: {
    wrap: 'min-w-[96px]',
    box: 'w-24 h-24 rounded-3xl',
    img: 'w-16 h-16',
    text: 'text-sm',
  },
};
</script>

<template>
  <NuxtLink
    :to="`/categories/${category.slug}`"
    :class="['flex flex-col items-center gap-2.5 cursor-pointer group shrink-0', sizeClasses[size].wrap]"
  >
    <div
      :class="[
        sizeClasses[size].box,
        'flex items-center justify-center transition-transform shadow-sm',
        categoryColors[category.slug] || 'bg-gray-50',
        active ? 'ring-2 ring-primary-400 ring-offset-2' : 'group-hover:scale-105 group-active:scale-95',
      ]"
    >
      <img
        v-if="category.image"
        :src="getCategoryImage(category.image)"
        :alt="category.name"
        :class="[sizeClasses[size].img, 'object-contain']"
      />
      <span v-else class="text-3xl">🛒</span>
    </div>
    <span
      :class="[
        sizeClasses[size].text,
        'font-semibold text-center leading-tight px-1',
        active ? 'text-primary-600' : 'text-gray-700',
      ]"
    >
      {{ category.name }}
    </span>
  </NuxtLink>
</template>
