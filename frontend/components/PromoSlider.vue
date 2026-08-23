<script setup lang="ts">
import type { Slider } from '~/types';

const props = withDefaults(
  defineProps<{
    sliders: Slider[];
    autoplayMs?: number;
    /** carousel = اسلایدر افقی | tiles = چند بنر کوچک کنار هم در دسکتاپ */
    variant?: 'carousel' | 'tiles';
    heightClass?: string;
    compact?: boolean;
  }>(),
  {
    autoplayMs: 5000,
    variant: 'carousel',
    heightClass: 'h-[72px] sm:h-[80px] md:h-[92px]',
    compact: false,
  }
);

const { resolveMediaUrl } = useFormat();

const activeIndex = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;
let touchStartX = 0;
let touchStartY = 0;

const tileSliders = computed(() => props.sliders.slice(0, 3));

const tileGridClass = computed(() => {
  const count = tileSliders.value.length;
  if (count <= 1) return 'md:grid-cols-1 md:max-w-md md:mx-auto';
  if (count === 2) return 'md:grid-cols-2';
  return 'md:grid-cols-3';
});

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

function onTouchStart(event: TouchEvent) {
  const touch = event.touches[0];
  if (!touch) return;
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  stopAutoplay();
}

function onTouchEnd(event: TouchEvent) {
  const touch = event.changedTouches[0];
  if (!touch) {
    startAutoplay();
    return;
  }

  const deltaX = touch.clientX - touchStartX;
  const deltaY = touch.clientY - touchStartY;

  if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
    goTo(activeIndex.value + (deltaX > 0 ? -1 : 1));
  }

  startAutoplay();
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
  <section v-if="sliders.length" :class="compact ? 'px-4 pt-2' : 'px-4 pt-3'">
    <!-- دسکتاپ: چند بنر کوچک کنار هم -->
    <div
      v-if="variant === 'tiles'"
      :class="['hidden md:grid gap-3', tileGridClass]"
    >
      <component
        :is="slider.linkUrl ? 'NuxtLink' : 'div'"
        v-for="(slider, index) in tileSliders"
        :key="slider.id"
        :to="slider.linkUrl || undefined"
        :class="[
          'relative overflow-hidden rounded-xl bg-gray-100 shadow-sm ring-1 ring-black/5 transition-transform hover:scale-[1.01]',
          heightClass,
          index === 1 && tileSliders.length === 3 ? 'md:scale-[1.02] md:shadow-md' : '',
        ]"
      >
        <img
          :src="resolveMediaUrl(slider.image)"
          :alt="slider.title || 'بنر تبلیغاتی'"
          class="h-full w-full object-cover"
          loading="lazy"
          draggable="false"
        />
      </component>
    </div>

    <!-- موبایل یا حالت carousel -->
    <div
      :class="variant === 'tiles' ? 'md:hidden' : ''"
      class="relative overflow-hidden rounded-xl bg-gray-100 shadow-sm ring-1 ring-black/5"
      @mouseenter="stopAutoplay"
      @mouseleave="startAutoplay"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
    >
      <div dir="ltr" :class="['relative w-full overflow-hidden', heightClass]">
        <div
          class="flex h-full w-full transition-transform duration-500 ease-out will-change-transform"
          :style="{ transform: `translateX(-${activeIndex * 100}%)` }"
        >
          <component
            :is="slider.linkUrl ? 'NuxtLink' : 'div'"
            v-for="(slider, index) in sliders"
            :key="slider.id"
            :to="slider.linkUrl || undefined"
            class="relative block h-full w-full shrink-0 grow-0 basis-full"
          >
            <img
              :src="resolveMediaUrl(slider.image)"
              :alt="slider.title || 'بنر تبلیغاتی'"
              class="h-full w-full object-cover"
              :loading="index === 0 ? 'eager' : 'lazy'"
              draggable="false"
            />
          </component>
        </div>
      </div>

      <button
        v-if="sliders.length > 1"
        type="button"
        class="absolute top-1/2 start-1.5 z-20 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-sm"
        aria-label="اسلاید قبلی"
        @click.stop="goTo(activeIndex - 1)"
      >
        <AppIcon name="lucide:chevron-right" size="xs" />
      </button>
      <button
        v-if="sliders.length > 1"
        type="button"
        class="absolute top-1/2 end-1.5 z-20 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-sm"
        aria-label="اسلاید بعدی"
        @click.stop="goTo(activeIndex + 1)"
      >
        <AppIcon name="lucide:chevron-left" size="xs" />
      </button>

      <div v-if="sliders.length > 1" class="absolute inset-x-0 bottom-1.5 z-20 flex justify-center gap-1">
        <button
          v-for="(_, index) in sliders"
          :key="index"
          type="button"
          :class="[
            'h-1 rounded-full transition-all',
            index === activeIndex ? 'w-4 bg-white' : 'w-1 bg-white/55',
          ]"
          :aria-label="`اسلاید ${index + 1}`"
          @click.stop="goTo(index)"
        />
      </div>
    </div>
  </section>
</template>
