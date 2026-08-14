<script setup lang="ts">
import type { Address } from '~/types';

definePageMeta({ middleware: 'auth' });

const cartStore = useCartStore();
const authStore = useAuthStore();
const api = useApi();
const toast = useToast();
const { formatPrice } = useFormat();

const form = reactive({
  customerName: '',
  customerPhone: '',
  notes: '',
  couponCode: '',
});

const loading = ref(false);
const error = ref('');
const couponLoading = ref(false);
const addressesLoading = ref(true);
const addresses = ref<Address[]>([]);
const selectedAddressId = ref<string | null>(null);

const appliedCoupon = ref<{
  code: string;
  discountAmount: number;
  totalPrice: number;
} | null>(null);

const displayTotal = computed(() => appliedCoupon.value?.totalPrice ?? cartStore.totalPrice);
const displayDiscount = computed(() => appliedCoupon.value?.discountAmount ?? 0);
const selectedAddress = computed(() => addresses.value.find((item) => item.id === selectedAddressId.value) || null);
const hasAddresses = computed(() => addresses.value.length > 0);
const canSubmitOrder = computed(() => hasAddresses.value && !!selectedAddress.value);

onMounted(async () => {
  await cartStore.fetchCart();
  if (cartStore.isEmpty) {
    navigateTo('/cart');
  }

  authStore.init();
  await authStore.fetchProfile();
  if (authStore.user) {
    form.customerName = authStore.fullName;
    form.customerPhone = authStore.user.phone;
  }

  try {
    const { data } = await api.get<Address[]>('/addresses');
    addresses.value = data;

    const defaultAddress = data.find((item) => item.isDefault) || data[0];
    if (defaultAddress) {
      selectAddress(defaultAddress);
    }
  } catch {
    addresses.value = [];
  } finally {
    addressesLoading.value = false;
  }
});

function selectAddress(address: Address) {
  selectedAddressId.value = address.id;
  error.value = '';
}

async function applyCoupon() {
  if (!form.couponCode.trim()) return;

  if (!form.customerPhone.trim()) {
    error.value = 'برای اعمال کد تخفیف، ابتدا شماره موبایل را وارد کنید';
    return;
  }

  couponLoading.value = true;
  error.value = '';
  try {
    const { data } = await api.post<{
      code: string;
      discountAmount: number;
      totalPrice: number;
    }>('/coupons/validate', {
      code: form.couponCode,
      subtotal: cartStore.totalPrice,
      customerPhone: form.customerPhone,
    });
    appliedCoupon.value = data;
  } catch (e: unknown) {
    appliedCoupon.value = null;
    error.value = e instanceof Error ? e.message : 'کد تخفیف نامعتبر است';
  } finally {
    couponLoading.value = false;
  }
}

function removeCoupon() {
  appliedCoupon.value = null;
  form.couponCode = '';
}

async function submitOrder() {
  error.value = '';

  if (!hasAddresses.value) {
    error.value = 'ابتدا آدرس خود را در پروفایل ثبت کنید';
    toast.error(error.value);
    return;
  }

  if (!selectedAddress.value) {
    error.value = 'لطفاً یک آدرس تحویل انتخاب کنید';
    toast.error(error.value);
    return;
  }

  loading.value = true;

  try {
    const payload = {
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      deliveryAddress: selectedAddress.value.address,
      addressId: selectedAddress.value.id,
      addressTitle: selectedAddress.value.title || undefined,
      deliveryLatitude: selectedAddress.value.latitude ?? undefined,
      deliveryLongitude: selectedAddress.value.longitude ?? undefined,
      notes: form.notes || undefined,
      couponCode: appliedCoupon.value?.code || undefined,
    };

    const { data } = await api.post<{ orderNumber: string; id: string }>('/orders', payload);
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
  <div class="px-4 py-4 max-w-lg mx-auto pb-36">
    <h1 class="section-title">ثبت سفارش</h1>

    <div class="card p-4 mb-5 space-y-2">
      <h2 class="text-sm font-medium text-gray-600">خلاصه سفارش</h2>
      <div class="flex items-center justify-between text-sm">
        <span class="text-gray-600">{{ cartStore.totalItems }} کالا</span>
        <span>{{ formatPrice(cartStore.totalPrice) }}</span>
      </div>
      <div v-if="displayDiscount" class="flex items-center justify-between text-sm text-green-600">
        <span>تخفیف</span>
        <span>- {{ formatPrice(displayDiscount) }}</span>
      </div>
      <div class="flex items-center justify-between pt-2 border-t">
        <span class="font-medium">مبلغ قابل پرداخت</span>
        <span class="text-lg font-bold">{{ formatPrice(displayTotal) }}</span>
      </div>
      <p class="text-xs text-gray-400">پرداخت هنگام تحویل</p>
    </div>

    <form class="space-y-4 mb-5" @submit.prevent="submitOrder">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">نام و نام خانوادگی *</label>
        <input v-model="form.customerName" type="text" required minlength="3" class="input-field min-h-[48px]" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">شماره موبایل *</label>
        <input v-model="form.customerPhone" type="tel" required pattern="09[0-9]{9}" class="input-field min-h-[48px]" dir="ltr" inputmode="tel" />
      </div>
    </form>

    <div class="card p-4 mb-5">
      <label class="block text-sm font-medium text-gray-700 mb-2">کد تخفیف</label>
      <div class="flex gap-2">
        <input
          v-model="form.couponCode"
          type="text"
          class="input-field flex-1 min-h-[48px]"
          dir="ltr"
          placeholder="WELCOME10"
          :disabled="!!appliedCoupon"
        />
        <button
          v-if="!appliedCoupon"
          type="button"
          class="btn-secondary whitespace-nowrap min-h-[48px]"
          :disabled="couponLoading || !form.customerPhone.trim()"
          @click="applyCoupon"
        >
          {{ couponLoading ? '...' : 'اعمال' }}
        </button>
        <button v-else type="button" class="btn-secondary min-h-[48px]" @click="removeCoupon">حذف</button>
      </div>
      <p v-if="!form.customerPhone.trim()" class="text-xs text-gray-400 mt-2">
        برای اعمال کد تخفیف، ابتدا شماره موبایل را وارد کنید
      </p>
      <p v-else-if="appliedCoupon" class="text-xs text-green-600 mt-2">
        کد {{ appliedCoupon.code }} اعمال شد
      </p>
    </div>

    <form class="space-y-4" @submit.prevent="submitOrder">
      <LoadingSpinner :show="addressesLoading" />

      <div v-if="!addressesLoading && !hasAddresses" class="space-y-3">
        <AppAlertBanner
          message="ابتدا آدرس خود را در پروفایل ثبت کنید. برای ثبت سفارش باید یک آدرس ذخیره‌شده انتخاب کنید."
          variant="warning"
        />
        <NuxtLink to="/profile/addresses" class="btn-primary w-full min-h-[48px] inline-flex items-center justify-center">
          افزودن آدرس در پروفایل
        </NuxtLink>
      </div>

      <div v-else-if="!addressesLoading && hasAddresses" class="space-y-3">
        <div class="flex items-center justify-between gap-2">
          <label class="block text-sm font-medium text-gray-700">انتخاب آدرس تحویل *</label>
          <NuxtLink to="/profile/addresses" class="text-xs text-primary-600 font-medium min-h-[36px] inline-flex items-center">
            + آدرس جدید
          </NuxtLink>
        </div>

        <button
          v-for="address in addresses"
          :key="address.id"
          type="button"
          :class="[
            'w-full text-start rounded-2xl p-4 transition-all border-2 min-h-[72px]',
            selectedAddressId === address.id ? 'border-primary-500 bg-primary-50/50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200',
          ]"
          @click="selectAddress(address)"
        >
          <div class="flex items-start gap-3">
            <div
              class="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5"
              :class="selectedAddressId === address.id ? 'border-primary-600' : 'border-gray-300'"
            >
              <span v-if="selectedAddressId === address.id" class="w-3 h-3 rounded-full bg-primary-600" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <p v-if="address.title" class="text-sm font-semibold text-gray-800">{{ address.title }}</p>
                <span v-if="address.isDefault" class="text-[10px] bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">پیش‌فرض</span>
                <span
                  v-if="address.latitude != null && address.longitude != null"
                  class="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                >
                  <AppIcon name="lucide:map-pin" size="sm" />
                  موقعیت دقیق
                </span>
              </div>
              <p class="text-sm text-gray-600 mt-1 leading-relaxed">{{ address.address }}</p>
            </div>
          </div>
        </button>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">توضیحات (اختیاری)</label>
        <textarea v-model="form.notes" rows="2" class="input-field resize-none" />
      </div>

      <AppAlertBanner v-if="error" :message="error" />
    </form>

    <div class="fixed bottom-16 md:bottom-0 inset-x-0 z-[55] px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 bg-white/95 backdrop-blur border-t border-gray-100">
      <div v-if="error" class="max-w-lg mx-auto mb-2 md:hidden">
        <AppAlertBanner :message="error" />
      </div>
      <div class="max-w-lg mx-auto">
        <button
          type="button"
          class="btn-primary w-full min-h-[52px] text-base"
          :disabled="loading || !canSubmitOrder"
          @click="submitOrder"
        >
          {{ loading ? 'در حال ثبت...' : `ثبت سفارش • ${formatPrice(displayTotal)}` }}
        </button>
      </div>
    </div>
  </div>
</template>
