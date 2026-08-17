<script setup lang="ts">
import type { Address, PaymentMethod } from '~/types';
import { PAYMENT_METHOD_LABELS } from '~/types';

const cartStore = useCartStore();
const authStore = useAuthStore();
const api = useApi();
const toast = useToast();
const { formatPrice } = useFormat();
const manualAddress = useAddressFields();
const { street, plaque, unit, errors: addressErrors, validate: validateAddress, payload: manualPayload, reset: resetManualAddress } = manualAddress;

const checkoutMode = ref<'quick' | 'account'>('quick');

const form = reactive({
  customerName: '',
  customerPhone: '',
  notes: '',
  couponCode: '',
  paymentMethod: 'CASH_AT_DOOR' as PaymentMethod,
  nationalId: '',
  salaryCard: '',
  taraId: '',
  walletNote: '',
});

const mapLat = ref<number | null>(null);
const mapLng = ref<number | null>(null);

const loading = ref(false);
const error = ref('');
const couponLoading = ref(false);
const addressesLoading = ref(false);
const addresses = ref<Address[]>([]);
const selectedAddressId = ref<string | null>(null);

const appliedCoupon = ref<{
  code: string;
  discountAmount: number;
  totalPrice: number;
} | null>(null);

const paymentOptions: { value: PaymentMethod; label: string; hint?: string }[] = [
  { value: 'CASH_AT_DOOR', label: PAYMENT_METHOD_LABELS.CASH_AT_DOOR },
  { value: 'RETIREMENT_FUND', label: PAYMENT_METHOD_LABELS.RETIREMENT_FUND, hint: 'کد ملی + شماره کارت حقوقی' },
  { value: 'SOCIAL_SECURITY', label: PAYMENT_METHOD_LABELS.SOCIAL_SECURITY, hint: 'کد به موبایل بازنشسته' },
  { value: 'TARA', label: PAYMENT_METHOD_LABELS.TARA, hint: 'شناسه خرید تارا' },
  { value: 'OTHER_WALLET', label: PAYMENT_METHOD_LABELS.OTHER_WALLET, hint: 'نوع کیف پول در توضیحات' },
];

const displayTotal = computed(() => appliedCoupon.value?.totalPrice ?? cartStore.totalPrice);
const displayDiscount = computed(() => appliedCoupon.value?.discountAmount ?? 0);
const selectedAddress = computed(() => addresses.value.find((a) => a.id === selectedAddressId.value) || null);
const isInstallment = computed(() => form.paymentMethod !== 'CASH_AT_DOOR');

onMounted(async () => {
  await cartStore.fetchCart();
  if (cartStore.isEmpty) navigateTo('/cart');

  authStore.init();
  if (authStore.isLoggedIn) {
    await authStore.fetchProfile().catch(() => undefined);
    if (authStore.user) {
      form.customerName = authStore.fullName;
      form.customerPhone = authStore.user.phone;
    }
    await loadAddresses();
  }
});

async function loadAddresses() {
  addressesLoading.value = true;
  try {
    const { data } = await api.get<Address[]>('/addresses');
    addresses.value = data;
    const def = data.find((a) => a.isDefault) || data[0];
    if (def) selectedAddressId.value = def.id;
  } catch {
    addresses.value = [];
  } finally {
    addressesLoading.value = false;
  }
}

function switchToAccount() {
  checkoutMode.value = 'account';
  if (!authStore.isLoggedIn) {
    navigateTo(`/auth/login?redirect=${encodeURIComponent('/checkout')}`);
  }
}

async function applyCoupon() {
  if (!form.couponCode.trim() || !form.customerPhone.trim()) {
    error.value = 'برای اعمال کد تخفیف، شماره موبایل را وارد کنید';
    return;
  }
  couponLoading.value = true;
  error.value = '';
  try {
    const { data } = await api.post<{ code: string; discountAmount: number; totalPrice: number }>(
      '/coupons/validate',
      { code: form.couponCode, subtotal: cartStore.totalPrice, customerPhone: form.customerPhone }
    );
    appliedCoupon.value = data;
  } catch (e: unknown) {
    appliedCoupon.value = null;
    error.value = e instanceof Error ? e.message : 'کد تخفیف نامعتبر است';
  } finally {
    couponLoading.value = false;
  }
}

function buildPaymentDetails(): Record<string, string> | undefined {
  if (form.paymentMethod === 'CASH_AT_DOOR') return undefined;
  const details: Record<string, string> = { phone: form.customerPhone.trim() };
  if (form.paymentMethod === 'RETIREMENT_FUND') {
    details.nationalId = form.nationalId.trim();
    details.salaryCard = form.salaryCard.trim();
  }
  if (form.paymentMethod === 'TARA') {
    details.taraId = form.taraId.trim();
  }
  if (form.paymentMethod === 'OTHER_WALLET' && form.walletNote.trim()) {
    details.walletNote = form.walletNote.trim();
  }
  return details;
}

async function submitOrder() {
  error.value = '';

  if (form.customerName.trim().length < 3) {
    error.value = 'نام و نام خانوادگی را کامل وارد کنید';
    toast.error(error.value);
    return;
  }
  if (!/^09\d{9}$/.test(form.customerPhone.trim())) {
    error.value = 'شماره موبایل معتبر نیست';
    toast.error(error.value);
    return;
  }

  let deliveryPayload: Record<string, unknown> = {};

  if (checkoutMode.value === 'account' && authStore.isLoggedIn && selectedAddress.value) {
    deliveryPayload = {
      addressId: selectedAddress.value.id,
      deliveryAddress: selectedAddress.value.address,
      deliveryLatitude: selectedAddress.value.latitude ?? undefined,
      deliveryLongitude: selectedAddress.value.longitude ?? undefined,
    };
  } else {
    if (!validateAddress({ requireMap: true, hasMap: mapLat.value != null && mapLng.value != null })) {
      error.value = 'آدرس، پلاک، واحد و موقعیت روی نقشه را کامل کنید';
      toast.error(error.value);
      return;
    }
    deliveryPayload = {
      ...manualPayload(),
      deliveryLatitude: mapLat.value,
      deliveryLongitude: mapLng.value,
    };
  }

  if (form.paymentMethod === 'RETIREMENT_FUND' && (!form.nationalId.trim() || !form.salaryCard.trim())) {
    error.value = 'کد ملی و شماره کارت حقوقی الزامی است';
    toast.error(error.value);
    return;
  }
  if (form.paymentMethod === 'TARA' && !form.taraId.trim()) {
    error.value = 'شناسه خرید تارا را وارد کنید';
    toast.error(error.value);
    return;
  }

  loading.value = true;
  try {
    const payload = {
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      notes: [form.notes, form.walletNote].filter(Boolean).join(' | ') || undefined,
      couponCode: appliedCoupon.value?.code || undefined,
      paymentMethod: form.paymentMethod,
      paymentDetails: buildPaymentDetails(),
      ...deliveryPayload,
    };

    const { data } = await api.post<{ orderNumber: string }>('/orders', payload);
    await cartStore.fetchCart();
    navigateTo(`/orders/success?number=${data.orderNumber}`);
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'خطا در ثبت سفارش';
    toast.error(error.value);
  } finally {
    loading.value = false;
  }
}

useHead({ title: 'ثبت سفارش - KIAA KALA' });
</script>

<template>
  <div class="px-4 py-4 max-w-lg mx-auto pb-40">
    <h1 class="section-title">ثبت سفارش</h1>

    <div class="card p-4 mb-4 space-y-2">
      <div class="flex justify-between text-sm">
        <span class="text-gray-600">{{ cartStore.totalItems }} کالا</span>
        <span>{{ formatPrice(cartStore.totalPrice) }}</span>
      </div>
      <div v-if="displayDiscount" class="flex justify-between text-sm text-green-600">
        <span>تخفیف</span><span>- {{ formatPrice(displayDiscount) }}</span>
      </div>
      <div class="flex justify-between pt-2 border-t font-bold">
        <span>مبلغ قابل پرداخت</span>
        <span class="text-lg">{{ formatPrice(displayTotal) }}</span>
      </div>
    </div>

    <div class="flex gap-2 mb-4 p-1 bg-gray-100 rounded-xl">
      <button
        type="button"
        :class="['flex-1 py-2.5 text-sm font-medium rounded-lg', checkoutMode === 'quick' ? 'bg-white shadow text-primary-700' : 'text-gray-500']"
        @click="checkoutMode = 'quick'"
      >
        خرید سریع
      </button>
      <button
        type="button"
        :class="['flex-1 py-2.5 text-sm font-medium rounded-lg', checkoutMode === 'account' ? 'bg-white shadow text-primary-700' : 'text-gray-500']"
        @click="switchToAccount"
      >
        با حساب کاربری
      </button>
    </div>

    <form class="space-y-4" @submit.prevent="submitOrder">
      <div>
        <label class="block text-sm font-medium mb-1">نام و نام خانوادگی *</label>
        <input v-model="form.customerName" type="text" required minlength="3" class="input-field min-h-[48px]" />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">شماره موبایل *</label>
        <input v-model="form.customerPhone" type="tel" required pattern="09[0-9]{9}" class="input-field min-h-[48px]" dir="ltr" />
      </div>

      <div v-if="checkoutMode === 'quick'" class="space-y-3">
        <AddressFields v-model:street="street" v-model:plaque="plaque" v-model:unit="unit" :errors="addressErrors" />
        <div>
          <label class="block text-sm font-medium mb-1">موقعیت روی نقشه (کیاشهر) *</label>
          <AppMapPicker v-model:latitude="mapLat" v-model:longitude="mapLng" :geocode="false" height="220px" :zoom="16" />
          <AppFormError :message="addressErrors.map" />
        </div>
      </div>

      <div v-else class="space-y-3">
        <LoadingSpinner :show="addressesLoading" />
        <template v-if="!addressesLoading && addresses.length">
          <label class="block text-sm font-medium">انتخاب آدرس ذخیره‌شده</label>
          <button
            v-for="addr in addresses"
            :key="addr.id"
            type="button"
            :class="['w-full text-start p-3 rounded-xl border-2', selectedAddressId === addr.id ? 'border-primary-500 bg-primary-50/40' : 'border-gray-100']"
            @click="selectedAddressId = addr.id"
          >
            <p class="text-sm font-medium">{{ addr.title || 'آدرس' }}</p>
            <p class="text-xs text-gray-600 mt-1">{{ addr.address }}</p>
          </button>
        </template>
        <div v-else-if="!addressesLoading" class="space-y-2">
          <AppAlertBanner message="آدرسی ذخیره نشده. از خرید سریع استفاده کنید یا آدرس اضافه کنید." variant="warning" />
          <NuxtLink to="/profile/addresses" class="btn-secondary w-full inline-flex justify-center min-h-[44px] items-center">افزودن آدرس</NuxtLink>
        </div>
      </div>

      <div class="card p-4 space-y-3">
        <h2 class="text-sm font-bold text-gray-800">روش پرداخت</h2>
        <label v-for="opt in paymentOptions" :key="opt.value" class="flex items-start gap-3 cursor-pointer">
          <input v-model="form.paymentMethod" type="radio" :value="opt.value" class="mt-1" />
          <span>
            <span class="text-sm font-medium block">{{ opt.label }}</span>
            <span v-if="opt.hint" class="text-xs text-gray-400">{{ opt.hint }}</span>
          </span>
        </label>

        <div v-if="form.paymentMethod === 'RETIREMENT_FUND'" class="grid grid-cols-2 gap-2 pt-2">
          <input v-model="form.nationalId" class="input-field" placeholder="کد ملی" dir="ltr" />
          <input v-model="form.salaryCard" class="input-field" placeholder="شماره کارت حقوقی" dir="ltr" />
        </div>
        <div v-if="form.paymentMethod === 'TARA'" class="pt-2">
          <input v-model="form.taraId" class="input-field" placeholder="شناسه خرید تارا" dir="ltr" />
        </div>
        <div v-if="form.paymentMethod === 'OTHER_WALLET'" class="pt-2">
          <input v-model="form.walletNote" class="input-field" placeholder="نوع کیف پول" />
        </div>

        <AppAlertBanner
          v-if="isInstallment"
          message="مشتری گرامی؛ در خریدهای اقساطی سفارش در وضعیت «در حال بررسی» قرار می‌گیرد و حداکثر ۱ تا ۶ ساعت کاری کارشناس با شما تماس می‌گیرد."
          variant="info"
        />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">توضیحات (اختیاری)</label>
        <textarea v-model="form.notes" rows="2" class="input-field resize-none" />
      </div>

      <AppAlertBanner v-if="error" :message="error" />
    </form>

    <div class="fixed bottom-16 md:bottom-0 inset-x-0 z-[55] px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 bg-white/95 backdrop-blur border-t">
      <div v-if="error" class="max-w-lg mx-auto mb-2 md:hidden"><AppAlertBanner :message="error" /></div>
      <div class="max-w-lg mx-auto">
        <button type="button" class="btn-primary w-full min-h-[52px]" :disabled="loading" @click="submitOrder">
          {{ loading ? 'در حال ثبت...' : `ثبت سفارش • ${formatPrice(displayTotal)}` }}
        </button>
      </div>
    </div>
  </div>
</template>
