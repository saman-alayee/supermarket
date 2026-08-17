<script setup lang="ts">
const route = useRoute();
const authStore = useAuthStore();
const mobileNavOpen = ref(false);

const navItems = [
  { to: '/admin', label: 'داشبورد', icon: 'lucide:layout-dashboard' },
  { to: '/admin/orders', label: 'سفارش‌ها', icon: 'lucide:package' },
  { to: '/admin/sales', label: 'گزارش فروش', icon: 'lucide:bar-chart-3' },
  { to: '/admin/products', label: 'محصولات', icon: 'lucide:shopping-basket' },
  { to: '/admin/categories', label: 'دسته‌بندی', icon: 'lucide:layers' },
  { to: '/admin/tags', label: 'برچسب‌ها', icon: 'lucide:tags' },
  { to: '/admin/sliders', label: 'اسلایدرها', icon: 'lucide:images' },
  { to: '/admin/customers', label: 'مشتریان', icon: 'lucide:user-round' },
  { to: '/admin/coupons', label: 'کدهای تخفیف', icon: 'lucide:ticket-percent' },
  { to: '/admin/users', label: 'کاربران', icon: 'lucide:users' },
  { to: '/admin/content', label: 'محتوا', icon: 'lucide:file-text' },
];

watch(() => route.path, () => {
  mobileNavOpen.value = false;
});
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Desktop sidebar -->
    <aside class="fixed top-0 start-0 h-full w-64 bg-white border-e border-gray-200 z-40 hidden lg:flex lg:flex-col">
      <div class="p-6 border-b border-gray-100">
        <NuxtLink to="/admin">
          <AppLogo size="sm" />
        </NuxtLink>
        <p class="text-xs text-gray-400 mt-1">پنل مدیریت حرفه‌ای</p>
      </div>
      <nav class="p-4 space-y-1 flex-1 overflow-y-auto">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="admin-nav-link"
          active-class="admin-nav-active"
        >
          <AppIcon :name="item.icon" size="md" class="shrink-0 opacity-80" />
          <span>{{ item.label }}</span>
        </NuxtLink>
        <hr class="my-4 border-gray-100" />
        <NuxtLink to="/" class="admin-nav-link">
          <AppIcon name="lucide:store" size="md" class="shrink-0 opacity-80" />
          <span>بازگشت به فروشگاه</span>
        </NuxtLink>
      </nav>
    </aside>

    <!-- Mobile drawer -->
    <div v-if="mobileNavOpen" class="fixed inset-0 z-50 lg:hidden">
      <div class="absolute inset-0 bg-black/40" @click="mobileNavOpen = false" />
      <aside class="absolute top-0 start-0 h-full w-72 bg-white shadow-xl flex flex-col">
        <div class="p-4 border-b flex items-center justify-between">
          <AppLogo size="sm" />
          <button class="p-2 rounded-lg hover:bg-gray-100 text-gray-500" @click="mobileNavOpen = false">
            <AppIcon name="lucide:x" size="lg" />
          </button>
        </div>
        <nav class="p-4 space-y-1 flex-1 overflow-y-auto">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="admin-nav-link"
            active-class="admin-nav-active"
          >
            <AppIcon :name="item.icon" size="md" class="shrink-0 opacity-80" />
            <span>{{ item.label }}</span>
          </NuxtLink>
          <hr class="my-4 border-gray-100" />
          <NuxtLink to="/" class="admin-nav-link">
            <AppIcon name="lucide:store" size="md" class="shrink-0 opacity-80" />
            <span>بازگشت به فروشگاه</span>
          </NuxtLink>
        </nav>
      </aside>
    </div>

    <div class="lg:ms-64">
      <header class="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 lg:px-6 py-3">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <button
              class="lg:hidden p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
              @click="mobileNavOpen = true"
            >
              <AppIcon name="lucide:menu" size="lg" />
            </button>
            <div>
              <p class="text-sm font-medium text-gray-800">{{ authStore.fullName }}</p>
              <p class="text-xs text-gray-400">مدیر سیستم</p>
            </div>
          </div>
          <button
            class="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50"
            @click="authStore.logout(); navigateTo('/')"
          >
            <AppIcon name="lucide:log-out" size="sm" />
            خروج
          </button>
        </div>
      </header>
      <main class="p-4 lg:p-6">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-nav-link {
  @apply flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors;
}
.admin-nav-active {
  @apply bg-primary-50 text-primary-700 font-medium;
}
.admin-nav-active :deep(svg) {
  @apply text-primary-600 opacity-100;
}
</style>
