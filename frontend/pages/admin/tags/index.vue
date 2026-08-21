<script setup lang="ts">
import type { Tag, Category } from '~/types';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const toast = useToast();

const tags = ref<Tag[]>([]);
const categories = ref<Category[]>([]);
const loading = ref(true);
const showForm = ref(false);
const editingId = ref<string | null>(null);

const form = reactive({
  name: '',
  categoryId: '',
  icon: '',
  sortOrder: 0,
});

const search = ref('');
const categoryFilter = ref('');

const filteredTags = computed(() =>
  tags.value.filter((tag) => {
    if (categoryFilter.value && tag.categoryId !== categoryFilter.value) return false;
    if (!search.value.trim()) return true;
    const term = search.value.trim();
    return tag.name.includes(term) || tag.slug.includes(term);
  })
);

onMounted(loadData);

async function loadData() {
  loading.value = true;
  try {
    const [tagsRes, catRes] = await Promise.all([
      api.get<Tag[]>('/admin/tags'),
      api.get<Category[]>('/admin/categories'),
    ]);
    tags.value = tagsRes.data;
    categories.value = catRes.data;
  } finally {
    loading.value = false;
  }
}

function openForm(tag?: Tag) {
  if (tag) {
    editingId.value = tag.id;
    Object.assign(form, { name: tag.name, categoryId: tag.categoryId, icon: tag.icon || '', sortOrder: tag.sortOrder });
  } else {
    editingId.value = null;
    Object.assign(form, { name: '', categoryId: categories.value[0]?.id || '', icon: '', sortOrder: 0 });
  }
  showForm.value = true;
}

async function save() {
  try {
    const payload = { ...form, icon: form.icon || null };
    if (editingId.value) {
      await api.put(`/admin/tags/${editingId.value}`, payload);
      toast.success('برچسب به‌روزرسانی شد');
    } else {
      await api.post('/admin/tags', payload);
      toast.success('برچسب ایجاد شد');
    }
    showForm.value = false;
    await loadData();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا');
  }
}

async function remove(id: string) {
  if (!confirm('این برچسب حذف شود؟')) return;
  await api.delete(`/admin/tags/${id}`);
  toast.success('حذف شد');
  await loadData();
}

useHead({ title: 'برچسب‌ها - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold">برچسب محصولات</h1>
        <p class="text-sm text-gray-500 mt-1">تفکیک محصولات داخل هر دسته</p>
      </div>
      <button class="btn-primary text-sm" @click="openForm()">+ برچسب جدید</button>
    </div>

    <div class="flex flex-col md:flex-row gap-3 mb-4">
      <input v-model="search" type="search" class="input-field md:max-w-xs" placeholder="جستجو برچسب..." />
      <AppSelect
        v-model="categoryFilter"
        :options="[{ value: '', label: 'همه دسته‌ها', icon: 'lucide:layers' }, ...categories.map((c) => ({ value: c.id, label: c.name, icon: 'lucide:folder' }))]"
        class="md:max-w-xs"
      />
    </div>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="grid gap-3">
      <div v-for="tag in filteredTags" :key="tag.id" class="card p-4 flex items-center justify-between gap-3">
        <div>
          <p class="font-semibold">{{ tag.icon }} {{ tag.name }}</p>
          <p class="text-xs text-gray-500 mt-1">{{ tag.category?.name }} • {{ tag._count?.products ?? 0 }} محصول</p>
        </div>
        <div class="flex gap-2">
          <button class="btn-secondary text-sm" @click="openForm(tag)">ویرایش</button>
          <button class="text-sm text-red-500 px-3" @click="remove(tag.id)">حذف</button>
        </div>
      </div>
    </div>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/40">
      <form class="bg-white rounded-2xl w-full max-w-md p-6 space-y-4" @submit.prevent="save">
        <h2 class="font-bold text-lg">{{ editingId ? 'ویرایش برچسب' : 'برچسب جدید' }}</h2>
        <input v-model="form.name" required class="input-field" placeholder="نام برچسب (مثلاً ماست)" />
        <select v-model="form.categoryId" required class="input-field">
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
        </select>
        <input v-model="form.icon" class="input-field" placeholder="آیکن (emoji مثل 🥛)" />
        <input v-model.number="form.sortOrder" type="number" class="input-field" placeholder="ترتیب" />
        <div class="flex gap-2">
          <button type="submit" class="btn-primary flex-1">ذخیره</button>
          <button type="button" class="btn-secondary flex-1" @click="showForm = false">انصراف</button>
        </div>
      </form>
    </div>
  </div>
</template>
