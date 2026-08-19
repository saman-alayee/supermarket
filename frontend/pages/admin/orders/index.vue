<script setup lang="ts">
import type { Order, OrderStatus, Pagination } from '~/types';
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '~/types';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const route = useRoute();
const api = useApi();
const toast = useToast();
const { formatPrice, formatShortDate } = useFormat();
const { mapsLink } = useGeocoding();

const orders = ref<Order[]>([]);
const loading = ref(true);
const search = ref('');
const statusFilter = ref((route.query.status as OrderStatus) || '');
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

onMounted(loadOrders);

async function loadOrders() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (statusFilter.value) params.set('status', statusFilter.value);
    if (search.value) params.set('search', search.value);
    const { data } = await api.get<{ orders: Order[]; pagination: Pagination }>(`/admin/orders?${params}`);
    orders.value = data.orders;
  } finally {
    loading.value = false;
  }
}

async function openOrder(orderId: string) {
  const { data } = await api.get<Order>(`/admin/orders/${orderId}`);
  selectedOrder.value = data;
  statusNote.value = '';
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

    <div v-if="!loading" class="grid lg:grid-cols-2 gap-4">
      <div class="space-y-3">
        <div
          v-for="order in orders"
          :key="order.id"
          class="card p-4 cursor-pointer hover:ring-2 hover:ring-primary-100 transition-all"
          :class="selectedOrder?.id === order.id ? 'ring-2 ring-primary-300' : ''"
          @click="openOrder(order.id)"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="font-bold" dir="ltr">{{ order.orderNumber }}</span>
            <OrderStatusBadge :status="order.status" />
          </div>
          <div class="text-sm text-gray-600">{{ order.customerName }} — {{ order.customerPhone }}</div>
          <div class="flex items-center justify-between text-sm mt-2">
            <span class="text-gray-400">{{ formatShortDate(order.createdAt) }}</span>
            <span class="font-bold">{{ formatPrice(order.totalPrice) }}</span>
          </div>
          <p v-if="order.paymentMethod && order.paymentMethod !== 'CASH_AT_DOOR'" class="text-xs text-indigo-600 mt-1">
            {{ paymentLabel(order.paymentMethod) }}
          </p>
        </div>
        <EmptyState v-if="!orders.length" message="سفارشی یافت نشد" />
      </div>

      <div v-if="selectedOrder" class="card p-4 h-fit sticky top-24">
        <h2 class="font-bold text-lg mb-1" dir="ltr">{{ selectedOrder.orderNumber }}</h2>
        <OrderStatusBadge :status="selectedOrder.status" />

        <div class="mt-4 space-y-2 text-sm">
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
            height="180px"
            :zoom="17"
            class="mt-2"
          />
          <p v-if="selectedOrder.couponCode"><span class="text-gray-500">کد تخفیف:</span> {{ selectedOrder.couponCode }}</p>
          <p>
            <span class="text-gray-500">نوع پرداخت:</span>
            {{ paymentLabel(selectedOrder.paymentMethod) }}
          </p>
          <p v-if="selectedOrder.paymentMethod && selectedOrder.paymentMethod !== 'CASH_AT_DOOR'" class="text-xs text-amber-800 bg-amber-50 rounded-lg p-2">
            این گزینه را در سیستم فروشگاه ثبت کنید؛ پرداخت در سایت انجام نشده است.
          </p>
          <p v-if="selectedOrder.discountAmount">
            <span class="text-gray-500">تخفیف:</span> {{ formatPrice(selectedOrder.discountAmount) }}
          </p>
          <p class="font-bold text-base pt-2">{{ formatPrice(selectedOrder.totalPrice) }}</p>
        </div>

        <div v-if="selectedOrder.items?.length" class="mt-4 border-t pt-4">
          <p class="text-sm font-medium mb-2">اقلام</p>
          <div v-for="item in selectedOrder.items" :key="item.id" class="flex justify-between text-sm py-1">
            <span>{{ item.name }} × {{ item.quantity }}</span>
            <span>{{ formatPrice(item.subtotal || item.price * item.quantity) }}</span>
          </div>
        </div>

        <div v-if="nextStatuses(selectedOrder.status).length" class="mt-6 border-t pt-4">
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

        <button
          v-if="selectedOrder.status === 'PREPARING' || selectedOrder.status === 'SHIPPED'"
          class="btn-secondary w-full text-sm mt-3"
          @click="sendOrderSms(selectedOrder.id)"
        >
          ارسال دوباره پیامک وضعیت
        </button>

        <div v-if="selectedOrder.statusLogs?.length" class="mt-6 border-t pt-4">
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
