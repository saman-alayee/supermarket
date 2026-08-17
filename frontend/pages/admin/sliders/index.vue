<script setup lang="ts">
import type { Slider } from '~/types';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const toast = useToast();
const { resolveMediaUrl } = useFormat();

const sliders = ref<Slider[]>([]);
const loading = ref(true);
const showForm = ref(false);
const editingId = ref<string | null>(null);
const uploading = ref(false);

const form = reactive({
  title: '',
  image: '',
  linkUrl: '',
  sortOrder: 0,
  placement: 'HOME_TOP' as 'HOME_TOP' | 'HOME_MID',
  isActive: true,
});

onMounted(loadSliders);

async function loadSliders() {
  loading.value = true;
  try {
    const { data } = await api.get<Slider[]>('/admin/sliders');
    sliders.value = data;
  } finally {
    loading.value = false;
  }
}

function openForm(slider?: Slider) {
  if (slider) {
    editingId.value = slider.id;
    Object.assign(form, slider);
  } else {
    editingId.value = null;
    Object.assign(form, { title: '', image: '', linkUrl: '', sortOrder: 0, placement: 'HOME_TOP', isActive: true });
  }
  showForm.value = true;
}

async function uploadImage(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    const fd = new FormData();
    fd.append('image', file);
    const { data } = await api.upload<{ url: string }>('/admin/sliders/upload', fd);
    form.image = data.url;
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'خطا در آپلود');
  } finally {
    uploading.value = false;
  }
}

async function save() {
  try {
    const payload = { ...form, linkUrl: form.linkUrl || null };
    if (editingId.value) {
      await api.put(`/admin/sliders/${editingId.value}`, payload);
      toast.success('اسلایدر به‌روزرسانی شد');
    } else {
      await api.post('/admin/sliders', payload);
      toast.success('اسلایدر ایجاد شد');
    }
    showForm.value = false;
    await loadSliders();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا');
  }
}

async function remove(id: string) {
  if (!confirm('حذف شود؟')) return;
  await api.delete(`/admin/sliders/${id}`);
  await loadSliders();
}

useHead({ title: 'اسلایدر - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold">اسلایدرها</h1>
        <p class="text-sm text-gray-500 mt-1">پروموشن صفحه اصلی (حداکثر ۴تایی)</p>
      </div>
      <button class="btn-primary text-sm" @click="openForm()">+ اسلایدر</button>
    </div>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="grid md:grid-cols-2 gap-4">
      <div v-for="slider in sliders" :key="slider.id" class="card overflow-hidden">
        <img :src="resolveMediaUrl(slider.image)" :alt="slider.title || ''" class="w-full aspect-[16/7] object-cover" />
        <div class="p-4 flex items-center justify-between gap-2">
          <div>
            <p class="font-medium">{{ slider.title || 'بدون عنوان' }}</p>
            <p class="text-xs text-gray-500">{{ slider.placement === 'HOME_TOP' ? 'بالای صفحه' : 'میان دسته‌ها' }}</p>
          </div>
          <div class="flex gap-2">
            <button class="btn-secondary text-sm" @click="openForm(slider)">ویرایش</button>
            <button class="text-red-500 text-sm" @click="remove(slider.id)">حذف</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <form class="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" @submit.prevent="save">
        <h2 class="font-bold text-lg">{{ editingId ? 'ویرایش' : 'اسلایدر جدید' }}</h2>
        <input v-model="form.title" class="input-field" placeholder="عنوان" />
        <select v-model="form.placement" class="input-field">
          <option value="HOME_TOP">بالای صفحه</option>
          <option value="HOME_MID">میان دسته‌ها</option>
        </select>
        <input v-model="form.linkUrl" class="input-field" placeholder="لینک (اختیاری)" dir="ltr" />
        <input v-model.number="form.sortOrder" type="number" class="input-field" placeholder="ترتیب" />
        <AppSwitch v-model="form.isActive" label="فعال" />
        <div>
          <input type="file" accept="image/*" @change="uploadImage" />
          <img v-if="form.image" :src="resolveMediaUrl(form.image)" class="mt-2 h-24 rounded-lg object-cover" />
        </div>
        <div class="flex gap-2">
          <button type="submit" class="btn-primary flex-1" :disabled="!form.image || uploading">ذخیره</button>
          <button type="button" class="btn-secondary flex-1" @click="showForm = false">انصراف</button>
        </div>
      </form>
    </div>
  </div>
</template>
