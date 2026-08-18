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

const sizeHint = computed(() =>
  form.placement === 'HOME_TOP'
    ? 'سایز پیشنهادی بنر بالا: ۱۶۰۰ × ۷۰۰ پیکسل (نسبت حدود ۲ به ۱)'
    : 'سایز پیشنهادی بنر میانی: ۱۶۰۰ × ۵۶۰ پیکسل (نسبت حدود ۱۶ به ۷)'
);

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
    Object.assign(form, {
      title: slider.title || '',
      image: slider.image,
      linkUrl: slider.linkUrl || '',
      sortOrder: slider.sortOrder,
      placement: slider.placement,
      isActive: slider.isActive,
    });
  } else {
    editingId.value = null;
    Object.assign(form, {
      title: '',
      image: '',
      linkUrl: '',
      sortOrder: sliders.value.length + 1,
      placement: 'HOME_TOP',
      isActive: true,
    });
  }
  showForm.value = true;
}

async function uploadImage(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 1.5 * 1024 * 1024) {
    toast.error('حجم تصویر باید کمتر از ۱٫۵ مگابایت باشد');
    return;
  }
  uploading.value = true;
  try {
    const { data } = await api.upload<{ url: string }>('/admin/sliders/upload', file);
    form.image = data.url;
    toast.success('تصویر آپلود شد');
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'خطا در آپلود');
  } finally {
    uploading.value = false;
    input.value = '';
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
  if (!confirm('این اسلایدر حذف شود؟')) return;
  await api.delete(`/admin/sliders/${id}`);
  await loadSliders();
}

useHead({ title: 'اسلایدر - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-xl font-bold">اسلایدر صفحه اصلی</h1>
        <p class="text-sm text-gray-500 mt-1">بنرهای بالای فروشگاه و بین دسته‌ها</p>
      </div>
      <button class="btn-primary text-sm" @click="openForm()">+ اسلایدر جدید</button>
    </div>

    <div class="card p-4 mb-6 text-sm text-gray-700 leading-7 bg-primary-50/40 border border-primary-100">
      <p class="font-bold text-gray-800 mb-2">راهنمای ادمین</p>
      <ul class="list-disc pr-5 space-y-1">
        <li>بنر <b>بالای صفحه</b> اولین چیزی است که مشتری می‌بیند؛ تصویر افقی و واضح بگذارید.</li>
        <li>سایز مناسب بنر بالا: <b>۱۶۰۰ × ۷۰۰</b> پیکسل. اگر تصویر مربعی باشد، دو طرف آن برش می‌خورد.</li>
        <li>بنر <b>میان دسته‌ها</b> کمی کوتاه‌تر است: <b>۱۶۰۰ × ۵۶۰</b> پیکسل.</li>
        <li>فرمت JPG یا PNG، حجم کمتر از ۱٫۵ مگابایت. متن مهم را وسط تصویر نگذارید تا در موبایل نپرد.</li>
        <li>حداکثر <b>۴ اسلاید فعال</b> در هر بخش روی سایت نمایش داده می‌شود.</li>
        <li>اگر لینک بگذارید (مثلاً <span dir="ltr">/categories/labaniat</span>) با لمس بنر همان صفحه باز می‌شود.</li>
      </ul>
    </div>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="grid md:grid-cols-2 gap-4">
      <div v-for="slider in sliders" :key="slider.id" class="card overflow-hidden">
        <img
          :src="resolveMediaUrl(slider.image)"
          :alt="slider.title || ''"
          class="w-full aspect-[16/7] object-cover bg-gray-100"
        />
        <div class="p-4 flex items-center justify-between gap-2">
          <div>
            <p class="font-medium">{{ slider.title || 'بدون عنوان' }}</p>
            <p class="text-xs text-gray-500 mt-1">
              {{ slider.placement === 'HOME_TOP' ? 'بالای صفحه' : 'میان دسته‌ها' }}
              <span v-if="!slider.isActive" class="text-red-500"> • غیرفعال</span>
            </p>
          </div>
          <div class="flex gap-2">
            <button class="btn-secondary text-sm" @click="openForm(slider)">ویرایش</button>
            <button class="text-red-500 text-sm" @click="remove(slider.id)">حذف</button>
          </div>
        </div>
      </div>
    </div>

    <EmptyState v-if="!loading && !sliders.length" message="هنوز اسلایدری ساخته نشده" />

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <form class="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" @submit.prevent="save">
        <h2 class="font-bold text-lg">{{ editingId ? 'ویرایش اسلایدر' : 'اسلایدر جدید' }}</h2>
        <input v-model="form.title" required class="input-field" placeholder="عنوان (مثلاً تخفیف لبنیات)" />
        <select v-model="form.placement" class="input-field">
          <option value="HOME_TOP">بالای صفحه اصلی</option>
          <option value="HOME_MID">میان دسته‌های صفحه اصلی</option>
        </select>
        <p class="text-xs text-primary-700 bg-primary-50 rounded-lg px-3 py-2">{{ sizeHint }}</p>
        <input v-model="form.linkUrl" class="input-field" placeholder="لینک اختیاری مثل /categories/labaniat" dir="ltr" />
        <input v-model.number="form.sortOrder" type="number" class="input-field" placeholder="ترتیب نمایش" />
        <AppSwitch v-model="form.isActive" label="نمایش در سایت" />
        <div>
          <label class="block text-sm font-medium mb-1">تصویر بنر</label>
          <input type="file" accept="image/*" class="text-sm" @change="uploadImage" />
          <p class="text-xs text-gray-400 mt-1">{{ uploading ? 'در حال آپلود...' : 'عکس افقی با نسبت حدود ۲ به ۱' }}</p>
          <img
            v-if="form.image"
            :src="resolveMediaUrl(form.image)"
            class="mt-2 w-full aspect-[16/7] rounded-lg object-cover bg-gray-100"
          />
        </div>
        <div class="flex gap-2">
          <button type="submit" class="btn-primary flex-1" :disabled="!form.image || uploading">ذخیره</button>
          <button type="button" class="btn-secondary flex-1" @click="showForm = false">انصراف</button>
        </div>
      </form>
    </div>
  </div>
</template>
