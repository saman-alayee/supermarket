<script setup lang="ts">
import type { Category } from '~/types';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const { resolveMediaUrl } = useFormat();

const categories = ref<Category[]>([]);
const loading = ref(true);
const showForm = ref(false);
const editingId = ref<string | null>(null);

const form = reactive({ name: '', sortOrder: 0, isActive: true, image: null as string | null });

onMounted(loadData);

async function loadData() {
  loading.value = true;
  try {
    const { data } = await api.get<Category[]>('/admin/categories');
    categories.value = data;
  } finally {
    loading.value = false;
  }
}

function openForm(category?: Category) {
  if (category) {
    editingId.value = category.id;
    form.name = category.name;
    form.sortOrder = category.sortOrder;
    form.isActive = category.isActive;
    form.image = category.image;
  } else {
    editingId.value = null;
    form.name = '';
    form.sortOrder = categories.value.length;
    form.isActive = true;
    form.image = null;
  }
  showForm.value = true;
}

async function save() {
  if (editingId.value) {
    await api.put(`/admin/categories/${editingId.value}`, form);
  } else {
    await api.post('/admin/categories', form);
  }
  showForm.value = false;
  await loadData();
}

async function remove(id: string) {
  if (confirm('آیا مطمئن هستید؟')) {
    await api.delete(`/admin/categories/${id}`);
    await loadData();
  }
}

useHead({ title: 'دسته‌بندی‌ها - پنل مدیریت' });
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-gray-800 mb-6">مدیریت دسته‌بندی‌ها</h1>
    <div class="flex justify-end mb-6">
      <button class="btn-primary text-sm py-2" @click="openForm()">+ افزودن</button>
    </div>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="space-y-2">
      <div v-for="cat in categories" :key="cat.id" class="card p-4 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
            <img
              v-if="cat.image"
              :src="resolveMediaUrl(cat.image)"
              :alt="cat.name"
              class="w-9 h-9 object-contain"
            />
            <AppIcon v-else name="lucide:folder" size="md" class="text-gray-300" />
          </div>
          <div class="min-w-0">
            <p class="font-medium">{{ cat.name }}</p>
            <p class="text-xs text-gray-400">ترتیب: {{ cat.sortOrder }} | {{ cat._count?.products || 0 }} محصول</p>
          </div>
        </div>
        <div class="flex gap-2">
          <button class="text-primary-600 text-sm" @click="openForm(cat)">ویرایش</button>
          <button class="text-red-500 text-sm" @click="remove(cat.id)">حذف</button>
        </div>
      </div>
    </div>

    <div v-if="showForm" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" @click.self="showForm = false">
      <div class="bg-white rounded-2xl w-full max-w-sm p-6">
        <h2 class="text-lg font-bold mb-4">{{ editingId ? 'ویرایش' : 'افزودن' }} دسته‌بندی</h2>
        <form class="space-y-3" @submit.prevent="save">
          <AppImageUpload
            v-model="form.image"
            upload-endpoint="/admin/categories/upload"
            label="لوگو دسته‌بندی"
            hint="JPEG, PNG, WebP یا GIF — حداکثر ۵ مگابایت"
            preview-class="w-full aspect-square max-h-36"
          />
          <input v-model="form.name" required placeholder="نام دسته‌بندی" class="input-field" />
          <input v-model.number="form.sortOrder" type="number" placeholder="ترتیب" class="input-field" />
          <AppSwitch v-model="form.isActive" label="دسته‌بندی فعال" description="در فروشگاه نمایش داده شود" />
          <button type="submit" class="btn-primary w-full">ذخیره</button>
        </form>
      </div>
    </div>
  </div>
</template>
