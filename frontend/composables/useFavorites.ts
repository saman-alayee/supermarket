import type { Product } from '~/types';

const favoriteIds = ref<Set<string>>(new Set());
const favoritesLoaded = ref(false);
const favoritesLoading = ref(false);

export function useFavorites() {
  const authStore = useAuthStore();
  const api = useApi();
  const toast = useToast();
  const route = useRoute();

  const count = computed(() => favoriteIds.value.size);

  function isFavorite(productId: string) {
    return favoriteIds.value.has(productId);
  }

  async function fetchFavorites() {
    if (!authStore.isLoggedIn) {
      favoriteIds.value = new Set();
      favoritesLoaded.value = true;
      return [];
    }

    favoritesLoading.value = true;
    try {
      const { data } = await api.get<Product[]>('/favorites');
      favoriteIds.value = new Set(data.map((item) => item.id));
      favoritesLoaded.value = true;
      return data;
    } catch {
      favoriteIds.value = new Set();
      favoritesLoaded.value = true;
      return [];
    } finally {
      favoritesLoading.value = false;
    }
  }

  function promptLogin() {
    toast.info('برای افزودن به علاقه‌مندی‌ها وارد حساب شوید');
    navigateTo(`/auth/login?redirect=${encodeURIComponent(route.fullPath)}`);
  }

  async function addFavorite(productId: string) {
    if (!authStore.isLoggedIn) {
      promptLogin();
      return false;
    }

    try {
      await api.post('/favorites', { productId });
      favoriteIds.value = new Set([...favoriteIds.value, productId]);
      toast.success('به علاقه‌مندی‌ها اضافه شد');
      return true;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطا در افزودن به علاقه‌مندی‌ها');
      return false;
    }
  }

  async function removeFavorite(productId: string) {
    if (!authStore.isLoggedIn) return false;

    try {
      await api.delete(`/favorites/${productId}`);
      const next = new Set(favoriteIds.value);
      next.delete(productId);
      favoriteIds.value = next;
      toast.success('از علاقه‌مندی‌ها حذف شد');
      return true;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطا در حذف از علاقه‌مندی‌ها');
      return false;
    }
  }

  async function toggleFavorite(productId: string) {
    if (!authStore.isLoggedIn) {
      promptLogin();
      return;
    }

    if (isFavorite(productId)) {
      await removeFavorite(productId);
    } else {
      await addFavorite(productId);
    }
  }

  watch(
    () => authStore.isLoggedIn,
    async (loggedIn) => {
      favoritesLoaded.value = false;
      if (loggedIn) {
        await fetchFavorites();
      } else {
        favoriteIds.value = new Set();
        favoritesLoaded.value = true;
      }
    }
  );

  return {
    favoriteIds: readonly(favoriteIds),
    count,
    favoritesLoaded: readonly(favoritesLoaded),
    favoritesLoading: readonly(favoritesLoading),
    isFavorite,
    fetchFavorites,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    promptLogin,
  };
}
