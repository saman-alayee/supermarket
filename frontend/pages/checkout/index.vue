<script setup lang="ts">
import type { Address, PaymentMethod } from '~/types';
import { PAYMENT_METHOD_LABELS } from '~/types';
import { useOrdersStore } from '~/stores/orders';

const cartStore = useCartStore();
const ordersStore = useOrdersStore();
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
  deliveryMethod: 'FREE' as 'FREE' | 'JET',
  nationalId: '',
  salaryCard: '',
  taraId: '',
  walletNote: '',
});

const showPaymentDetails = ref(false);
const FREE_SHIPPING_MIN = 200_000;
const JET_FEE = 50_000;

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

const paymentOptions: { value: PaymentMethod; label: string; hint?: string; info?: string }[] = [
  { value: 'CASH_AT_DOOR', label: PAYMENT_METHOD_LABELS.CASH_AT_DOOR, hint: 'مبلغ هنگام تحویل دریافت می‌شود' },
  {
    value: 'RETIREMENT_FUND',
    label: PAYMENT_METHOD_LABELS.RETIREMENT_FUND,
    info: 'کد ملی و شماره کارت حقوقی را وارد کنید تا در سیستم فروشگاه ثبت شود.',
  },
  {
    value: 'SOCIAL_SECURITY',
    label: PAYMENT_METHOD_LABELS.SOCIAL_SECURITY,
    info: 'کد ملی بازنشسته را وارد کنید تا سفارش در سیستم فروشگاه ثبت شود.',
  },
  {
    value: 'TARA',
    label: PAYMENT_METHOD_LABELS.TARA,
    info: 'شناسه خرید تارا را وارد کنید تا سفارش در سیستم فروشگاه ثبت شود.',
  },
  {
    value: 'OTHER_WALLET',
    label: PAYMENT_METHOD_LABELS.OTHER_WALLET,
    info: 'نوع کیف پول یا توضیحات پرداخت را بنویسید.',
  },
];

const installmentMethods: PaymentMethod[] = ['RETIREMENT_FUND', 'SOCIAL_SECURITY', 'TARA', 'OTHER_WALLET'];

function selectPaymentMethod(method: PaymentMethod) {
  form.paymentMethod = method;
  if (method !== 'CASH_AT_DOOR') {
    showPaymentDetails.value = true;
  }
}

function openPaymentInfo(method: PaymentMethod, event?: Event) {
  event?.stopPropagation();
  form.paymentMethod = method;
  showPaymentDetails.value = true;
}

const displaySubtotal = computed(() => appliedCoupon.value?.totalPrice ?? cartStore.totalPrice);
const deliveryFee = computed(() => (form.deliveryMethod === 'JET' ? JET_FEE : 0));
const canUseFreeDelivery = computed(() => displaySubtotal.value >= FREE_SHIPPING_MIN);
const displayTotal = computed(() => displaySubtotal.value + deliveryFee.value);
const displayDiscount = computed(() => appliedCoupon.value?.discountAmount ?? 0);
const selectedAddress = computed(() => addresses.value.find((a) => a.id === selectedAddressId.value) || null);
const isInstallment = computed(() => form.paymentMethod !== 'CASH_AT_DOOR');

watch(canUseFreeDelivery, (allowed) => {
  if (!allowed && form.deliveryMethod === 'FREE') {
    form.deliveryMethod = 'JET';
  }
});

function buildPaymentDetails() {
  if (!isInstallment.value) return undefined;
  const details: Record<string, string> = {};
  if (form.paymentMethod === 'RETIREMENT_FUND') {
    if (form.nationalId.trim()) details.nationalId = form.nationalId.trim();
    if (form.salaryCard.trim()) details.salaryCard = form.salaryCard.trim();
  }
  if (form.paymentMethod === 'SOCIAL_SECURITY') {
    if (form.nationalId.trim()) details.nationalId = form.nationalId.trim();
  }
  if (form.paymentMethod === 'TARA' && form.taraId.trim()) {
    details.taraId = form.taraId.trim();
  }
  if (form.paymentMethod === 'OTHER_WALLET' && form.walletNote.trim()) {
    details.walletNote = form.walletNote.trim();
  }
  return Object.keys(details).length ? details : undefined;
}

function validateInstallmentDetails() {
  if (!isInstallment.value) return true;
  if (form.paymentMethod === 'RETIREMENT_FUND' && (!form.nationalId.trim() || !form.salaryCard.trim())) {
    error.value = 'کد ملی و شماره کارت حقوقی را وارد کنید';
    showPaymentDetails.value = true;
    return false;
  }
  if (form.paymentMethod === 'SOCIAL_SECURITY') {
    if (!form.nationalId.trim()) {
      error.value = 'کد ملی را وارد کنید';
      showPaymentDetails.value = true;
      return false;
    }
    return true;
  }
  if (form.paymentMethod === 'TARA' && !form.taraId.trim()) {
    error.value = 'شناسه خرید تارا را وارد کنید';
    showPaymentDetails.value = true;
    return false;
  }
  if (form.paymentMethod === 'OTHER_WALLET' && !form.walletNote.trim()) {
    error.value = 'نوع کیف پول را بنویسید';
    showPaymentDetails.value = true;
    return false;
  }
  return true;
}

function scrollToFirstError() {
  nextTick(() => {
    document.querySelector('[data-field-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

onMounted(async () => {
  await cartStore.fetchCart();
  if (cartStore.isEmpty) navigateTo('/cart');
  if (cartStore.totalPrice < FREE_SHIPPING_MIN) {
    form.deliveryMethod = 'JET';
  }

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

  if (checkoutMode.value === 'account' && authStore.isLoggedIn) {
    if (!selectedAddress.value) {
      error.value = 'یک آدرس ذخیره‌شده انتخاب کنید';
      toast.error(error.value);
      scrollToFirstError();
      return;
    }
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
      scrollToFirstError();
      return;
    }
    deliveryPayload = {
      ...manualPayload(),
      deliveryLatitude: mapLat.value,
      deliveryLongitude: mapLng.value,
    };
  }

  if (!validateInstallmentDetails()) {
    toast.error(error.value);
    return;
  }

  loading.value = true;
  try {
    const payload = {
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      notes: form.notes.trim() || undefined,
      couponCode: appliedCoupon.value?.code || undefined,
      paymentMethod: form.paymentMethod,
      deliveryMethod: form.deliveryMethod,
      paymentDetails: buildPaymentDetails(),
      ...deliveryPayload,
    };

    const { data } = await api.post<{ orderNumber: string }>('/orders', payload);
    await cartStore.fetchCart();
    await ordersStore.fetchCount();
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
  <div class="px-4 py-4 max-w-lg md:max-w-2xl mx-auto pb-44 md:pb-32">
    <h1 class="section-title">ثبت سفارش</h1>

    <div class="card p-4 mb-4 space-y-2">
      <div class="flex justify-between text-sm">
        <span class="text-gray-600">{{ cartStore.totalItems }} کالا</span>
        <span>{{ formatPrice(cartStore.totalPrice) }}</span>
      </div>
      <div v-if="displayDiscount" class="flex justify-between text-sm text-green-600">
        <span>تخفیف</span><span>- {{ formatPrice(displayDiscount) }}</span>
      </div>
      <div v-if="deliveryFee" class="flex justify-between text-sm text-amber-700">
        <span>هزینه ارسال جت</span><span>{{ formatPrice(deliveryFee) }}</span>
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
        خرید سریع بدون ثبت‌نام
      </button>
      <button
        type="button"
        :class="['flex-1 py-2.5 text-sm font-medium rounded-lg', checkoutMode === 'account' ? 'bg-white shadow text-primary-700' : 'text-gray-500']"
        @click="switchToAccount"
      >
        ورود / ثبت‌نام
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

      <div v-if="checkoutMode === 'quick'" class="space-y-3" data-field-error="true">
        <AddressFields v-model:street="street" v-model:plaque="plaque" v-model:unit="unit" :errors="addressErrors" />
        <div>
          <label class="block text-sm font-medium mb-1">موقعیت روی نقشه (کیاشهر) *</label>
          <AppMapPicker v-model:latitude="mapLat" v-model:longitude="mapLng" :geocode="false" height="220px" :zoom="16" />
          <AppFormError :message="addressErrors.map" />
        </div>
        <p class="text-xs text-gray-500">
          ثبت‌نام لازم نیست. در صورت تمایل می‌توانید
          <button type="button" class="text-primary-600 font-medium" @click="switchToAccount">وارد حساب شوید</button>.
        </p>
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
        <h2 class="text-sm font-bold text-gray-800">روش ارسال</h2>
        <label
          :class="['flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer', form.deliveryMethod === 'FREE' ? 'border-primary-500 bg-primary-50/40' : 'border-gray-100', !canUseFreeDelivery ? 'opacity-50 cursor-not-allowed' : '']"
        >
          <input v-model="form.deliveryMethod" type="radio" value="FREE" class="mt-1" :disabled="!canUseFreeDelivery" />
          <span>
            <span class="text-sm font-medium block text-green-700">ارسال رایگان</span>
            <span class="text-xs text-gray-500">برای سفارش بالای ۲۰۰٬۰۰۰ تومان — زمان تقریبی ۲۰ تا ۹۰ دقیقه</span>
          </span>
        </label>
        <label
          :class="['flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer', form.deliveryMethod === 'JET' ? 'border-orange-500 bg-orange-50/50' : 'border-gray-100']"
        >
          <input v-model="form.deliveryMethod" type="radio" value="JET" class="mt-1" />
          <span>
            <span class="text-sm font-bold block text-orange-600">ارسال فوری (جت)</span>
            <span class="text-xs text-gray-500">۵۰٬۰۰۰ تومان — زمان تقریبی ۱۵ تا ۳۰ دقیقه</span>
          </span>
        </label>
      </div>

      <div class="card p-4 space-y-3">
        <h2 class="text-sm font-bold text-gray-800">نوع پرداخت</h2>
        <p class="text-xs text-gray-500 leading-relaxed">
          پرداخت در سایت انجام نمی‌شود. فقط گزینه را انتخاب کنید؛ فروشگاه بعد از ثبت سفارش، همین روش را در سیستم فروشگاه ثبت می‌کند.
        </p>
        <label
          v-for="opt in paymentOptions"
          :key="opt.value"
          class="flex items-start gap-3 cursor-pointer rounded-xl border p-3 transition-colors"
          :class="form.paymentMethod === opt.value ? 'border-primary-400 bg-primary-50/30' : 'border-gray-100'"
          @click="selectPaymentMethod(opt.value)"
        >
          <input v-model="form.paymentMethod" type="radio" :value="opt.value" class="mt-1" @click.stop />
          <span class="flex-1 min-w-0">
            <span class="flex items-center gap-2">
              <span class="text-sm font-medium">{{ opt.label }}</span>
              <button
                v-if="installmentMethods.includes(opt.value)"
                type="button"
                class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-primary-700 hover:bg-primary-200"
                aria-label="راهنمای اطلاعات پرداخت"
                @click="openPaymentInfo(opt.value, $event)"
              >
                <AppIcon name="lucide:info" size="sm" />
              </button>
            </span>
            <span v-if="opt.hint" class="text-xs text-gray-400 block mt-0.5">{{ opt.hint }}</span>
            <span v-else-if="opt.info && form.paymentMethod === opt.value" class="text-xs text-gray-500 block mt-1 leading-relaxed">
              {{ opt.info }}
            </span>
          </span>
        </label>

        <AppAlertBanner
          v-if="isInstallment"
          message="سفارش با این نوع پرداخت در وضعیت «در حال بررسی» ثبت می‌شود."
          variant="info"
        />

        <button
          v-if="isInstallment"
          type="button"
          class="w-full flex items-center justify-between p-3 rounded-xl border border-primary-200 bg-primary-50/40 text-sm"
          @click="showPaymentDetails = !showPaymentDetails"
        >
          <span class="font-medium text-primary-700 inline-flex items-center gap-2">
            <AppIcon name="lucide:file-text" size="sm" />
            وارد کردن اطلاعات پرداخت
          </span>
          <AppIcon :name="showPaymentDetails ? 'lucide:chevron-up' : 'lucide:chevron-down'" size="sm" />
        </button>

        <div v-if="isInstallment && showPaymentDetails" class="space-y-3 pt-1">
          <div v-if="form.paymentMethod === 'RETIREMENT_FUND' || form.paymentMethod === 'SOCIAL_SECURITY'">
            <label class="block text-sm font-medium mb-1">کد ملی *</label>
            <input v-model="form.nationalId" type="text" maxlength="10" class="input-field min-h-[44px]" dir="ltr" />
          </div>
          <div v-if="form.paymentMethod === 'RETIREMENT_FUND'">
            <label class="block text-sm font-medium mb-1">شماره کارت حقوقی *</label>
            <input v-model="form.salaryCard" type="text" class="input-field min-h-[44px]" dir="ltr" />
          </div>
          <div v-if="form.paymentMethod === 'TARA'">
            <label class="block text-sm font-medium mb-1">شناسه خرید تارا *</label>
            <input v-model="form.taraId" type="text" class="input-field min-h-[44px]" dir="ltr" />
          </div>
          <div v-if="form.paymentMethod === 'OTHER_WALLET'">
            <label class="block text-sm font-medium mb-1">نوع کیف پول / توضیحات *</label>
            <input v-model="form.walletNote" type="text" class="input-field min-h-[44px]" />
          </div>
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">توضیحات (اختیاری)</label>
        <textarea v-model="form.notes" rows="2" class="input-field resize-none" />
      </div>

      <AppAlertBanner v-if="error" :message="error" />
    </form>

    <div class="fixed bottom-16 md:bottom-0 inset-x-0 z-[55] border-t bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur">
      <div v-if="error" class="mx-auto mb-2 max-w-lg md:max-w-2xl md:hidden"><AppAlertBanner :message="error" /></div>
      <div class="mx-auto max-w-lg md:max-w-2xl">
        <button type="button" class="btn-primary btn-action w-full" :disabled="loading" @click="submitOrder">
          {{ loading ? 'در حال ثبت...' : `ثبت سفارش • ${formatPrice(displayTotal)}` }}
        </button>
      </div>
    </div>
  </div>
</template>
