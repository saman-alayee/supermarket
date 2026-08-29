<script setup lang="ts">
import type { Order, OrderStatus, Pagination } from '~/types';
import { ORDER_STATUS_LABELS } from '~/types';

definePageMeta({ layout: 'profile', middleware: 'auth' });

const api = useApi();
const { formatPrice, formatShortDate } = useFormat();

const orders = ref<Order[]>([]);
const loading = ref(true);
const statusFilter = ref<OrderStatus | ''>('');

const statusFilters: { value: OrderStatus | ''; label: string }[] = [
  { value: '', label: 'همه' },
  { value: 'NEW', label: ORDER_STATUS_LABELS.NEW },
  { value: 'PREPARING', label: ORDER_STATUS_LABELS.PREPARING },
  { value: 'SHIPPED', label: ORDER_STATUS_LABELS.SHIPPED },
  { value: 'DELIVERED', label: ORDER_STATUS_LABELS.DELIVERED },
  { value: 'CANCELLED', label: ORDER_STATUS_LABELS.CANCELLED },
];

const filteredOrders = computed(() => {
  if (!statusFilter.value) return orders.value;
  return orders.value.filter((o) => o.status === statusFilter.value);
});

onMounted(loadOrders);

async function loadOrders() {
  loading.value = true;
  try {
    const { data } = await api.get<{ orders: Order[]; pagination: Pagination }>('/orders?limit=50');
    orders.value = data.orders;
  } finally {
    loading.value = false;
  }
}

useHead({ title: 'سفارش‌های من - Jetkala' });
</script>

<template>
  <div>
    <ProfilePageHeader title="سفارش‌های من" subtitle="تاریخچه و پیگیری سفارشات" back-to="/profile" />

    <div class="flex gap-2 overflow-x-auto scrollbar-hide mb-5 pb-1">
      <button
        v-for="filter in statusFilters"
        :key="filter.value || 'all'"
        :class="[
          'px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors shrink-0',
          statusFilter === filter.value ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200',
        ]"
        @click="statusFilter = filter.value"
      >
        {{ filter.label }}
      </button>
    </div>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading && filteredOrders.length" class="space-y-3">
      <NuxtLink
        v-for="order in filteredOrders"
        :key="order.id"
        :to="`/profile/orders/${order.id}`"
        class="card p-4 block hover:shadow-md transition-all active:scale-[0.99] group"
      >
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 group-hover:bg-primary-50">
              <AppIcon name="lucide:package" size="sm" class="text-gray-500 group-hover:text-primary-600" />
            </div>
            <span class="text-sm font-bold text-gray-800 truncate" dir="ltr">{{ order.orderNumber }}</span>
          </div>
          <OrderStatusBadge :status="order.status" />
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-400 flex items-center gap-1">
            <AppIcon name="lucide:calendar" size="xs" />
            {{ formatShortDate(order.createdAt) }}
          </span>
          <span class="font-bold text-gray-800">{{ formatPrice(order.totalPrice) }}</span>
        </div>
        <div v-if="order.items?.length" class="text-xs text-gray-400 mt-2 truncate">
          {{ order.items.length }} کالا
          <span v-if="order.discountAmount"> · تخفیف {{ formatPrice(order.discountAmount) }}</span>
        </div>
      </NuxtLink>
    </div>

    <EmptyState
      v-if="!loading && !filteredOrders.length"
      :message="statusFilter ? 'سفارشی با این وضعیت یافت نشد' : 'هنوز سفارشی ثبت نکرده‌اید'"
      :icon="statusFilter ? 'lucide:search-x' : 'lucide:shopping-bag'"
    >
      <NuxtLink to="/" class="btn-primary mt-4 inline-block text-sm">شروع خرید</NuxtLink>
    </EmptyState>
  </div>
</template>
