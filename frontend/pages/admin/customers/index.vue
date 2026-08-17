<script setup lang="ts">
import type { AdminCustomer, CustomerGroup, PaymentMethod } from '~/types';
import { PAYMENT_METHOD_LABELS } from '~/types';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const toast = useToast();
const { formatPrice, formatNumber } = useFormat();

const customers = ref<AdminCustomer[]>([]);
const groups = ref<CustomerGroup[]>([]);
const loading = ref(true);
const search = ref('');
const groupFilter = ref('');
const paymentFilter = ref<PaymentMethod | ''>('');
const selectedCustomer = ref<AdminCustomer | null>(null);
const detailLoading = ref(false);

const paymentOptions = [
  { value: '', label: 'همه روش‌ها', icon: 'lucide:credit-card' },
  ...Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({
    value,
    label,
    icon: 'lucide:wallet',
  })),
];

const groupOptions = computed(() => [
  { value: '', label: 'همه گروه‌ها', icon: 'lucide:users' },
  ...groups.value.map((group) => ({
    value: group.id,
    label: group.name,
    icon: 'lucide:tags',
  })),
]);

onMounted(loadData);

async function loadData() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (search.value.trim()) params.set('search', search.value.trim());
    if (groupFilter.value) params.set('groupId', groupFilter.value);
    if (paymentFilter.value) params.set('paymentMethod', paymentFilter.value);

    const [customersRes, groupsRes] = await Promise.all([
      api.get<{ customers: AdminCustomer[] }>(`/admin/customers?${params}`),
      api.get<CustomerGroup[]>('/admin/customer-groups').catch(() => ({ data: [] as CustomerGroup[] })),
    ]);
    customers.value = customersRes.data.customers;
    groups.value = groupsRes.data;
  } catch {
    customers.value = [];
  } finally {
    loading.value = false;
  }
}

async function openCustomer(customer: AdminCustomer) {
  detailLoading.value = true;
  selectedCustomer.value = customer;
  try {
    const { data } = await api.get<AdminCustomer>(`/admin/customers/${customer.id}`);
    selectedCustomer.value = data;
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در دریافت جزئیات');
  } finally {
    detailLoading.value = false;
  }
}

function exportCsv() {
  const header = ['نام', 'موبایل', 'تعداد سفارش', 'تاریخ عضویت'];
  const rows = customers.value.map((customer) => [
    `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.phone,
    customer.phone,
    String(customer._count.orders),
    new Date(customer.createdAt).toLocaleDateString('fa-IR'),
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `customers-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function closeDetail() {
  selectedCustomer.value = null;
}

useHead({ title: 'مشتریان - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-6">
      <div>
        <h1 class="text-xl font-bold text-gray-800">مدیریت مشتریان</h1>
        <p class="text-sm text-gray-500 mt-1">جستجو، گروه‌بندی و تاریخچه سفارش</p>
      </div>
      <button class="btn-secondary text-sm" @click="exportCsv">خروجی CSV</button>
    </div>

    <div class="grid md:grid-cols-3 gap-3 mb-4">
      <input
        v-model="search"
        type="search"
        placeholder="جستجو نام یا موبایل..."
        class="input-field"
        @keyup.enter="loadData"
      />
      <AppSelect v-model="groupFilter" :options="groupOptions" placeholder="گروه مشتری" @update:model-value="loadData" />
      <AppSelect v-model="paymentFilter" :options="paymentOptions" placeholder="روش پرداخت" @update:model-value="loadData" />
    </div>

    <button class="btn-primary text-sm mb-4" @click="loadData">اعمال فیلتر</button>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-gray-600">
          <tr>
            <th class="text-start p-3">مشتری</th>
            <th class="text-start p-3 hidden md:table-cell">موبایل</th>
            <th class="text-start p-3">سفارش‌ها</th>
            <th class="text-start p-3 hidden lg:table-cell">گروه</th>
            <th class="p-3">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="customer in customers" :key="customer.id" class="border-t border-gray-100">
            <td class="p-3 font-medium">
              {{ customer.firstName || customer.lastName ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() : '—' }}
            </td>
            <td class="p-3 hidden md:table-cell" dir="ltr">{{ customer.phone }}</td>
            <td class="p-3">{{ formatNumber(customer._count.orders) }}</td>
            <td class="p-3 hidden lg:table-cell text-gray-500">{{ customer.customerGroup?.name || '—' }}</td>
            <td class="p-3">
              <button class="text-primary-600" @click="openCustomer(customer)">جزئیات</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <EmptyState v-if="!loading && !customers.length" message="مشتری یافت نشد" />

    <div v-if="selectedCustomer" class="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4" @click.self="closeDetail">
      <div class="bg-white rounded-t-3xl md:rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 class="text-lg font-bold text-gray-800">جزئیات مشتری</h2>
            <p class="text-sm text-gray-500 mt-1" dir="ltr">{{ selectedCustomer.phone }}</p>
          </div>
          <button class="p-2 rounded-lg hover:bg-gray-100" @click="closeDetail">
            <AppIcon name="lucide:x" size="md" />
          </button>
        </div>

        <LoadingSpinner :show="detailLoading" />

        <div v-if="!detailLoading" class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <div class="card p-3">
              <p class="text-xs text-gray-500">تعداد سفارش</p>
              <p class="text-xl font-bold">{{ formatNumber(selectedCustomer._count.orders) }}</p>
            </div>
            <div class="card p-3">
              <p class="text-xs text-gray-500">گروه</p>
              <p class="text-sm font-medium">{{ selectedCustomer.customerGroup?.name || 'بدون گروه' }}</p>
            </div>
          </div>

          <div>
            <h3 class="text-sm font-bold text-gray-700 mb-2">تاریخچه سفارش</h3>
            <div v-if="selectedCustomer.orders?.length" class="space-y-2">
              <div
                v-for="order in selectedCustomer.orders"
                :key="order.id"
                class="rounded-xl border border-gray-100 p-3"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-sm font-medium" dir="ltr">{{ order.orderNumber }}</span>
                  <OrderStatusBadge :status="order.status" />
                </div>
                <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
                  <span>{{ formatPrice(order.totalPrice) }}</span>
                  <span>{{ new Date(order.createdAt).toLocaleDateString('fa-IR') }}</span>
                </div>
                <p v-if="order.paymentMethod" class="text-xs text-gray-400 mt-1">
                  {{ PAYMENT_METHOD_LABELS[order.paymentMethod] }}
                </p>
              </div>
            </div>
            <EmptyState v-else message="سفارشی ثبت نشده" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
