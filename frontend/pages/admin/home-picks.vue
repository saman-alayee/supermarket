<script setup lang="ts">
import type { Product, Pagination } from '~/types';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const HOME_PICK_LIMIT = 10;

const api = useApi();
const toast = useToast();
const { formatPrice, getProductImage } = useFormat();

type HomeTab = 'discounted' | 'featured';

const tab = ref<HomeTab>('discounted');
const loading = ref(true);
const saving = ref(false);
const searching = ref(false);
const search = ref('');
const searchResults = ref<Product[]>([]);
const discounted = ref<Product[]>([]);
const featured = ref<Product[]>([]);

const selected = computed({
  get: () => (tab.value === 'discounted' ? discounted.value : featured.value),
  set: (value: Product[]) => {
    if (tab.value === 'discounted') discounted.value = value;
    else featured.value = value;
  },
});

const selectedIds = computed(() => new Set(selected.value.map((item) => item.id)));
const remaining = computed(() => Math.max(0, HOME_PICK_LIMIT - selected.value.length));

const tabHint = computed(() =>
  tab.value === 'discounted'
    ? 'همین فهرست در زبانه «تخفیف‌دار» صفحه اول فروشگاه می‌آید — نه آخرین کالاهای بارگذاری‌شده.'
    : 'همین فهرست در زبانه «ویژه» صفحه اول فروشگاه می‌آید، با ترتیبی که این‌جا می‌چینید.'
);

let searchTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(loadPicks);

watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    void runSearch();
  }, 280);
});

watch(tab, () => {
  searchResults.value = [];
  if (search.value.trim()) void runSearch();
});

async function loadPicks() {
  loading.value = true;
  try {
    const { data } = await api.get<{ discounted: Product[]; featured: Product[] }>(
      '/admin/products/home-picks'
    );
    discounted.value = data.discounted ?? [];
    featured.value = data.featured ?? [];
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در بارگذاری محصولات صفحه اول');
  } finally {
    loading.value = false;
  }
}

async function runSearch() {
  const term = search.value.trim();
  if (term.length < 1) {
    searchResults.value = [];
    return;
  }
  searching.value = true;
  try {
    const params = new URLSearchParams({
      search: term,
      limit: '20',
      page: '1',
    });
    const { data } = await api.get<{ products: Product[]; pagination: Pagination }>(
      `/admin/products?${params}`
    );
    searchResults.value = data.products.filter((product) => !selectedIds.value.has(product.id));
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در جستجو');
  } finally {
    searching.value = false;
  }
}

function addProduct(product: Product) {
  if (selectedIds.value.has(product.id)) return;
  if (selected.value.length >= HOME_PICK_LIMIT) {
    toast.error(`حداکثر ${HOME_PICK_LIMIT} محصول می‌توانید انتخاب کنید`);
    return;
  }
  selected.value = [...selected.value, product];
  searchResults.value = searchResults.value.filter((item) => item.id !== product.id);
}

function removeProduct(id: string) {
  selected.value = selected.value.filter((item) => item.id !== id);
}

function moveProduct(index: number, direction: -1 | 1) {
  const next = index + direction;
  if (next < 0 || next >= selected.value.length) return;
  const copy = [...selected.value];
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item);
  selected.value = copy;
}

async function save() {
  saving.value = true;
  try {
    const { data } = await api.put<{ discounted: Product[]; featured: Product[] }>(
      '/admin/products/home-picks',
      {
        discountedIds: discounted.value.map((item) => item.id),
        featuredIds: featured.value.map((item) => item.id),
      }
    );
    discounted.value = data.discounted ?? [];
    featured.value = data.featured ?? [];
    toast.success('محصولات صفحه اول ذخیره شد');
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در ذخیره');
  } finally {
    saving.value = false;
  }
}

useHead({ title: 'محصولات صفحه اول - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold text-gray-800">محصولات ویژه صفحه اول</h1>
        <p class="text-sm text-gray-500 mt-1 max-w-2xl">
          خودتان مشخص کنید کدام کالاها در صفحه اول بیایند. حداکثر ۱۰ مورد در هر فهرست، با ترتیب دلخواه.
        </p>
      </div>
      <button class="btn-primary text-sm py-2 shrink-0" :disabled="saving" @click="save">
        {{ saving ? 'در حال ذخیره...' : 'ذخیره انتخاب‌ها' }}
      </button>
    </div>

    <div class="flex gap-2 mb-4 p-1 rounded-xl border border-gray-200 bg-white w-fit">
      <button
        type="button"
        :class="[
          'px-4 py-2 text-sm font-semibold rounded-lg transition-colors',
          tab === 'discounted' ? 'bg-red-500 text-white' : 'text-gray-600 hover:bg-red-50',
        ]"
        @click="tab = 'discounted'"
      >
        تخفیف‌دار
        <span class="opacity-80">({{ discounted.length }})</span>
      </button>
      <button
        type="button"
        :class="[
          'px-4 py-2 text-sm font-semibold rounded-lg transition-colors',
          tab === 'featured' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-primary-50',
        ]"
        @click="tab = 'featured'"
      >
        ویژه
        <span class="opacity-80">({{ featured.length }})</span>
      </button>
    </div>

    <p class="text-sm text-gray-500 mb-4">{{ tabHint }}</p>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="grid gap-6 lg:grid-cols-2">
      <section class="card p-4">
        <h2 class="font-bold text-gray-800 mb-1">جستجو و افزودن</h2>
        <p class="text-xs text-gray-500 mb-3">
          {{ remaining ? `${remaining} جای خالی مانده` : 'ظرفیت این فهرست پر است' }}
        </p>
        <input
          v-model="search"
          type="search"
          class="input-field mb-3"
          placeholder="نام، بارکد یا دسته را بنویسید..."
        />
        <LoadingSpinner :show="searching" />
        <ul v-if="!searching && searchResults.length" class="divide-y divide-gray-100">
          <li
            v-for="product in searchResults"
            :key="product.id"
            class="flex items-center gap-3 py-2.5"
          >
            <img
              :src="getProductImage(product.image)"
              :alt="product.name"
              class="w-11 h-11 rounded-lg object-cover bg-gray-100 shrink-0"
            />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-800 truncate">{{ product.name }}</p>
              <p class="text-xs text-gray-500">
                {{ formatPrice(product.effectivePrice) }}
                <span v-if="product.discountPercent" class="text-red-500 ms-1">
                  {{ product.discountPercent }}٪
                </span>
              </p>
            </div>
            <button
              type="button"
              class="text-sm font-medium text-primary-600 shrink-0 disabled:text-gray-300"
              :disabled="remaining === 0"
              @click="addProduct(product)"
            >
              افزودن
            </button>
          </li>
        </ul>
        <p v-else-if="!searching && search.trim()" class="text-sm text-gray-400 py-4">
          محصولی پیدا نشد.
        </p>
      </section>

      <section class="card p-4">
        <h2 class="font-bold text-gray-800 mb-3">
          انتخاب‌شده‌ها
          <span class="text-sm font-normal text-gray-400">({{ selected.length }} از ۱۰)</span>
        </h2>
        <ul v-if="selected.length" class="space-y-2">
          <li
            v-for="(product, index) in selected"
            :key="product.id"
            class="flex items-center gap-2 rounded-xl border border-gray-100 p-2"
          >
            <span class="w-6 text-center text-xs font-bold text-gray-400">{{ index + 1 }}</span>
            <img
              :src="getProductImage(product.image)"
              :alt="product.name"
              class="w-11 h-11 rounded-lg object-cover bg-gray-100 shrink-0"
            />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-800 truncate">{{ product.name }}</p>
              <p class="text-xs text-gray-500">{{ formatPrice(product.effectivePrice) }}</p>
            </div>
            <div class="flex flex-col shrink-0">
              <button
                type="button"
                class="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                :disabled="index === 0"
                aria-label="بالاتر"
                @click="moveProduct(index, -1)"
              >
                <AppIcon name="lucide:chevron-up" size="sm" />
              </button>
              <button
                type="button"
                class="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                :disabled="index === selected.length - 1"
                aria-label="پایین‌تر"
                @click="moveProduct(index, 1)"
              >
                <AppIcon name="lucide:chevron-down" size="sm" />
              </button>
            </div>
            <button
              type="button"
              class="text-red-500 text-sm shrink-0 px-1"
              @click="removeProduct(product.id)"
            >
              حذف
            </button>
          </li>
        </ul>
        <p v-else class="text-sm text-gray-400 py-6 text-center">
          هنوز محصولی انتخاب نشده. از جستجو اضافه کنید.
        </p>
      </section>
    </div>
  </div>
</template>
