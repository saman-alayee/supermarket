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
    const [prodRes, catRes, tagsRes] = await Promise.all([
      api.get<{ products: Product[] }>('/admin/products?limit=100'),
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
    <div class="flex justify-between items-center mb-6">
      <p class="text-sm text-gray-500">{{ products.length }} محصول</p>
      <button class="btn-primary text-sm py-2" @click="openForm()">+ افزودن محصول</button>
    </div>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-gray-600">
          <tr>
            <th class="text-start p-3 w-14">تصویر</th>
            <th class="text-start p-3">نام</th>
            <th class="text-start p-3 hidden md:table-cell">دسته</th>
            <th class="text-start p-3">قیمت</th>
            <th class="text-start p-3 hidden md:table-cell">موجودی</th>
            <th class="text-start p-3">وضعیت</th>
            <th class="p-3">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in products" :key="product.id" class="border-t border-gray-100">
            <td class="p-3">
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
            <td class="p-3 font-medium">{{ product.name }}</td>
            <td class="p-3 hidden md:table-cell text-gray-500">{{ product.category?.name }}</td>
            <td class="p-3">{{ formatPrice(product.effectivePrice) }}</td>
            <td class="p-3 hidden md:table-cell">{{ product.stock }}</td>
            <td class="p-3">
              <span :class="product.isActive ? 'text-green-600' : 'text-red-500'">
                {{ product.isActive ? 'فعال' : 'غیرفعال' }}
              </span>
            </td>
            <td class="p-3">
              <button class="text-primary-600 ml-2" @click="openForm(product)">ویرایش</button>
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
        <form class="space-y-3" @submit.prevent="save">
          <AppImagesUpload
            v-model="form.images"
            upload-endpoint="/admin/products/upload"
            label="تصاویر محصول"
            hint="JPEG, PNG, WebP یا GIF — حداکثر ۵ مگابایت"
          />
          <input v-model="form.name" required placeholder="نام محصول" class="input-field" />
          <textarea v-model="form.description" placeholder="توضیحات" rows="2" class="input-field resize-none" />
          <div class="grid grid-cols-2 gap-3">
            <input v-model.number="form.price" type="number" required placeholder="قیمت (تومان)" class="input-field" />
            <input v-model.number="form.discountPrice" type="number" placeholder="قیمت تخفیفی" class="input-field" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <input v-model.number="form.stock" type="number" required placeholder="موجودی" class="input-field" />
            <input v-model="form.unit" placeholder="واحد (مثلا ۱ لیتر)" class="input-field" />
          </div>
          <AppSelect
            v-model="form.categoryId"
            :options="categoryOptions"
            placeholder="دسته‌بندی را انتخاب کنید"
            searchable
            required
          />
          <AppSelect
            v-model="form.tagId"
            :options="tagOptions"
            placeholder="برچسب (اختیاری)"
            searchable
          />
          <div class="flex flex-wrap gap-2">
            <AppToggleChip v-model="form.isFeatured" label="ویژه" icon="lucide:sparkles" />
            <AppToggleChip v-model="form.isNew" label="جدید" icon="lucide:badge-plus" />
            <AppToggleChip v-model="form.isActive" label="فعال" icon="lucide:eye" />
          </div>
          <button type="submit" class="btn-primary w-full">ذخیره</button>
        </form>
      </div>
    </div>
  </div>
</template>
