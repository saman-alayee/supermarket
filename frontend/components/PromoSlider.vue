<script setup lang="ts">
import type { Slider } from '~/types';

const props = withDefaults(
  defineProps<{
    sliders: Slider[];
    autoplayMs?: number;
    aspectClass?: string;
    compact?: boolean;
  }>(),
  {
    autoplayMs: 4500,
    aspectClass: 'aspect-[2/1] sm:aspect-[21/9] md:aspect-[3/1]',
    compact: false,
  }
);

const { resolveMediaUrl } = useFormat();

const activeIndex = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

function goTo(index: number) {
  if (!props.sliders.length) return;
  activeIndex.value = (index + props.sliders.length) % props.sliders.length;
}

function startAutoplay() {
  stopAutoplay();
  if (props.sliders.length <= 1) return;
  timer = setInterval(() => goTo(activeIndex.value + 1), props.autoplayMs);
}

function stopAutoplay() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

watch(
  () => props.sliders.length,
  () => {
    activeIndex.value = 0;
    startAutoplay();
  }
);

onMounted(startAutoplay);
onUnmounted(stopAutoplay);
</script>

<template>
  <section v-if="sliders.length" :class="compact ? 'px-4 pt-3' : 'px-3 sm:px-4 pt-3'">
    <div
      class="relative overflow-hidden rounded-2xl bg-gray-100 shadow-sm"
      @mouseenter="stopAutoplay"
      @mouseleave="startAutoplay"
      @touchstart.passive="stopAutoplay"
      @touchend.passive="startAutoplay"
    >
      <div :class="['relative w-full', aspectClass]">
        <component
          :is="slider.linkUrl ? 'NuxtLink' : 'div'"
          v-for="(slider, index) in sliders"
          v-show="index === activeIndex"
          :key="slider.id"
          :to="slider.linkUrl || undefined"
          class="absolute inset-0 block"
        >
          <img
            :src="resolveMediaUrl(slider.image)"
            :alt="slider.title || 'بنر تبلیغاتی'"
            class="w-full h-full object-cover"
            :loading="index === 0 ? 'eager' : 'lazy'"
          />
        </component>
      </div>

      <button
        v-if="sliders.length > 1"
        type="button"
        class="absolute top-1/2 start-2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 text-gray-700 flex items-center justify-center shadow-sm"
        aria-label="اسلاید قبلی"
        @click="goTo(activeIndex - 1)"
      >
        <AppIcon name="lucide:chevron-right" size="sm" />
      </button>
      <button
        v-if="sliders.length > 1"
        type="button"
        class="absolute top-1/2 end-2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 text-gray-700 flex items-center justify-center shadow-sm"
        aria-label="اسلاید بعدی"
        @click="goTo(activeIndex + 1)"
      >
        <AppIcon name="lucide:chevron-left" size="sm" />
      </button>

      <div v-if="sliders.length > 1" class="absolute bottom-2.5 inset-x-0 flex justify-center gap-1.5 z-10">
        <button
          v-for="(_, index) in sliders"
          :key="index"
          type="button"
          :class="[
            'h-1.5 rounded-full transition-all',
            index === activeIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/55',
          ]"
          :aria-label="`اسلاید ${index + 1}`"
          @click="goTo(index)"
        />
      </div>
    </div>
  </section>
</template>
