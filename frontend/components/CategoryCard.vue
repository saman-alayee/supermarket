<script setup lang="ts">
import type { Category } from '~/types';

defineProps<{
  category: Category;
  active?: boolean;
}>();

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
</script>

<template>
  <NuxtLink
    :to="`/categories/${category.slug}`"
    class="flex flex-col items-center gap-2 min-w-[72px] cursor-pointer group"
  >
    <div
      :class="[
        'w-16 h-16 rounded-2xl flex items-center justify-center transition-all',
        categoryColors[category.slug] || 'bg-gray-50',
        active ? 'ring-2 ring-primary-500 ring-offset-2' : 'group-hover:scale-105',
      ]"
    >
      <img
        v-if="category.image"
        :src="getCategoryImage(category.image)"
        :alt="category.name"
        class="w-10 h-10 object-contain"
      />
      <span v-else class="text-2xl">🛒</span>
    </div>
    <span
      :class="[
        'text-xs font-medium text-center',
        active ? 'text-primary-600' : 'text-gray-600',
      ]"
    >
      {{ category.name }}
    </span>
  </NuxtLink>
</template>
