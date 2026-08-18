<script setup lang="ts">
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '~/types';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const { formatPrice, formatNumber } = useFormat();

const days = ref(30);
const loading = ref(true);
const overview = ref<{
  totalRevenue: number;
  orderCount: number;
  avgOrder: number;
  avgPerCustomer: number;
  uniqueCustomers: number;
  daily: { date: string; revenue: number; orders: number }[];
  workingDays: { date: string; revenue: number; orders: number }[];
  byPayment: { paymentMethod: PaymentMethod; orderCount: number; totalRevenue: number }[];
  topProducts: { name: string; totalQuantity: number }[];
  monthly: {
    monthly: { month: string; revenue: number; orders: number }[];
    changePercent: number | null;
  };
} | null>(null);

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get<typeof overview.value>(`/admin/sales/overview?days=${days.value}`);
    overview.value = data;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(days, load);

const maxDaily = computed(() => {
  const rows = overview.value?.workingDays?.length
    ? overview.value.workingDays
    : overview.value?.daily || [];
  return Math.max(...rows.map((d) => d.revenue), 1);
});
const maxMonthly = computed(() =>
  Math.max(...(overview.value?.monthly?.monthly.map((m) => m.revenue) || [1]), 1)
);

useHead({ title: 'گزارش فروش - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-xl font-bold">گزارش فروش</h1>
        <p class="text-sm text-gray-500 mt-1">فروش روزانه، روش پرداخت و پرفروش‌ترین‌ها</p>
      </div>
      <select v-model.number="days" class="input-field md:w-40">
        <option :value="7">۷ روز اخیر</option>
        <option :value="30">۳۰ روز اخیر</option>
        <option :value="90">۹۰ روز اخیر</option>
      </select>
    </div>

    <LoadingSpinner :show="loading" />

    <template v-if="!loading && overview">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div class="card p-4">
          <p class="text-xs text-gray-500">درآمد کل</p>
          <p class="text-lg font-bold mt-1">{{ formatPrice(overview.totalRevenue) }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs text-gray-500">تعداد سفارش</p>
          <p class="text-lg font-bold mt-1">{{ formatNumber(overview.orderCount) }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs text-gray-500">میانگین سفارش</p>
          <p class="text-lg font-bold mt-1">{{ formatPrice(overview.avgOrder) }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs text-gray-500">میانگین هر مشتری</p>
          <p class="text-lg font-bold mt-1">{{ formatPrice(overview.avgPerCustomer || 0) }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs text-gray-500">روش‌های پرداخت</p>
          <p class="text-lg font-bold mt-1">{{ formatNumber(overview.byPayment.length) }}</p>
        </div>
      </div>

      <div class="grid lg:grid-cols-2 gap-4 mb-6">
        <div class="card p-4">
          <h2 class="font-semibold mb-4">فروش روزهای کاری (به‌جز جمعه)</h2>
          <div class="space-y-2 max-h-72 overflow-y-auto">
            <div v-for="day in (overview.workingDays || overview.daily).slice().reverse()" :key="day.date" class="flex items-center gap-3">
              <span class="text-xs text-gray-500 w-20 shrink-0" dir="ltr">{{ day.date.slice(5) }}</span>
              <div class="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  class="h-full bg-primary-500 rounded-full"
                  :style="{ width: `${Math.round((day.revenue / maxDaily) * 100)}%` }"
                />
              </div>
              <span class="text-xs font-medium w-24 text-end">{{ formatPrice(day.revenue) }}</span>
            </div>
          </div>
        </div>

        <div class="card p-4">
          <h2 class="font-semibold mb-4">فروش به تفکیک پرداخت</h2>
          <div class="space-y-3">
            <div v-for="row in overview.byPayment" :key="row.paymentMethod" class="flex justify-between text-sm border-b border-gray-50 pb-2">
              <span>{{ PAYMENT_METHOD_LABELS[row.paymentMethod] }}</span>
              <span class="font-medium">{{ formatPrice(row.totalRevenue) }} ({{ row.orderCount }})</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="overview.monthly?.monthly?.length" class="card p-4 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold">فروش ماهانه</h2>
          <span v-if="overview.monthly.changePercent != null" class="text-sm text-gray-500">
            نسبت به ماه قبل:
            <b :class="overview.monthly.changePercent >= 0 ? 'text-green-600' : 'text-red-500'">
              {{ overview.monthly.changePercent }}٪
            </b>
          </span>
        </div>
        <div class="space-y-2">
          <div v-for="row in overview.monthly.monthly" :key="row.month" class="flex items-center gap-3">
            <span class="text-xs text-gray-500 w-16 shrink-0" dir="ltr">{{ row.month.slice(5) }}</span>
            <div class="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                class="h-full bg-accent-500 rounded-full"
                :style="{ width: `${Math.round((row.revenue / maxMonthly) * 100)}%` }"
              />
            </div>
            <span class="text-xs font-medium w-28 text-end">{{ formatPrice(row.revenue) }}</span>
          </div>
        </div>
      </div>

      <div class="card p-4">
        <h2 class="font-semibold mb-4">پرفروش‌ترین محصولات</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-gray-500 border-b">
                <th class="text-start p-2">محصول</th>
                <th class="text-start p-2">تعداد فروش</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in overview.topProducts" :key="item.name" class="border-b border-gray-50">
                <td class="p-2">{{ item.name }}</td>
                <td class="p-2">{{ formatNumber(item.totalQuantity) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
