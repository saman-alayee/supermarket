<script setup lang="ts">
import type { Order, OrderStatus, Pagination } from '~/types';
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '~/types';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const route = useRoute();
const api = useApi();
const toast = useToast();
const { formatPrice, formatShortDate, getProductImage } = useFormat();
const { mapsLink } = useGeocoding();

const orders = ref<Order[]>([]);
const loading = ref(true);
const search = ref('');
const statusFilter = ref((route.query.status as OrderStatus) || '');
const dateFrom = ref<string | null>(null);
const dateTo = ref<string | null>(null);
const selectedOrder = ref<Order | null>(null);
const statusNote = ref('');
const statusError = ref('');

const statusOptions: OrderStatus[] = ['NEW', 'REVIEWING', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  NEW: ['PREPARING', 'CANCELLED'],
  REVIEWING: ['NEW', 'PREPARING', 'CANCELLED'],
  PREPARING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
};

const STATUS_HINTS: Partial<Record<OrderStatus, string>> = {
  REVIEWING: 'نوع پرداخت انتخاب شده است — در سیستم فروشگاه ثبت کنید',
  NEW: 'آماده آماده‌سازی',
  SHIPPED: 'پیام «تحویل به پیک» به مشتری ارسال می‌شود',
  PREPARING: 'پیام «بسته‌بندی شد» به مشتری ارسال می‌شود',
  DELIVERED: 'سفارش تکمیل شد',
  CANCELLED: 'سفارش لغو می‌شود',
};

function paymentLabel(method?: Order['paymentMethod']) {
  return method ? PAYMENT_METHOD_LABELS[method] : '—';
}

function deliveryMethodOf(order: Order): 'FREE' | 'JET' | null {
  const method = order.paymentDetails?.deliveryMethod;
  if (method === 'JET' || method === 'FREE') return method;
  return null;
}

function deliveryLabel(order: Order) {
  const method = deliveryMethodOf(order);
  if (method === 'JET') return 'ارسال جت (فوری)';
  if (method === 'FREE') return 'ارسال رایگان / معمولی';
  return 'نامشخص';
}

function paymentDetailRows(order: Order) {
  const details = order.paymentDetails;
  if (!details) return [];

  const rows: { label: string; value: string }[] = [];
  if (details.nationalId) rows.push({ label: 'کد ملی', value: String(details.nationalId) });
  if (details.salaryCard) rows.push({ label: 'شماره کارت حقوقی', value: String(details.salaryCard) });
  if (details.taraId) rows.push({ label: 'شناسه خرید تارا', value: String(details.taraId) });
  if (details.walletNote) rows.push({ label: 'توضیحات کیف پول', value: String(details.walletNote) });
  if (details.otpVerified === true || details.otpVerified === 'true') {
    rows.push({ label: 'تأیید پیامک', value: 'انجام شده' });
  }
  return rows;
}

onMounted(loadOrders);

async function loadOrders() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (statusFilter.value) params.set('status', statusFilter.value);
    if (search.value) params.set('search', search.value);
    if (dateFrom.value) params.set('dateFrom', dateFrom.value);
    if (dateTo.value) params.set('dateTo', dateTo.value);
    const { data } = await api.get<{ orders: Order[]; pagination: Pagination }>(`/admin/orders?${params}`);
    orders.value = data.orders;
  } finally {
    loading.value = false;
  }
}

async function openOrder(orderId: string) {
  statusError.value = '';
  const { data } = await api.get<Order>(`/admin/orders/${orderId}`);
  selectedOrder.value = data;
  statusNote.value = '';
}

function closeOrder() {
  selectedOrder.value = null;
  statusNote.value = '';
  statusError.value = '';
}

function printOrderSlip(orderId: string) {
  window.open(`/admin/orders/print/${orderId}`, '_blank', 'noopener');
}

async function updateStatus(orderId: string, status: OrderStatus) {
  statusError.value = '';
  try {
    await api.put(`/admin/orders/${orderId}/status`, {
      status,
      note: statusNote.value || undefined,
    });
    toast.success(`وضعیت به «${ORDER_STATUS_LABELS[status]}» تغییر کرد`);
    if (selectedOrder.value?.id === orderId) {
      await openOrder(orderId);
    }
    await loadOrders();
  } catch (e: unknown) {
    statusError.value = e instanceof Error ? e.message : 'خطا در تغییر وضعیت';
    toast.error(statusError.value);
  }
}

async function sendOrderSms(orderId: string) {
  try {
    await api.post(`/admin/orders/${orderId}/send-sms`);
    toast.success('پیامک ارسال شد');
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در ارسال پیامک');
  }
}

function nextStatuses(status: OrderStatus) {
  return NEXT_STATUS[status] || [];
}

watch(statusFilter, loadOrders);
watch([dateFrom, dateTo], loadOrders);

useHead({ title: 'سفارش‌ها - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-xl font-bold text-gray-800">مدیریت سفارش‌ها</h1>
      <p class="text-sm text-gray-500 mt-1">تغییر وضعیت و اطلاع‌رسانی خودکار به مشتری</p>
    </div>

    <div class="flex flex-col md:flex-row gap-3 mb-4">
      <input
        v-model="search"
        type="search"
        class="input-field md:max-w-xs"
        placeholder="شماره سفارش، نام، موبایل..."
        @keyup.enter="loadOrders"
      />
      <button class="btn-secondary text-sm" @click="loadOrders">جستجو</button>
      <AppDatePicker v-model="dateFrom" placeholder="از تاریخ" class="md:max-w-[180px]" />
      <AppDatePicker v-model="dateTo" placeholder="تا تاریخ" class="md:max-w-[180px]" :min="dateFrom" />
    </div>

    <div class="flex gap-2 overflow-x-auto mb-6">
      <button
        :class="['px-3 py-1.5 rounded-full text-sm whitespace-nowrap', !statusFilter ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600']"
        @click="statusFilter = ''"
      >
        همه
      </button>
      <button
        v-for="status in statusOptions"
        :key="status"
        :class="['px-3 py-1.5 rounded-full text-sm whitespace-nowrap', statusFilter === status ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600']"
        @click="statusFilter = status"
      >
        {{ ORDER_STATUS_LABELS[status] }}
      </button>
    </div>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="space-y-3 max-w-3xl">
      <div
        v-for="order in orders"
        :key="order.id"
        class="card p-4 cursor-pointer hover:ring-2 hover:ring-primary-100 transition-all"
        @click="openOrder(order.id)"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="font-bold" dir="ltr">{{ order.orderNumber }}</span>
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              title="چاپ فیش جمع‌آوری"
              @click.stop="printOrderSlip(order.id)"
            >
              <AppIcon name="lucide:printer" size="sm" />
            </button>
            <OrderStatusBadge :status="order.status" />
          </div>
        </div>
        <div class="text-sm text-gray-600">{{ order.customerName }} — {{ order.customerPhone }}</div>
        <div class="flex items-center justify-between text-sm mt-2">
          <span class="text-gray-400">{{ formatShortDate(order.createdAt) }}</span>
          <span class="font-bold">{{ formatPrice(order.totalPrice) }}</span>
        </div>
        <div class="flex flex-wrap gap-1.5 mt-2">
          <span
            v-if="deliveryMethodOf(order) === 'JET'"
            class="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 text-[11px] font-bold px-2 py-0.5"
          >
            جت
          </span>
          <span
            v-else-if="deliveryMethodOf(order) === 'FREE'"
            class="inline-flex items-center gap-1 rounded-full bg-green-50 text-green-700 text-[11px] font-medium px-2 py-0.5"
          >
            رایگان
          </span>
          <span
            v-if="order.paymentMethod && order.paymentMethod !== 'CASH_AT_DOOR'"
            class="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-medium px-2 py-0.5"
          >
            {{ paymentLabel(order.paymentMethod) }}
          </span>
        </div>
      </div>
      <EmptyState v-if="!orders.length" message="سفارشی یافت نشد" />
    </div>

    <!-- Order detail modal -->
    <div
      v-if="selectedOrder"
      class="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4"
      @click.self="closeOrder"
    >
      <div class="bg-white w-full md:max-w-2xl md:rounded-2xl rounded-t-3xl max-h-[92vh] overflow-y-auto shadow-xl">
        <div class="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <h2 class="font-bold text-lg truncate" dir="ltr">{{ selectedOrder.orderNumber }}</h2>
            <div class="mt-1">
              <OrderStatusBadge :status="selectedOrder.status" />
            </div>
          </div>
          <button
            type="button"
            class="p-2 rounded-xl hover:bg-gray-100 text-gray-500 shrink-0"
            aria-label="چاپ فیش جمع‌آوری"
            @click="printOrderSlip(selectedOrder.id)"
          >
            <AppIcon name="lucide:printer" size="lg" />
          </button>
          <button
            type="button"
            class="p-2 rounded-xl hover:bg-gray-100 text-gray-500 shrink-0"
            aria-label="بستن"
            @click="closeOrder"
          >
            <AppIcon name="lucide:x" size="lg" />
          </button>
        </div>

        <div class="p-4 space-y-2 text-sm">
          <p><span class="text-gray-500">مشتری:</span> {{ selectedOrder.customerName }}</p>
          <p dir="ltr"><span class="text-gray-500">موبایل:</span> {{ selectedOrder.customerPhone }}</p>
          <div>
            <p class="text-gray-500 mb-1">آدرس تحویل:</p>
            <p v-if="selectedOrder.addressTitle" class="font-medium text-gray-800">{{ selectedOrder.addressTitle }}</p>
            <p class="leading-relaxed">{{ selectedOrder.deliveryAddress }}</p>
            <a
              v-if="selectedOrder.deliveryLatitude != null && selectedOrder.deliveryLongitude != null"
              :href="mapsLink(selectedOrder.deliveryLatitude, selectedOrder.deliveryLongitude)"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1 text-primary-600 text-xs mt-2"
            >
              <AppIcon name="lucide:navigation" size="sm" />
              مسیریابی در نقشه
            </a>
          </div>
          <AppMapPicker
            v-if="selectedOrder.deliveryLatitude != null && selectedOrder.deliveryLongitude != null"
            :latitude="selectedOrder.deliveryLatitude"
            :longitude="selectedOrder.deliveryLongitude"
            readonly
            show-route
            height="180px"
            :zoom="17"
            class="mt-2"
          />
          <p v-if="selectedOrder.couponCode"><span class="text-gray-500">کد تخفیف:</span> {{ selectedOrder.couponCode }}</p>

          <div
            :class="[
              'rounded-xl border p-3',
              deliveryMethodOf(selectedOrder) === 'JET'
                ? 'border-orange-200 bg-orange-50'
                : 'border-green-100 bg-green-50/60',
            ]"
          >
            <p class="text-xs text-gray-500 mb-0.5">نوع ارسال</p>
            <p
              :class="[
                'font-bold',
                deliveryMethodOf(selectedOrder) === 'JET' ? 'text-orange-700' : 'text-green-700',
              ]"
            >
              {{ deliveryLabel(selectedOrder) }}
            </p>
            <p
              v-if="selectedOrder.paymentDetails?.deliveryFee != null && Number(selectedOrder.paymentDetails.deliveryFee) > 0"
              class="text-xs text-gray-600 mt-1"
            >
              هزینه ارسال: {{ formatPrice(Number(selectedOrder.paymentDetails.deliveryFee)) }}
            </p>
          </div>

          <p>
            <span class="text-gray-500">نوع پرداخت:</span>
            {{ paymentLabel(selectedOrder.paymentMethod) }}
          </p>
          <p v-if="selectedOrder.paymentMethod && selectedOrder.paymentMethod !== 'CASH_AT_DOOR'" class="text-xs text-amber-800 bg-amber-50 rounded-lg p-2">
            این گزینه را در سیستم فروشگاه ثبت کنید؛ پرداخت در سایت انجام نشده است.
          </p>

          <div
            v-if="paymentDetailRows(selectedOrder).length"
            class="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 space-y-2"
          >
            <p class="text-xs font-bold text-indigo-800">اطلاعات خرید قسطی / کیف پول</p>
            <div
              v-for="row in paymentDetailRows(selectedOrder)"
              :key="row.label"
              class="flex flex-wrap items-baseline justify-between gap-2 text-sm"
            >
              <span class="text-gray-500">{{ row.label }}</span>
              <span class="font-bold text-gray-900" dir="ltr">{{ row.value }}</span>
            </div>
          </div>

          <p v-if="selectedOrder.discountAmount">
            <span class="text-gray-500">تخفیف:</span> {{ formatPrice(selectedOrder.discountAmount) }}
          </p>
          <p class="font-bold text-base pt-2">{{ formatPrice(selectedOrder.totalPrice) }}</p>
        </div>

        <div v-if="selectedOrder.items?.length" class="px-4 pb-4 border-t pt-4">
          <p class="text-sm font-medium mb-2">اقلام</p>
          <div class="space-y-2">
            <div
              v-for="item in selectedOrder.items"
              :key="item.id"
              class="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-2"
            >
              <img
                :src="getProductImage(item.product?.image ?? null)"
                :alt="item.name"
                class="h-14 w-14 shrink-0 rounded-lg object-cover bg-white border border-gray-100"
                loading="lazy"
              />
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-gray-800 leading-snug">{{ item.name }}</p>
                <p class="text-xs text-gray-500 mt-0.5">تعداد: {{ item.quantity }}</p>
                <p v-if="item.product?.barcode" class="text-[11px] text-gray-400 font-mono mt-0.5" dir="ltr">
                  {{ item.product.barcode }}
                </p>
              </div>
              <span class="shrink-0 text-sm font-bold text-gray-800">
                {{ formatPrice(item.subtotal || item.price * item.quantity) }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="nextStatuses(selectedOrder.status).length" class="px-4 pb-4 border-t pt-4">
          <AppAlertBanner :message="statusError" class="mb-3" />

          <label class="block text-sm font-medium mb-2">یادداشت برای مشتری (اختیاری)</label>
          <textarea v-model="statusNote" rows="2" class="input-field text-sm resize-none mb-3" placeholder="مثلاً: پیک تا ۳۰ دقیقه دیگر می‌رسد" />

          <p class="text-sm font-medium mb-2">تغییر وضعیت</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="status in nextStatuses(selectedOrder.status)"
              :key="status"
              class="btn-primary text-sm"
              @click="updateStatus(selectedOrder!.id, status)"
            >
              {{ ORDER_STATUS_LABELS[status] }}
            </button>
          </div>
          <p v-for="status in nextStatuses(selectedOrder.status)" :key="`hint-${status}`" class="text-xs text-gray-400 mt-2">
            {{ STATUS_HINTS[status] }}
          </p>
        </div>

        <div class="px-4 pb-4 flex flex-col gap-2">
          <button
            class="btn-secondary w-full text-sm"
            @click="printOrderSlip(selectedOrder.id)"
          >
            چاپ فیش جمع‌آوری
          </button>
          <button
            v-if="selectedOrder.status === 'PREPARING' || selectedOrder.status === 'SHIPPED'"
            class="btn-secondary w-full text-sm"
            @click="sendOrderSms(selectedOrder.id)"
          >
            ارسال دوباره پیامک وضعیت
          </button>
        </div>

        <div v-if="selectedOrder.statusLogs?.length" class="px-4 pb-6 border-t pt-4">
          <p class="text-sm font-medium mb-2">تاریخچه</p>
          <div v-for="log in selectedOrder.statusLogs" :key="log.id" class="text-xs text-gray-500 py-1 border-b border-gray-50 last:border-0">
            {{ ORDER_STATUS_LABELS[log.status] }} — {{ formatShortDate(log.createdAt) }}
            <span v-if="log.note" class="block text-gray-400">{{ log.note }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
