<script setup lang="ts">
import type { Product, Category, Tag, Pagination } from '~/types';
import { getTodayGregorianIso, dayjs } from '~/utils/jalali';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const toast = useToast();
const { formatPrice, resolveMediaUrl, formatNumber, formatShortDate } = useFormat();

const PAGE_SIZE = 20;

const products = ref<Product[]>([]);
const pagination = ref<Pagination | null>(null);
const page = ref(1);
const categories = ref<Category[]>([]);
const tags = ref<Tag[]>([]);
const loading = ref(true);
const showForm = ref(false);
const editingId = ref<string | null>(null);
const search = ref('');
const barcodeFilter = ref('');
const categoryFilter = ref('');
const tagFilter = ref('');
const expiryFilter = ref<'ALL' | 'WEEK' | 'EXPIRED' | 'RANGE'>('ALL');
const expiryFrom = ref<string | null>(null);
const expiryTo = ref<string | null>(null);

const form = reactive({
  name: '',
  description: '',
  barcode: '',
  productionDate: '' as string | null,
  expiryDate: '' as string | null,
  price: 0,
  discountPrice: null as number | null,
  stock: 0,
  unit: '',
  categoryId: '',
  tagId: '' as string | null,
  image: null as string | null,
  images: [] as string[],
  isFeatured: false,
  isNew: false,
  isOldPrice: false,
  isActive: true,
});

const tagOptions = computed(() =>
  tags.value
    .filter((tag) => !form.categoryId || tag.categoryId === form.categoryId)
    .map((tag) => ({
      value: tag.id,
      label: tag.name,
      icon: 'lucide:tag',
    }))
);

const categoryOptions = computed(() =>
  categories.value.map((cat) => ({
    value: cat.id,
    label: cat.name,
    icon: 'lucide:folder',
  }))
);

const tagFilterOptions = computed(() =>
  tags.value
    .filter((tag) => !categoryFilter.value || tag.categoryId === categoryFilter.value)
    .map((tag) => ({
      value: tag.id,
      label: tag.name,
      icon: 'lucide:tag',
    }))
);

onMounted(loadData);

function toDateInput(value?: string | null) {
  return value ? String(value).slice(0, 10) : '';
}

function expiryTone(date?: string | null) {
  if (!date) return '';
  const expiry = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (expiry < today) return 'text-red-600';
  const week = new Date(today);
  week.setDate(week.getDate() + 7);
  if (expiry <= week) return 'text-amber-600';
  return 'text-gray-500';
}

function onExpiryFilterChange() {
  if (expiryFilter.value !== 'RANGE') {
    expiryFrom.value = null;
    expiryTo.value = null;
  }
  resetToFirstPageAndLoad();
}

function clearExpiryRange() {
  expiryFrom.value = null;
  expiryTo.value = null;
  if (expiryFilter.value === 'RANGE') expiryFilter.value = 'ALL';
  resetToFirstPageAndLoad();
}

function resetToFirstPageAndLoad() {
  page.value = 1;
  void loadData();
}

async function loadData() {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      page: String(page.value),
    });
    if (search.value.trim()) params.set('search', search.value.trim());
    if (barcodeFilter.value.trim()) params.set('barcode', barcodeFilter.value.trim());
    if (categoryFilter.value) params.set('categoryId', categoryFilter.value);
    if (tagFilter.value) params.set('tagId', tagFilter.value);

    const today = getTodayGregorianIso();
    if (expiryFilter.value === 'EXPIRED') {
      params.set('expiringBefore', dayjs(today).subtract(1, 'day').format('YYYY-MM-DD'));
    } else if (expiryFilter.value === 'WEEK') {
      params.set('expiringAfter', today);
      params.set('expiringBefore', dayjs(today).add(7, 'day').format('YYYY-MM-DD'));
    } else if (expiryFilter.value === 'RANGE') {
      if (expiryFrom.value) params.set('expiringAfter', expiryFrom.value.slice(0, 10));
      if (expiryTo.value) params.set('expiringBefore', expiryTo.value.slice(0, 10));
    }

    const [prodRes, catRes, tagsRes] = await Promise.all([
      api.get<{ products: Product[]; pagination: Pagination }>(`/admin/products?${params}`),
      categories.value.length
        ? Promise.resolve({ data: categories.value })
        : api.get<Category[]>('/admin/categories'),
      tags.value.length
        ? Promise.resolve({ data: tags.value })
        : api.get<Tag[]>('/admin/tags').catch(() => ({ data: [] as Tag[] })),
    ]);
    products.value = prodRes.data.products;
    pagination.value = prodRes.data.pagination;
    categories.value = catRes.data;
    tags.value = tagsRes.data;

    if (
      pagination.value &&
      pagination.value.totalPages > 0 &&
      page.value > pagination.value.totalPages
    ) {
      page.value = pagination.value.totalPages;
      await loadData();
    }
  } finally {
    loading.value = false;
  }
}

function goToPage(next: number) {
  page.value = next;
  void loadData();
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openForm(product?: Product) {
  if (product) {
    editingId.value = product.id;
    Object.assign(form, {
      name: product.name,
      description: product.description || '',
      barcode: product.barcode || '',
      productionDate: toDateInput(product.productionDate),
      expiryDate: toDateInput(product.expiryDate),
      price: product.price,
      discountPrice: product.discountPrice,
      stock: product.stock,
      unit: product.unit || '',
      categoryId: product.categoryId,
      tagId: product.tagId || '',
      image: product.image,
      images: product.images?.length ? [...product.images] : product.image ? [product.image] : [],
      isFeatured: product.isFeatured,
      isNew: product.isNew,
      isOldPrice: product.isOldPrice ?? false,
      isActive: product.isActive,
    });
  } else {
    editingId.value = null;
    Object.assign(form, {
      name: '',
      description: '',
      barcode: '',
      productionDate: '',
      expiryDate: '',
      price: 0,
      discountPrice: null,
      stock: 0,
      unit: '',
      categoryId: categories.value[0]?.id || '',
      tagId: '',
      image: null,
      images: [],
      isFeatured: false,
      isNew: false,
      isOldPrice: false,
      isActive: true,
    });
  }
  showForm.value = true;
}

async function save() {
  const payload = {
    ...form,
    barcode: form.barcode.trim() || null,
    productionDate: form.productionDate || null,
    expiryDate: form.expiryDate || null,
    tagId: form.tagId || null,
    image: form.images[0] ?? form.image,
    images: form.images,
  };

  try {
    if (editingId.value) {
      await api.put(`/admin/products/${editingId.value}`, payload);
      toast.success('محصول به‌روزرسانی شد');
    } else {
      await api.post('/admin/products', payload);
      toast.success('محصول ایجاد شد');
    }
    showForm.value = false;
    await loadData();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در ذخیره محصول');
  }
}

async function deactivate(product: Product) {
  if (!product.isActive) {
    toast.info('این محصول از قبل غیرفعال است');
    return;
  }
  if (
    !confirm(
      `محصول «${product.name}» از فروشگاه پنهان می‌شود (غیرفعال).\n\nرکورد در پنل باقی می‌ماند و می‌توانید بعداً دوباره فعالش کنید.`
    )
  ) {
    return;
  }

  try {
    await api.put(`/admin/products/${product.id}`, { isActive: false });
    toast.success('محصول غیرفعال شد');
    await loadData();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در غیرفعال‌سازی محصول');
  }
}

async function activate(product: Product) {
  if (product.isActive) {
    toast.info('این محصول از قبل فعال است');
    return;
  }
  if (!confirm(`محصول «${product.name}» دوباره در فروشگاه نمایش داده شود؟`)) {
    return;
  }

  try {
    await api.put(`/admin/products/${product.id}`, { isActive: true });
    toast.success('محصول فعال شد');
    await loadData();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در فعال‌سازی محصول');
  }
}

useHead({ title: 'محصولات - پنل مدیریت' });
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-gray-800 mb-6">مدیریت محصولات</h1>
    <div class="flex flex-col md:flex-row gap-3 mb-4 flex-wrap">
      <input
        v-model="search"
        type="search"
        class="input-field md:max-w-sm"
        placeholder="جستجو نام محصول..."
        @keyup.enter="resetToFirstPageAndLoad"
      />
      <input
        v-model="barcodeFilter"
        type="search"
        class="input-field md:max-w-[180px]"
        placeholder="بارکد"
        dir="ltr"
        @keyup.enter="resetToFirstPageAndLoad"
      />
      <AppSelect
        v-model="categoryFilter"
        :options="[{ value: '', label: 'همه دسته‌ها', icon: 'lucide:layers' }, ...categoryOptions]"
        class="md:max-w-xs"
        @update:model-value="resetToFirstPageAndLoad"
      />
      <AppSelect
        v-model="tagFilter"
        :options="[{ value: '', label: 'همه برچسب‌ها', icon: 'lucide:tags' }, ...tagFilterOptions]"
        class="md:max-w-xs"
        @update:model-value="resetToFirstPageAndLoad"
      />
      <select v-model="expiryFilter" class="input-field md:w-44" @change="onExpiryFilterChange">
        <option value="ALL">همه تاریخ انقضا</option>
        <option value="WEEK">انقضا تا ۷ روز</option>
        <option value="EXPIRED">منقضی‌شده</option>
        <option value="RANGE">بازه تاریخ انقضا</option>
      </select>
      <button class="btn-secondary text-sm" @click="resetToFirstPageAndLoad">اعمال فیلتر</button>
    </div>

    <div
      v-if="expiryFilter === 'RANGE'"
      class="flex flex-col sm:flex-row sm:flex-wrap gap-3 mb-4 p-4 rounded-xl border border-gray-100 bg-gray-50/80"
    >
      <div class="sm:max-w-[200px] flex-1">
        <label class="block text-xs font-medium text-gray-600 mb-1">انقضا از تاریخ</label>
        <AppDatePicker
          v-model="expiryFrom"
          placeholder="از تاریخ"
          :max="expiryTo"
          @update:model-value="resetToFirstPageAndLoad"
        />
      </div>
      <div class="sm:max-w-[200px] flex-1">
        <label class="block text-xs font-medium text-gray-600 mb-1">انقضا تا تاریخ</label>
        <AppDatePicker
          v-model="expiryTo"
          placeholder="تا تاریخ"
          :min="expiryFrom"
          @update:model-value="resetToFirstPageAndLoad"
        />
      </div>
      <div class="flex items-end gap-2">
        <button
          v-if="expiryFrom || expiryTo"
          type="button"
          class="btn-secondary text-sm"
          @click="clearExpiryRange"
        >
          پاک کردن بازه
        </button>
      </div>
      <p class="w-full text-xs text-gray-500 leading-relaxed">
        محصولاتی که تاریخ انقضایشان در این بازه است نمایش داده می‌شوند. می‌توانید فقط «از» یا فقط «تا» هم بگذارید.
      </p>
    </div>

    <div class="flex justify-between items-center mb-6">
      <p class="text-sm text-gray-500">
        {{ formatNumber(pagination?.total ?? products.length) }} محصول
      </p>
      <button class="btn-primary text-sm py-2" @click="openForm()">+ افزودن محصول</button>
    </div>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="card overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th class="w-14">تصویر</th>
            <th>نام</th>
            <th class="hidden md:table-cell">بارکد</th>
            <th class="hidden md:table-cell">دسته</th>
            <th>قیمت</th>
            <th class="hidden lg:table-cell">انقضا</th>
            <th class="hidden md:table-cell">موجودی</th>
            <th>وضعیت</th>
            <th>عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in products" :key="product.id">
            <td>
              <div class="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                <img
                  v-if="product.image"
                  :src="resolveMediaUrl(product.image)"
                  :alt="product.name"
                  class="w-full h-full object-cover"
                />
                <AppIcon v-else name="lucide:image-off" size="sm" class="text-gray-300" />
              </div>
            </td>
            <td class="font-medium">{{ product.name }}</td>
            <td class="hidden md:table-cell text-gray-500 font-mono text-xs" dir="ltr">{{ product.barcode || '—' }}</td>
            <td class="hidden md:table-cell text-gray-500">{{ product.category?.name }}</td>
            <td>{{ formatPrice(product.effectivePrice) }}</td>
            <td class="hidden lg:table-cell text-xs" :class="expiryTone(product.expiryDate)">
              {{ product.expiryDate ? formatShortDate(product.expiryDate) : '—' }}
            </td>
            <td class="hidden md:table-cell">{{ product.stock }}</td>
            <td>
              <span :class="product.isActive ? 'text-green-600' : 'text-red-500'">
                {{ product.isActive ? 'فعال' : 'غیرفعال' }}
              </span>
            </td>
            <td>
              <button class="text-primary-600 ms-2" @click="openForm(product)">ویرایش</button>
              <button
                v-if="product.isActive"
                class="text-amber-600"
                @click="deactivate(product)"
              >
                غیرفعال‌سازی
              </button>
              <button
                v-else
                class="text-green-600"
                @click="activate(product)"
              >
                فعال‌سازی
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AppPagination :pagination="pagination" compact @update:page="goToPage" />

    <!-- Product form modal -->
    <div v-if="showForm" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" @click.self="showForm = false">
      <div class="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <h2 class="text-lg font-bold mb-4">{{ editingId ? 'ویرایش محصول' : 'افزودن محصول' }}</h2>
        <form class="space-y-4" @submit.prevent="save">
          <AppImagesUpload
            v-model="form.images"
            upload-endpoint="/admin/products/upload"
            label="تصاویر محصول"
            hint="JPEG, PNG, WebP یا GIF — حداکثر ۵ مگابایت"
          />

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">نام محصول</label>
            <input v-model="form.name" required placeholder="مثلاً شیر کم‌چرب ۱ لیتر" class="input-field" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">بارکد</label>
            <input v-model="form.barcode" placeholder="مثلاً ۶۲۶۱۲۳۴۵۶۷۸۹۰" class="input-field" dir="ltr" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">توضیحات</label>
            <textarea
              v-model="form.description"
              placeholder="توضیحات کوتاه محصول"
              rows="3"
              class="input-field resize-none"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">قیمت (تومان)</label>
              <input v-model.number="form.price" type="number" min="0" required class="input-field" dir="ltr" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">قیمت با تخفیف</label>
              <input
                v-model.number="form.discountPrice"
                type="number"
                min="0"
                placeholder="اختیاری"
                class="input-field"
                dir="ltr"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">موجودی انبار</label>
              <input v-model.number="form.stock" type="number" min="0" required class="input-field" dir="ltr" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">واحد فروش</label>
              <input v-model="form.unit" placeholder="مثلاً ۱ لیتر / بسته" class="input-field" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">تاریخ تولید</label>
              <AppDatePicker v-model="form.productionDate" placeholder="انتخاب تاریخ تولید" :max="form.expiryDate || null" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">تاریخ انقضا</label>
              <AppDatePicker v-model="form.expiryDate" placeholder="انتخاب تاریخ انقضا" :min="form.productionDate || null" />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">دسته‌بندی</label>
            <AppSelect
              v-model="form.categoryId"
              :options="categoryOptions"
              placeholder="دسته‌بندی را انتخاب کنید"
              searchable
              required
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">برچسب</label>
            <AppSelect
              v-model="form.tagId"
              :options="tagOptions"
              placeholder="برچسب (اختیاری)"
              searchable
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">وضعیت نمایش</label>
            <div class="flex flex-wrap gap-2">
              <AppToggleChip v-model="form.isFeatured" label="ویژه" icon="lucide:sparkles" />
              <AppToggleChip v-model="form.isNew" label="جدید" icon="lucide:badge-plus" />
              <AppToggleChip v-model="form.isOldPrice" label="قیمت قدیم" icon="lucide:badge-alert" />
              <AppToggleChip v-model="form.isActive" label="فعال" icon="lucide:eye" />
            </div>
          </div>

          <button type="submit" class="btn-primary w-full">ذخیره</button>
        </form>
      </div>
    </div>
  </div>
</template>
