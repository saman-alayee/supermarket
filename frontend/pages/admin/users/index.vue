<script setup lang="ts">
import type { User, Pagination } from '~/types';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const toast = useToast();

interface UserRow extends User {
  createdAt: string;
  _count: { orders: number };
}

const users = ref<UserRow[]>([]);
const loading = ref(true);
const search = ref('');
const roleFilter = ref<'ALL' | 'CUSTOMER' | 'ADMIN'>('ALL');
const roleOptions = [
  { value: 'ALL', label: 'همه نقش‌ها', icon: 'lucide:users' },
  { value: 'CUSTOMER', label: 'مشتری', icon: 'lucide:user' },
  { value: 'ADMIN', label: 'ادمین', icon: 'lucide:shield-check' },
];
const showAdminForm = ref(false);
const adminForm = reactive({ phone: '', firstName: '', lastName: '' });
const formError = ref('');

onMounted(loadUsers);

async function loadUsers() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (search.value) params.set('search', search.value);
    if (roleFilter.value !== 'ALL') params.set('role', roleFilter.value);
    const { data } = await api.get<{ customers: UserRow[]; pagination: Pagination }>(`/admin/users?${params}`);
    users.value = data.customers;
  } finally {
    loading.value = false;
  }
}

async function promoteToAdmin(user: UserRow) {
  if (!confirm(`کاربر ${user.phone} به ادمین تبدیل شود؟`)) return;
  try {
    await api.put(`/admin/users/${user.id}/role`, { role: 'ADMIN' });
    toast.success('کاربر به ادمین ارتقا یافت');
    await loadUsers();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا');
  }
}

async function demoteToCustomer(user: UserRow) {
  if (!confirm(`نقش ادمین از ${user.phone} گرفته شود؟`)) return;
  try {
    await api.put(`/admin/users/${user.id}/role`, { role: 'CUSTOMER' });
    toast.success('نقش کاربر به مشتری تغییر کرد');
    await loadUsers();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا');
  }
}

async function toggleActive(user: UserRow) {
  try {
    await api.put(`/admin/users/${user.id}/toggle-active`);
    toast.success('وضعیت کاربر به‌روزرسانی شد');
    await loadUsers();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا');
  }
}

async function createAdmin() {
  formError.value = '';
  try {
    await api.post('/admin/users/admin', adminForm);
    toast.success('ادمین جدید اضافه شد');
    showAdminForm.value = false;
    adminForm.phone = '';
    adminForm.firstName = '';
    adminForm.lastName = '';
    await loadUsers();
  } catch (e: unknown) {
    formError.value = e instanceof Error ? e.message : 'خطا';
    toast.error(formError.value);
  }
}

useHead({ title: 'کاربران - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
      <div>
        <h1 class="text-xl font-bold text-gray-800">مدیریت کاربران</h1>
        <p class="text-sm text-gray-500 mt-1">لیست مشتریان و ادمین‌ها</p>
      </div>
      <button class="btn-primary text-sm" @click="showAdminForm = true">+ افزودن ادمین</button>
    </div>

    <div class="flex flex-col md:flex-row gap-3 mb-4">
      <input
        v-model="search"
        type="search"
        class="input-field md:max-w-xs"
        placeholder="جستجو نام یا موبایل..."
        @keyup.enter="loadUsers"
      />
      <AppSelect
        v-model="roleFilter"
        :options="roleOptions"
        class="md:max-w-[220px]"
        @change="loadUsers"
      />
      <button class="btn-secondary text-sm" @click="loadUsers">جستجو</button>
    </div>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="card overflow-x-auto">
      <table class="w-full text-sm min-w-[640px]">
        <thead class="bg-gray-50 text-gray-600">
          <tr>
            <th class="text-start p-3">نام</th>
            <th class="text-start p-3">موبایل</th>
            <th class="text-start p-3">نقش</th>
            <th class="text-start p-3">سفارش</th>
            <th class="text-start p-3">وضعیت</th>
            <th class="text-start p-3">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id" class="border-t border-gray-100">
            <td class="p-3">{{ user.firstName }} {{ user.lastName }}</td>
            <td class="p-3" dir="ltr">{{ user.phone }}</td>
            <td class="p-3">
              <span :class="user.role === 'ADMIN' ? 'text-purple-700 bg-purple-50' : 'text-gray-600 bg-gray-100'" class="px-2 py-1 rounded-full text-xs">
                {{ user.role === 'ADMIN' ? 'ادمین' : 'مشتری' }}
              </span>
            </td>
            <td class="p-3">{{ user._count.orders }}</td>
            <td class="p-3">
              <span :class="user.isActive !== false ? 'text-green-600' : 'text-red-500'">
                {{ user.isActive !== false ? 'فعال' : 'غیرفعال' }}
              </span>
            </td>
            <td class="p-3">
              <div class="flex flex-wrap gap-1">
                <button
                  v-if="user.role === 'CUSTOMER'"
                  class="text-xs px-2 py-1 rounded bg-purple-50 text-purple-700"
                  @click="promoteToAdmin(user)"
                >
                  ارتقا به ادمین
                </button>
                <button
                  v-else
                  class="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600"
                  @click="demoteToCustomer(user)"
                >
                  حذف نقش ادمین
                </button>
                <button class="text-xs px-2 py-1 rounded bg-gray-100" @click="toggleActive(user)">
                  {{ user.isActive !== false ? 'غیرفعال' : 'فعال‌سازی' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showAdminForm" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <form class="bg-white rounded-2xl w-full max-w-md p-6 space-y-4" @submit.prevent="createAdmin">
        <h2 class="text-lg font-bold">افزودن ادمین جدید</h2>
        <AppAlertBanner :message="formError" />

        <div>
          <label class="block text-sm mb-1">شماره موبایل</label>
          <input v-model="adminForm.phone" required class="input-field" dir="ltr" placeholder="09123456789" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm mb-1">نام</label>
            <input v-model="adminForm.firstName" class="input-field" />
          </div>
          <div>
            <label class="block text-sm mb-1">نام خانوادگی</label>
            <input v-model="adminForm.lastName" class="input-field" />
          </div>
        </div>
        <p class="text-xs text-gray-400">ادمین جدید با OTP یا رمز ادمین (در صورت تنظیم) می‌تواند وارد شود.</p>
        <div class="flex gap-2">
          <button type="submit" class="btn-primary flex-1">ذخیره</button>
          <button type="button" class="btn-secondary flex-1" @click="showAdminForm = false">انصراف</button>
        </div>
      </form>
    </div>
  </div>
</template>
