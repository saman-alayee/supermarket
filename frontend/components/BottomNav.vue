<script setup lang="ts">
import { useOrdersStore } from '~/stores/orders';

const route = useRoute();
const cartStore = useCartStore();
const ordersStore = useOrdersStore();
const { toPersianDigits } = useFormat();

const navItems = [
  { to: '/', label: 'خانه', icon: 'lucide:home' },
  { to: '/categories', label: 'دسته‌بندی', icon: 'lucide:layout-grid' },
  { to: '/profile/orders', label: 'سفارش‌ها', icon: 'lucide:package', badge: 'orders' as const },
  { to: '/cart', label: 'سبد خرید', icon: 'lucide:shopping-cart', badge: 'cart' as const },
  { to: '/profile', label: 'پروفایل', icon: 'lucide:user' },
];

function isActive(path: string) {
  if (path === '/') return route.path === '/';
  if (path === '/profile') {
    return route.path === '/profile' || (route.path.startsWith('/profile/') && !route.path.startsWith('/profile/orders'));
  }
  return route.path.startsWith(path);
}

function badgeCount(type: 'cart' | 'orders'): number {
  if (type === 'cart') return cartStore.totalItems;
  return ordersStore.totalCount;
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
        <div class="relative">
          <AppIcon
            :name="item.icon"
            size="md"
            :class="isActive(item.to) ? 'text-primary-600' : 'text-gray-400'"
          />
          <span
            v-if="item.badge && badgeCount(item.badge) > 0"
            class="absolute -top-1.5 -start-2 min-w-[16px] h-4 px-1 text-[10px] font-bold leading-none text-white bg-primary-600 rounded-full flex items-center justify-center ring-2 ring-white"
          >
            {{ toPersianDigits(badgeCount(item.badge)) }}
          </span>
        </div>
        <span :class="['text-[9px] font-medium leading-tight text-center', isActive(item.to) ? 'text-primary-600' : 'text-gray-400']">
          {{ item.label }}
        </span>
      </NuxtLink>
    </div>
  </nav>
</template>
