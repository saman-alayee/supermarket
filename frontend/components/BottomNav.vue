<script setup lang="ts">
const route = useRoute();

const navItems = [
  { to: '/', label: 'خانه', icon: 'lucide:home' },
  { to: '/categories', label: 'دسته‌بندی', icon: 'lucide:layout-grid' },
  { to: '/profile/orders', label: 'سفارش‌ها', icon: 'lucide:package' },
  { to: '/cart', label: 'سبد خرید', icon: 'lucide:shopping-cart' },
  { to: '/profile', label: 'پروفایل', icon: 'lucide:user' },
];

function isActive(path: string) {
  if (path === '/') return route.path === '/';
  if (path === '/profile') {
    return route.path === '/profile' || (route.path.startsWith('/profile/') && !route.path.startsWith('/profile/orders'));
  }
  return route.path.startsWith(path);
}
</script>

<template>
  <nav class="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-100 md:hidden pb-[env(safe-area-inset-bottom)]">
    <div class="flex items-center justify-around py-2 px-1">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="flex flex-col items-center gap-0.5 px-1.5 py-1 min-w-0 flex-1 max-w-[72px]"
      >
        <AppIcon
          :name="item.icon"
          size="md"
          :class="isActive(item.to) ? 'text-primary-600' : 'text-gray-400'"
        />
        <span :class="['text-[9px] font-medium leading-tight text-center', isActive(item.to) ? 'text-primary-600' : 'text-gray-400']">
          {{ item.label }}
        </span>
      </NuxtLink>
    </div>
  </nav>
</template>
