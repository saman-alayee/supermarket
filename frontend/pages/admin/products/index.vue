<script setup lang="ts">
import type { Product, Category, Tag } from '~/types';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const { formatPrice, resolveMediaUrl } = useFormat();

const products = ref<Product[]>([]);
const categories = ref<Category[]>([]);
const tags = ref<Tag[]>([]);
const loading = ref(true);
const showForm = ref(false);
const editingId = ref<string | null>(null);
const search = ref('');
const categoryFilter = ref('');

const form = reactive({
  name: '',
  description: '',
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

onMounted(loadData);

async function loadData() {
  loading.value = true;
  try {
    const params = new URLSearchParams({ limit: '100' });
    if (search.value.trim()) params.set('search', search.value.trim());
    if (categoryFilter.value) params.set('categoryId', categoryFilter.value);

    const [prodRes, catRes, tagsRes] = await Promise.all([
      api.get<{ products: Product[] }>(`/admin/products?${params}`),
      api.get<Category[]>('/admin/categories'),
      api.get<Tag[]>('/admin/tags').catch(() => ({ data: [] as Tag[] })),
    ]);
    products.value = prodRes.data.products;
    categories.value = catRes.data;
    tags.value = tagsRes.data;
  } finally {
    loading.value = false;
  }
}

function openForm(product?: Product) {
  if (product) {
    editingId.value = product.id;
    Object.assign(form, {
      name: product.name,
      description: product.description || '',
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
      isActive: product.isActive,
    });
  } else {
    editingId.value = null;
    Object.assign(form, { name: '', description: '', price: 0, discountPrice: null, stock: 0, unit: '', categoryId: categories.value[0]?.id || '', tagId: '', image: null, images: [], isFeatured: false, isNew: false, isActive: true });
  }
  showForm.value = true;
}

async function save() {
  const payload = {
    ...form,
    tagId: form.tagId || null,
    image: form.images[0] ?? form.image,
    images: form.images,
  };

  if (editingId.value) {
    await api.put(`/admin/products/${editingId.value}`, payload);
  } else {
    await api.post('/admin/products', payload);
  }
  showForm.value = false;
  await loadData();
}

async function remove(id: string) {
  if (confirm('آیا از حذف این محصول مطمئن هستید؟')) {
    await api.delete(`/admin/products/${id}`);
    await loadData();
  }
}

useHead({ title: 'محصولات - پنل مدیریت' });
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-gray-800 mb-6">مدیریت محصولات</h1>
    <div class="flex flex-col md:flex-row gap-3 mb-4">
      <input
        v-model="search"
        type="search"
        class="input-field md:max-w-sm"
        placeholder="جستجو نام محصول..."
        @keyup.enter="loadData"
      />
      <AppSelect
        v-model="categoryFilter"
        :options="[{ value: '', label: 'همه دسته‌ها', icon: 'lucide:layers' }, ...categoryOptions]"
        class="md:max-w-xs"
        @update:model-value="loadData"
      />
      <button class="btn-secondary text-sm" @click="loadData">اعمال فیلتر</button>
    </div>

    <div class="flex justify-between items-center mb-6">
      <p class="text-sm text-gray-500">{{ products.length }} محصول</p>
      <button class="btn-primary text-sm py-2" @click="openForm()">+ افزودن محصول</button>
    </div>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="card overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th class="w-14">تصویر</th>
            <th>نام</th>
            <th class="hidden md:table-cell">دسته</th>
            <th>قیمت</th>
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
            <td class="hidden md:table-cell text-gray-500">{{ product.category?.name }}</td>
            <td>{{ formatPrice(product.effectivePrice) }}</td>
            <td class="hidden md:table-cell">{{ product.stock }}</td>
            <td>
              <span :class="product.isActive ? 'text-green-600' : 'text-red-500'">
                {{ product.isActive ? 'فعال' : 'غیرفعال' }}
              </span>
            </td>
            <td>
              <button class="text-primary-600 ms-2" @click="openForm(product)">ویرایش</button>
              <button class="text-red-500" @click="remove(product.id)">حذف</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

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
              <AppToggleChip v-model="form.isActive" label="فعال" icon="lucide:eye" />
            </div>
          </div>

          <button type="submit" class="btn-primary w-full">ذخیره</button>
        </form>
      </div>
    </div>
  </div>
</template>
