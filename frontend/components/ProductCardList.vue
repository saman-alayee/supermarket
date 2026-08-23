<script setup lang="ts">
import type { Product } from '~/types';

const props = withDefaults(
  defineProps<{
    products: Product[];
    layout?: 'strip' | 'grid';
    density?: 'default' | 'compact';
  }>(),
  { layout: 'grid', density: 'default' }
);

const cardSize = computed(() => (props.density === 'compact' ? 'compact' : 'default'));
const stripClass = computed(() =>
  props.density === 'compact' ? 'product-card-strip product-card-strip-compact' : 'product-card-strip'
);
const slotClass = computed(() =>
  props.density === 'compact' ? 'product-card-slot product-card-slot-compact' : 'product-card-slot'
);

const stripRef = ref<HTMLElement | null>(null);
const canScrollPrev = ref(false);
const canScrollNext = ref(false);

useHorizontalDragScroll(stripRef);

function updateScrollState() {
  const el = stripRef.value;
  if (!el) return;
  const maxScroll = el.scrollWidth - el.clientWidth;
  canScrollPrev.value = el.scrollLeft > 2;
  canScrollNext.value = maxScroll > 2 && el.scrollLeft < maxScroll - 2;
}

function scrollStrip(direction: 'prev' | 'next') {
  const el = stripRef.value;
  if (!el) return;
  const step = Math.max(el.clientWidth * 0.72, 176);
  el.scrollBy({
    left: direction === 'next' ? step : -step,
    behavior: 'smooth',
  });
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (props.layout !== 'strip') return;
  nextTick(() => {
    const el = stripRef.value;
    if (el) {
      el.scrollLeft = 0;
    }
    updateScrollState();
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateScrollState();
      });
      resizeObserver.observe(el);
    }
    window.addEventListener('resize', updateScrollState);
  });
});

onUnmounted(() => {
  stripRef.value?.removeEventListener('scroll', updateScrollState);
  resizeObserver?.disconnect();
  window.removeEventListener('resize', updateScrollState);
});

watch(
  () => props.products,
  () => nextTick(() => {
    const el = stripRef.value;
    if (el) el.scrollLeft = 0;
    updateScrollState();
  }),
  { deep: true }
);
</script>

<template>
  <div v-if="layout === 'strip'" class="relative min-w-0 w-full">
    <button
      v-if="canScrollPrev"
      type="button"
      class="absolute top-[38%] start-0 z-10 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-gray-100 bg-white/95 text-gray-700 shadow-md"
      aria-label="محصولات قبلی"
      @click="scrollStrip('prev')"
    >
      <AppIcon name="lucide:chevron-right" size="sm" />
    </button>
    <button
      v-if="canScrollNext"
      type="button"
      class="absolute top-[38%] end-0 z-10 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-gray-100 bg-white/95 text-gray-700 shadow-md"
      aria-label="محصولات بعدی"
      @click="scrollStrip('next')"
    >
      <AppIcon name="lucide:chevron-left" size="sm" />
    </button>

    <!-- RTL: first product starts from the right on Persian layout -->
    <div ref="stripRef" dir="rtl" :class="stripClass">
      <div v-for="product in products" :key="product.id" :class="slotClass">
        <ProductCard :product="product" :size="cardSize" class="h-full" />
      </div>
    </div>
  </div>

  <div v-else :class="density === 'compact' ? 'product-card-grid-compact' : 'product-card-grid'">
    <ProductCard
      v-for="product in products"
      :key="product.id"
      :product="product"
      :size="cardSize"
      class="h-full"
    />
  </div>
</template>
