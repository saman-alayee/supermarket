<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string;
    to?: string;
    linkLabel?: string;
    subtitle?: string;
    variant?: 'default' | 'discount' | 'featured';
  }>(),
  { linkLabel: 'مشاهده همه', variant: 'default' }
);

const titleClass = computed(() => {
  if (props.variant === 'discount') return 'text-red-700';
  if (props.variant === 'featured') return 'text-primary-700';
  return 'text-gray-900';
});

const linkClass = computed(() => {
  if (props.variant === 'discount') return 'text-red-600 hover:text-red-700';
  return 'text-primary-600 hover:text-primary-700';
});
</script>

<template>
  <div class="flex items-end justify-between gap-3 mb-3">
    <div class="min-w-0">
      <div class="flex items-center gap-1.5 min-w-0">
        <span
          v-if="variant === 'discount'"
          class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white shadow-sm"
        >
          <AppIcon name="lucide:percent" size="xs" />
        </span>
        <span
          v-else-if="variant === 'featured'"
          class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white shadow-sm"
        >
          <AppIcon name="lucide:sparkles" size="xs" />
        </span>
        <h2 :class="['text-base font-bold leading-tight truncate', titleClass]">{{ title }}</h2>
      </div>
      <p
        v-if="subtitle"
        :class="[
          'text-xs mt-0.5',
          variant === 'discount' ? 'text-red-600/80' : variant === 'featured' ? 'text-primary-600/80' : 'text-gray-500',
        ]"
      >
        {{ subtitle }}
      </p>
    </div>
    <NuxtLink
      v-if="to"
      :to="to"
      :class="['shrink-0 text-xs font-semibold inline-flex items-center gap-0.5', linkClass]"
    >
      {{ linkLabel }}
      <AppIcon name="lucide:chevron-left" size="sm" />
    </NuxtLink>
  </div>
</template>
