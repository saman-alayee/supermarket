export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore();
  authStore.init();

  if (!authStore.isLoggedIn) {
    return navigateTo(`/auth/login?redirect=${encodeURIComponent(to.fullPath)}`);
  }

  if (!authStore.isAdmin) {
    return navigateTo(
      `/auth/login?redirect=${encodeURIComponent(to.fullPath)}&error=not-admin`
    );
  }
});
