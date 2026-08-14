<script setup lang="ts">
const route = useRoute();
const slug = computed(() => route.params.slug as string);

const page = ref<{ title: string; body: string; updatedAt: string } | null>(null);
const loading = ref(true);
const error = ref('');
const { formatShortDate } = useFormat();

onMounted(async () => {
  try {
    const api = useApi();
    const { data } = await api.get<typeof page.value>(`/content/${slug.value}`);
    page.value = data;
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'صفحه یافت نشد';
  } finally {
    loading.value = false;
  }
});

function renderMarkdown(text: string) {
  return text
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mb-3">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-4 mb-2">$1</h2>')
    .replace(/^- (.+)$/gm, '<li class="mr-4">$1</li>')
    .replace(/\n\n/g, '<br><br>');
}

useHead(() => ({ title: page.value?.title || 'صفحه' }));
</script>

<template>
  <div class="px-4 py-4 max-w-3xl mx-auto pb-24">
    <LoadingSpinner :show="loading" />

    <div v-if="error" class="text-center text-red-500 py-12">{{ error }}</div>

    <article v-else-if="page" class="card p-6">
      <h1 class="text-xl font-bold text-gray-800 mb-4">{{ page.title }}</h1>
      <div class="prose prose-sm max-w-none text-gray-700 leading-7" v-html="renderMarkdown(page.body)" />
      <p class="text-xs text-gray-400 mt-6">آخرین به‌روزرسانی: {{ formatShortDate(page.updatedAt) }}</p>
    </article>
  </div>
</template>
