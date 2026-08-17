<script setup lang="ts">
import type { Slider } from '~/types';

const props = withDefaults(
  defineProps<{
    sliders: Slider[];
    autoplayMs?: number;
    aspectClass?: string;
  }>(),
  {
    autoplayMs: 5000,
    aspectClass: 'aspect-[21/9] md:aspect-[3/1]',
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
  <section v-if="sliders.length" class="px-4 pt-3">
    <div
      class="relative overflow-hidden rounded-2xl bg-gray-100 shadow-sm"
      @mouseenter="stopAutoplay"
      @mouseleave="startAutoplay"
      @touchstart.passive="stopAutoplay"
      @touchend.passive="startAutoplay"
    >
      <div :class="['relative w-full', aspectClass]">
        <TransitionGroup name="fade">
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
              loading="lazy"
            />
            <div
              v-if="slider.title"
              class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3"
            >
              <p class="text-white text-sm font-semibold">{{ slider.title }}</p>
            </div>
          </component>
        </TransitionGroup>
      </div>

      <div v-if="sliders.length > 1" class="absolute bottom-2 inset-x-0 flex justify-center gap-1.5 z-10">
        <button
          v-for="(_, index) in sliders"
          :key="index"
          type="button"
          :class="[
            'h-1.5 rounded-full transition-all',
            index === activeIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/50',
          ]"
          :aria-label="`اسلاید ${index + 1}`"
          @click="goTo(index)"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
