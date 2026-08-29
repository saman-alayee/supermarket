export default defineNuxtPlugin(() => {
  const { fetchFavorites } = useFavorites();
  void fetchFavorites();
});
