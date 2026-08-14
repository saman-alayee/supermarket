<script setup lang="ts">
import type { Coupon } from '~/types';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const toast = useToast();
const { formatPrice, formatShortDate } = useFormat();

const coupons = ref<Coupon[]>([]);
const loading = ref(true);
const showForm = ref(false);
const editing = ref<Coupon | null>(null);
const formError = ref('');

const typeOptions = [
  { value: 'PERCENT', label: 'درصدی', icon: 'lucide:percent' },
  { value: 'FIXED', label: 'مبلغ ثابت', icon: 'lucide:banknote' },
];

const form = reactive({
  code: '',
  title: '',
  type: 'PERCENT' as 'PERCENT' | 'FIXED',
  value: 10,
  minPurchase: 0,
  maxDiscount: null as number | null,
  usageLimit: null as number | null,
  perUserLimit: null as number | null,
  startDate: null as string | null,
  endDate: null as string | null,
  isActive: true,
});

onMounted(loadCoupons);

async function loadCoupons() {
  loading.value = true;
  try {
    const { data } = await api.get<Coupon[]>('/admin/coupons');
    coupons.value = data;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  formError.value = '';
  Object.assign(form, {
    code: '',
    title: '',
    type: 'PERCENT',
    value: 10,
    minPurchase: 0,
    maxDiscount: 50000,
    usageLimit: 100,
    perUserLimit: 1,
    startDate: null,
    endDate: null,
    isActive: true,
  });
  showForm.value = true;
}

function openEdit(coupon: Coupon) {
  editing.value = coupon;
  formError.value = '';
  Object.assign(form, {
    code: coupon.code,
    title: coupon.title || '',
    type: coupon.type,
    value: coupon.value,
    minPurchase: coupon.minPurchase,
    maxDiscount: coupon.maxDiscount,
    usageLimit: coupon.usageLimit,
    perUserLimit: coupon.perUserLimit,
    startDate: coupon.startDate ? coupon.startDate.slice(0, 10) : '',
    endDate: coupon.endDate ? coupon.endDate.slice(0, 10) : '',
    isActive: coupon.isActive,
  });
  showForm.value = true;
}

async function saveCoupon() {
  formError.value = '';
  try {
    const payload = {
      ...form,
      maxDiscount: form.type === 'PERCENT' ? form.maxDiscount : null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    };
    if (editing.value) {
      await api.put(`/admin/coupons/${editing.value.id}`, payload);
      toast.success('کد تخفیف به‌روزرسانی شد');
    } else {
      await api.post('/admin/coupons', payload);
      toast.success('کد تخفیف ایجاد شد');
    }
    showForm.value = false;
    await loadCoupons();
  } catch (e: unknown) {
    formError.value = e instanceof Error ? e.message : 'خطا در ذخیره';
    toast.error(formError.value);
  }
}

async function deactivateCoupon(id: string) {
  if (!confirm('این کد تخفیف غیرفعال شود؟')) return;
  try {
    await api.delete(`/admin/coupons/${id}`);
    toast.success('کد تخفیف غیرفعال شد');
    await loadCoupons();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا');
  }
}

useHead({ title: 'کدهای تخفیف - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6 gap-3">
      <div>
        <h1 class="text-xl font-bold text-gray-800">کدهای تخفیف</h1>
        <p class="text-sm text-gray-500 mt-1">درصدی یا مبلغ ثابت با حداقل/حداکثر خرید</p>
      </div>
      <button class="btn-primary text-sm" @click="openCreate">+ کد جدید</button>
    </div>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="grid gap-3">
      <div v-for="coupon in coupons" :key="coupon.id" class="card p-4">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-primary-700" dir="ltr">{{ coupon.code }}</span>
              <span :class="coupon.isActive ? 'text-green-600' : 'text-red-500'" class="text-xs">
                {{ coupon.isActive ? 'فعال' : 'غیرفعال' }}
              </span>
            </div>
            <p class="text-sm text-gray-600 mt-1">{{ coupon.title || 'بدون عنوان' }}</p>
            <p class="text-xs text-gray-400 mt-2">
              {{ coupon.type === 'PERCENT' ? `${coupon.value}٪` : formatPrice(coupon.value) }}
              | حداقل: {{ formatPrice(coupon.minPurchase) }}
              <span v-if="coupon.maxDiscount">| سقف: {{ formatPrice(coupon.maxDiscount) }}</span>
              | استفاده: {{ coupon.usedCount }}{{ coupon.usageLimit ? ` / ${coupon.usageLimit}` : '' }}
              <span v-if="coupon.perUserLimit">| هر کاربر: {{ coupon.perUserLimit }} بار</span>
              <span v-if="coupon.startDate">| از {{ formatShortDate(coupon.startDate) }}</span>
              <span v-if="coupon.endDate">| تا {{ formatShortDate(coupon.endDate) }}</span>
            </p>
          </div>
          <div class="flex gap-2">
            <button class="btn-secondary text-sm" @click="openEdit(coupon)">ویرایش</button>
            <button
              v-if="coupon.isActive"
              class="text-sm text-red-500 px-3 py-2 rounded-lg hover:bg-red-50"
              @click="deactivateCoupon(coupon.id)"
            >
              غیرفعال
            </button>
          </div>
        </div>
      </div>
    </div>

    <EmptyState v-if="!loading && !coupons.length" message="کد تخفیفی تعریف نشده" />

    <!-- Modal -->
    <div v-if="showForm" class="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/40">
      <div class="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <h2 class="text-lg font-bold mb-4">{{ editing ? 'ویرایش کد تخفیف' : 'کد تخفیف جدید' }}</h2>
        <form class="space-y-4" @submit.prevent="saveCoupon">
          <AppAlertBanner :message="formError" />

          <div class="grid grid-cols-2 gap-3">
            <div class="col-span-2">
              <label class="label">کد</label>
              <input v-model="form.code" required class="input-field" dir="ltr" placeholder="WELCOME10" />
            </div>
            <div class="col-span-2">
              <label class="label">عنوان</label>
              <input v-model="form.title" class="input-field" placeholder="تخفیف خوش‌آمدگویی" />
            </div>
            <div>
              <label class="label">نوع</label>
              <AppSelect v-model="form.type" :options="typeOptions" />
            </div>
            <div>
              <label class="label">{{ form.type === 'PERCENT' ? 'درصد' : 'مبلغ (تومان)' }}</label>
              <input v-model.number="form.value" type="number" required min="1" class="input-field" />
            </div>
            <div>
              <label class="label">حداقل خرید</label>
              <input v-model.number="form.minPurchase" type="number" min="0" class="input-field" />
            </div>
            <div v-if="form.type === 'PERCENT'">
              <label class="label">حداکثر تخفیف</label>
              <input v-model.number="form.maxDiscount" type="number" min="0" class="input-field" />
            </div>
            <div>
              <label class="label">سقف استفاده کل</label>
              <input v-model.number="form.usageLimit" type="number" min="1" class="input-field" placeholder="نامحدود" />
            </div>
            <div>
              <label class="label">سقف هر کاربر</label>
              <input v-model.number="form.perUserLimit" type="number" min="1" class="input-field" placeholder="نامحدود" />
            </div>
            <div>
              <label class="label">تاریخ شروع</label>
              <AppDatePicker v-model="form.startDate" placeholder="انتخاب تاریخ شروع" :max="form.endDate || null" />
            </div>
            <div>
              <label class="label">تاریخ پایان</label>
              <AppDatePicker v-model="form.endDate" placeholder="انتخاب تاریخ پایان" :min="form.startDate || null" />
            </div>
          </div>
          <AppSwitch v-model="form.isActive" label="کد تخفیف فعال باشد" />
          <div class="flex gap-2 pt-2">
            <button type="submit" class="btn-primary flex-1">ذخیره</button>
            <button type="button" class="btn-secondary flex-1" @click="showForm = false">انصراف</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.label {
  @apply block text-sm font-medium text-gray-700 mb-1;
}
</style>
