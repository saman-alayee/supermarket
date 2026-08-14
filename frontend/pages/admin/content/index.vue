<script setup lang="ts">
import type { ContentPage } from '~/types';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const toast = useToast();

const pages = ref<ContentPage[]>([]);
const loading = ref(true);
const editing = ref<ContentPage | null>(null);
const form = reactive({ title: '', body: '', isPublished: true });
const formError = ref('');

onMounted(loadPages);

async function loadPages() {
  loading.value = true;
  try {
    const { data } = await api.get<ContentPage[]>('/admin/content');
    pages.value = data;
    if (data.length && !editing.value) {
      selectPage(data[0]);
    }
  } finally {
    loading.value = false;
  }
}

function selectPage(page: ContentPage) {
  editing.value = page;
  form.title = page.title;
  form.body = page.body;
  form.isPublished = page.isPublished;
}

async function savePage() {
  if (!editing.value) return;
  formError.value = '';
  try {
    const { data } = await api.put<ContentPage>(`/admin/content/${editing.value.slug}`, form);
    toast.success('صفحه ذخیره شد');
    editing.value = data;
    await loadPages();
  } catch (e: unknown) {
    formError.value = e instanceof Error ? e.message : 'خطا در ذخیره';
    toast.error(formError.value);
  }
}

useHead({ title: 'مدیریت محتوا - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-xl font-bold text-gray-800">مدیریت محتوا</h1>
      <p class="text-sm text-gray-500 mt-1">ویرایش قوانین و مقررات و صفحات عمومی</p>
    </div>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading && editing" class="grid lg:grid-cols-[240px_1fr] gap-4">
      <div class="card p-3 space-y-1">
        <button
          v-for="page in pages"
          :key="page.slug"
          :class="[
            'w-full text-start px-3 py-2 rounded-lg text-sm',
            editing.slug === page.slug ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-gray-50',
          ]"
          @click="selectPage(page)"
        >
          {{ page.title }}
        </button>
        <NuxtLink :to="`/pages/${editing.slug}`" target="_blank" class="block text-xs text-primary-600 px-3 pt-2">
          مشاهده در سایت ↗
        </NuxtLink>
      </div>

      <div class="card p-4 space-y-4">
        <AppAlertBanner :message="formError" />

        <div>
          <label class="block text-sm font-medium mb-1">عنوان</label>
          <input v-model="form.title" class="input-field" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">محتوا (Markdown)</label>
          <textarea v-model="form.body" rows="18" class="input-field font-mono text-sm resize-y" />
        </div>
        <AppSwitch
          v-model="form.isPublished"
          label="منتشر شده"
          description="صفحه در سایت برای کاربران قابل مشاهده باشد"
        />
        <button class="btn-primary" @click="savePage">ذخیره تغییرات</button>
      </div>
    </div>

    <EmptyState v-if="!loading && !pages.length" message="صفحه‌ای تعریف نشده — seed را اجرا کنید" />
  </div>
</template>
