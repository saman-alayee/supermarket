<script setup lang="ts">
const authStore = useAuthStore();
const cartStore = useCartStore();
const { toPersianDigits } = useFormat();

const searchQuery = ref('');
const showSearch = ref(false);

function handleSearch() {
  if (searchQuery.value.trim()) {
    navigateTo(`/search?q=${encodeURIComponent(searchQuery.value.trim())}`);
    showSearch.value = false;
  }
}
</script>

<template>
  <header class="sticky top-0 z-50 bg-white border-b border-gray-100">
    <div class="max-w-7xl mx-auto px-4">
      <div class="flex items-center justify-between h-16 md:h-[4.5rem]">
        <button class="md:hidden p-2 -ms-2 text-gray-600" @click="showSearch = !showSearch">
          <AppIcon name="lucide:search" size="lg" />
        </button>

        <AppLogo size="lg" />

        <div class="hidden md:flex flex-1 max-w-xl mx-8">
          <form class="w-full relative" @submit.prevent="handleSearch">
            <input
              v-model="searchQuery"
              type="search"
              placeholder="جستجو در KIAA KALA..."
              class="input-field pe-12 bg-gray-50"
            />
            <button type="submit" class="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600">
              <AppIcon name="lucide:search" size="md" />
            </button>
          </form>
        </div>

        <div class="hidden md:flex items-center gap-4">
          <NuxtLink
            v-if="!authStore.isLoggedIn"
            to="/auth/login"
            class="flex items-center gap-2 text-gray-600 hover:text-primary-600 text-sm"
          >
            <AppIcon name="lucide:user" size="md" />
            ورود / ثبت‌نام
          </NuxtLink>
          <NuxtLink
            v-else
            to="/profile"
            class="flex items-center gap-2 text-gray-600 hover:text-primary-600 text-sm"
          >
            <AppIcon name="lucide:user-circle" size="md" />
            {{ authStore.fullName }}
          </NuxtLink>

          <NuxtLink
            to="/cart"
            class="relative p-2.5 text-gray-600 hover:text-primary-600 rounded-xl hover:bg-gray-50 transition-colors"
            aria-label="سبد خرید"
          >
            <AppIcon name="lucide:shopping-cart" size="lg" />
            <span v-if="cartStore.totalItems > 0" class="badge absolute -top-0.5 -start-0.5">
              {{ toPersianDigits(cartStore.totalItems) }}
            </span>
          </NuxtLink>
        </div>

        <NuxtLink v-if="authStore.isLoggedIn" to="/profile/notifications" class="md:hidden p-2 text-gray-600" aria-label="اعلان‌ها">
          <AppIcon name="lucide:bell" size="lg" />
        </NuxtLink>
        <div v-else class="md:hidden w-10" />
      </div>

      <div v-if="showSearch" class="md:hidden pb-3">
        <form @submit.prevent="handleSearch">
          <input
            v-model="searchQuery"
            type="search"
            placeholder="جستجو..."
            class="input-field bg-gray-50"
            autofocus
          />
        </form>
      </div>

      <nav class="md:hidden flex gap-2 overflow-x-auto scrollbar-hide pb-2.5 text-xs font-medium">
        <NuxtLink to="/search?discounted=1" class="shrink-0 px-3 py-1.5 rounded-full bg-red-50 text-red-700 border border-red-100">
          تخفیف‌دار
        </NuxtLink>
        <NuxtLink to="/search?featured=1" class="shrink-0 px-3 py-1.5 rounded-full bg-primary-50 text-primary-700 border border-primary-100">
          پیشنهاد ویژه
        </NuxtLink>
        <NuxtLink to="/categories" class="shrink-0 px-3 py-1.5 rounded-full bg-gray-50 text-gray-700 border border-gray-100">
          دسته‌بندی‌ها
        </NuxtLink>
        <NuxtLink to="/contact" class="shrink-0 px-3 py-1.5 rounded-full bg-gray-50 text-gray-700 border border-gray-100">
          تماس با ما
        </NuxtLink>
      </nav>

      <nav class="hidden md:flex items-center gap-6 pb-3 text-sm text-gray-600">
        <NuxtLink to="/" class="hover:text-primary-600 transition-colors flex items-center gap-1.5">
          <AppIcon name="lucide:home" size="sm" />
          خانه
        </NuxtLink>
        <NuxtLink to="/categories" class="hover:text-primary-600 transition-colors flex items-center gap-1.5">
          <AppIcon name="lucide:layout-grid" size="sm" />
          دسته‌بندی‌ها
        </NuxtLink>
        <NuxtLink to="/profile/orders" class="hover:text-primary-600 transition-colors flex items-center gap-1.5">
          <AppIcon name="lucide:package-search" size="sm" />
          پیگیری سفارش
        </NuxtLink>
        <NuxtLink to="/search?featured=1" class="hover:text-primary-600 transition-colors flex items-center gap-1.5">
          <AppIcon name="lucide:sparkles" size="sm" />
          پیشنهادهای ویژه
        </NuxtLink>
        <NuxtLink to="/search?discounted=1" class="hover:text-primary-600 transition-colors flex items-center gap-1.5">
          <AppIcon name="lucide:percent" size="sm" />
          تخفیف‌دار
        </NuxtLink>
        <NuxtLink to="/contact" class="hover:text-primary-600 transition-colors flex items-center gap-1.5">
          <AppIcon name="lucide:phone" size="sm" />
          تماس با ما
        </NuxtLink>
      </nav>
    </div>
  </header>
</template>
