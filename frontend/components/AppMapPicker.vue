<script setup lang="ts">
import type { Map as LeafletMap, Marker, LayerGroup } from 'leaflet';
import { loadNeshanLeaflet, NESHAN_OSM_FALLBACK } from '~/composables/useNeshanLeaflet';

const props = withDefaults(
  defineProps<{
    latitude: number | null;
    longitude: number | null;
    readonly?: boolean;
    geocode?: boolean;
    height?: string;
    zoom?: number;
    showRoute?: boolean;
    routeOriginLat?: number;
    routeOriginLng?: number;
  }>(),
  {
    readonly: false,
    geocode: false,
    height: '320px',
    zoom: 16,
    showRoute: false,
  }
);

const emit = defineEmits<{
  'update:latitude': [value: number | null];
  'update:longitude': [value: number | null];
  resolved: [address: string];
}>();

const config = useRuntimeConfig();
const { reverseGeocode, neshanRoutingLink } = useGeocoding();
const { DEFAULT_ORIGIN, fetchNeshanDirection, drawNeshanRouteOnMap, fitMapToRoute } = useNeshanRoute();

const mapId = `neshan-map-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
const mapContainer = ref<HTMLElement | null>(null);
const locating = ref(false);
const resolving = ref(false);
const mapLoading = ref(true);
const mapError = ref('');

const KIASHAHR = { lat: 37.419493, lng: 49.946101 };

let L: typeof import('leaflet') | null = null;
let map: LeafletMap | null = null;
let marker: Marker | null = null;
let routeLayer: LayerGroup | null = null;
let geocodeTimer: ReturnType<typeof setTimeout> | null = null;
let resizeObserver: ResizeObserver | null = null;
let syncingFromProps = false;
let lastGeocodeKey = '';
let geocodeRequestId = 0;
let fallbackApplied = false;

const neshanKey = computed(() => String(config.public.neshanApiKey || '').trim());

function hasCoords(): boolean {
  return props.latitude != null && Number.isFinite(props.latitude)
    && props.longitude != null && Number.isFinite(props.longitude);
}

function routeOrigin() {
  return {
    lat: props.routeOriginLat ?? DEFAULT_ORIGIN.lat,
    lng: props.routeOriginLng ?? DEFAULT_ORIGIN.lng,
  };
}

function roundCoord(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function setupMarkerIcon(leaflet: typeof import('leaflet')) {
  const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
  const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
  const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
  const DefaultIcon = leaflet.icon({
    iconUrl,
    iconRetinaUrl,
    shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
  leaflet.Marker.prototype.options.icon = DefaultIcon;
}

function getStartCoords(): { lat: number; lng: number } {
  if (hasCoords()) {
    const lat = props.latitude!;
    const lng = props.longitude!;
    if (props.readonly) return { lat, lng };
    return clampToDeliveryArea(lat, lng);
  }
  return { ...KIASHAHR };
}

function clampToDeliveryArea(lat: number, lng: number): { lat: number; lng: number } {
  if (!L) return { lat, lng };
  const bounds = L.latLngBounds([37.32, 49.82], [37.53, 50.1]);
  const point = L.latLng(lat, lng);
  if (bounds.contains(point)) return { lat, lng };
  const center = bounds.pad(-0.15).getCenter();
  return { lat: center.lat, lng: center.lng };
}

function applyOsmFallback() {
  if (!map || fallbackApplied) return;
  const mapWithType = map as LeafletMap & { setMapType?: (type: string) => void };
  if (typeof mapWithType.setMapType === 'function') {
    mapWithType.setMapType(NESHAN_OSM_FALLBACK);
    fallbackApplied = true;
  }
}

function ensureTilesVisible() {
  setTimeout(() => {
    const root = document.getElementById(mapId);
    const hasTile = root?.querySelector('.leaflet-tile-loaded');
    if (!hasTile) {
      applyOsmFallback();
      if (!fallbackApplied) {
        mapError.value = 'نقشه نشان بارگذاری نشد. کلید «نقشه وب» را در پنل نشان بررسی کنید.';
      }
    }
  }, 3500);
}

async function resolveAddress(lat: number, lng: number) {
  if (props.readonly) return;

  const key = `${roundCoord(lat)},${roundCoord(lng)}`;
  if (key === lastGeocodeKey) return;

  const requestId = ++geocodeRequestId;
  resolving.value = true;
  mapError.value = '';

  try {
    const address = await reverseGeocode(lat, lng);
    if (requestId !== geocodeRequestId) return;
    lastGeocodeKey = key;
    emit('resolved', address);
  } catch {
    if (requestId !== geocodeRequestId) return;
    lastGeocodeKey = key;
    emit('resolved', `موقعیت: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
  } finally {
    if (requestId === geocodeRequestId) resolving.value = false;
  }
}

function scheduleResolve(lat: number, lng: number) {
  if (props.readonly || syncingFromProps || !props.geocode) return;
  if (geocodeTimer) clearTimeout(geocodeTimer);
  geocodeTimer = setTimeout(() => resolveAddress(lat, lng), 900);
}

function emitCoords(lat: number, lng: number) {
  const roundedLat = roundCoord(lat);
  const roundedLng = roundCoord(lng);
  emit('update:latitude', roundedLat);
  emit('update:longitude', roundedLng);
  if (props.geocode) scheduleResolve(roundedLat, roundedLng);
}

function updateFromCenter() {
  if (!map || props.readonly || syncingFromProps) return;
  const center = map.getCenter();
  emitCoords(center.lat, center.lng);
}

function clearRouteLayer() {
  if (!routeLayer || !map) return;
  map.removeLayer(routeLayer);
  routeLayer = null;
}

async function loadRoute() {
  if (!map || !L || !props.showRoute || !hasCoords()) return;

  const apiKey = neshanKey.value;
  if (!apiKey) {
    mapError.value = 'کلید API نشان تنظیم نشده است.';
    return;
  }

  clearRouteLayer();

  try {
    const direction = await fetchNeshanDirection(
      routeOrigin(),
      { lat: props.latitude!, lng: props.longitude! },
      apiKey
    );
    routeLayer = drawNeshanRouteOnMap(map, direction, L);
    fitMapToRoute(map, routeLayer);
  } catch {
    mapError.value = 'نمایش مسیر روی نقشه ممکن نشد.';
  }
}

function setLocation(lat: number, lng: number, moveMap = true) {
  if (!map || !L) return;
  const target = props.readonly ? { lat, lng } : clampToDeliveryArea(lat, lng);

  if (!props.readonly && L) {
    const bounds = L.latLngBounds([37.32, 49.82], [37.53, 50.1]);
    if (!bounds.contains(L.latLng(lat, lng))) {
      mapError.value = 'موقعیت خارج از محدوده کیاشهر است. نقشه روی کیاشهر تنظیم شد.';
    }
  }

  syncingFromProps = true;
  if (moveMap) {
    map.setView([target.lat, target.lng], map.getZoom() || props.zoom, { animate: false });
  }
  if (props.readonly) {
    marker?.setLatLng([target.lat, target.lng]);
  }
  emitCoords(target.lat, target.lng);
  nextTick(() => {
    syncingFromProps = false;
  });
}

function useCurrentLocation() {
  if (props.readonly || !navigator.geolocation) {
    mapError.value = 'مرورگر از موقعیت مکانی پشتیبانی نمی‌کند';
    return;
  }

  locating.value = true;
  mapError.value = '';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      setLocation(position.coords.latitude, position.coords.longitude);
      locating.value = false;
    },
    () => {
      mapError.value = 'دسترسی به موقعیت مکانی رد شد';
      locating.value = false;
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

async function initMap() {
  if (map || !mapContainer.value) return;

  mapLoading.value = true;
  mapError.value = '';

  try {
    L = await loadNeshanLeaflet();
    if (!L) {
      mapError.value = 'بارگذاری کتابخانه نقشه ممکن نشد.';
      return;
    }

    setupMarkerIcon(L);

    const apiKey = neshanKey.value;
    if (!apiKey) {
      mapError.value = 'کلید API نقشه نشان تنظیم نشده است.';
    }

    const start = getStartCoords();
    const bounds = L.latLngBounds([37.32, 49.82], [37.53, 50.1]);

    map = new L.Map(mapId, {
      key: apiKey || ' ',
      maptype: 'dreamy',
      center: [start.lat, start.lng],
      zoom: props.zoom,
      minZoom: 12,
      maxZoom: 19,
      scrollWheelZoom: !props.readonly,
      dragging: !props.readonly,
      zoomControl: !props.readonly,
      attributionControl: true,
      maxBounds: props.readonly ? undefined : bounds.pad(0.15),
      maxBoundsViscosity: props.readonly ? 0 : 0.7,
    });

    if (props.readonly && hasCoords()) {
      marker = L.marker([start.lat, start.lng]).addTo(map);
    }

    map.whenReady(() => {
      invalidateSize();
      ensureTilesVisible();

      if (!props.readonly) {
        updateFromCenter();
      } else if (props.showRoute) {
        loadRoute();
      }
    });

    if (!props.readonly) {
      map.on('moveend', updateFromCenter);
    }

    if (mapContainer.value && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => invalidateSize());
      resizeObserver.observe(mapContainer.value);
    }
  } catch {
    mapError.value = 'خطا در ایجاد نقشه.';
  } finally {
    mapLoading.value = false;
  }
}

function refreshFromProps() {
  if (!map || !L || !hasCoords() || syncingFromProps) return;

  const next = { lat: props.latitude!, lng: props.longitude! };
  const current = map.getCenter();
  if (map.distance(current, L.latLng(next.lat, next.lng)) < 12) return;

  syncingFromProps = true;
  if (!props.showRoute) {
    map.panTo([next.lat, next.lng], { animate: false });
  }
  if (props.readonly) {
    if (!marker) marker = L.marker([next.lat, next.lng]).addTo(map);
    else marker.setLatLng([next.lat, next.lng]);
  }
  if (props.showRoute) loadRoute();
  nextTick(() => {
    syncingFromProps = false;
  });
}

function invalidateSize() {
  nextTick(() => {
    map?.invalidateSize({ animate: false });
  });
}

defineExpose({ invalidateSize });

watch(() => [props.latitude, props.longitude], () => refreshFromProps());
watch(
  () => props.showRoute,
  () => {
    if (props.showRoute) loadRoute();
    else clearRouteLayer();
  }
);

onMounted(() => {
  nextTick(() => {
    initMap();
    setTimeout(invalidateSize, 250);
    setTimeout(invalidateSize, 800);
  });
});

onUnmounted(() => {
  if (geocodeTimer) clearTimeout(geocodeTimer);
  resizeObserver?.disconnect();
  resizeObserver = null;
  clearRouteLayer();
  map?.remove();
  map = null;
  marker = null;
  L = null;
});
</script>

<template>
  <div class="space-y-2">
    <div class="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-sm" dir="ltr">
      <div :id="mapId" ref="mapContainer" :style="{ height }" class="relative z-0 w-full min-h-[180px]" />

      <div
        v-if="mapLoading"
        class="absolute inset-0 z-[400] flex items-center justify-center bg-gray-100/90 text-xs text-gray-500"
      >
        <AppIcon name="lucide:loader-2" size="sm" class="animate-spin text-primary-600" />
        <span class="ms-2">در حال بارگذاری نقشه...</span>
      </div>

      <div
        v-if="!readonly && !mapLoading"
        class="pointer-events-none absolute inset-0 z-[401] flex items-center justify-center"
      >
        <div class="relative -mt-8">
          <AppIcon name="lucide:map-pin" size="lg" class="text-primary-600 drop-shadow-md" />
          <span class="absolute left-1/2 top-full mt-1 h-2 w-2 -translate-x-1/2 rounded-full bg-primary-600/30" />
        </div>
      </div>

      <div v-if="!readonly && !mapLoading" class="absolute top-3 end-3 z-[402] flex flex-col items-end gap-1.5">
        <button
          type="button"
          class="flex items-center gap-2 rounded-xl border border-primary-100 bg-white px-3 py-2 shadow-md text-xs font-semibold text-primary-700 hover:bg-primary-50 transition-colors"
          :disabled="locating"
          title="موقعیت فعلی من را روی نقشه ثبت کن"
          aria-label="ثبت موقعیت فعلی من روی نقشه"
          @click="useCurrentLocation"
        >
          <AppIcon
            :name="locating ? 'lucide:loader-2' : 'lucide:crosshair'"
            size="sm"
            :class="locating ? 'animate-spin text-primary-600' : 'text-primary-600'"
          />
          <span>{{ locating ? 'در حال یافتن...' : 'موقعیت من' }}</span>
        </button>
        <span class="max-w-[9.5rem] rounded-lg bg-white/95 px-2 py-1 text-[10px] leading-snug text-gray-600 shadow-sm text-end">
          برای ثبت خودکار لوکیشن روی این دکمه بزنید
        </span>
      </div>

      <div
        v-if="resolving"
        class="absolute bottom-3 start-3 end-3 z-[402] flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-xs text-gray-600 shadow"
      >
        <AppIcon name="lucide:loader-2" size="sm" class="animate-spin text-primary-600" />
        در حال دریافت آدرس دقیق...
      </div>
    </div>

    <div v-if="!readonly" class="space-y-1">
      <p class="text-xs leading-relaxed text-gray-500">
        {{ geocode ? 'نقشه را جابه‌جا کنید تا پین دقیقاً روی محل تحویل قرار بگیرد.' : 'نقشه را روی محل تحویل در کیاشهر بگذارید؛ آدرس را در فرم وارد کنید.' }}
      </p>
      <p class="text-xs leading-relaxed text-primary-700 bg-primary-50/70 rounded-lg px-2.5 py-2">
        دکمه «موقعیت من» (آیکن نشانه) برای ثبت خودکار محل فعلی شما روی نقشه است. اگر دسترسی موقعیت رد شد، نقشه را با دست جابه‌جا کنید.
      </p>
      <p v-if="hasCoords()" class="text-[11px] text-gray-400" dir="ltr">
        {{ latitude?.toFixed(6) }}, {{ longitude?.toFixed(6) }}
      </p>
      <a
        v-if="hasCoords()"
        :href="neshanRoutingLink(latitude!, longitude!)"
        target="_blank"
        rel="noopener"
        class="inline-flex items-center gap-1 text-xs font-medium text-primary-600"
      >
        <AppIcon name="lucide:navigation" size="sm" />
        مسیریابی با نشان
      </a>
    </div>

    <p v-if="mapError" class="text-xs text-amber-600">{{ mapError }}</p>
  </div>
</template>

<style scoped>
:deep(.leaflet-container) {
  font-family: inherit;
  direction: ltr;
  background: #e8eef3;
  height: 100%;
  width: 100%;
}
:deep(.leaflet-control-zoom) {
  border: 0 !important;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.16);
}
</style>
