<script setup lang="ts">
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const props = withDefaults(
  defineProps<{
    latitude: number | null;
    longitude: number | null;
    readonly?: boolean;
    geocode?: boolean;
    height?: string;
    zoom?: number;
  }>(),
  {
    readonly: false,
    geocode: false,
    height: '320px',
    zoom: 18,
  }
);

const emit = defineEmits<{
  'update:latitude': [value: number | null];
  'update:longitude': [value: number | null];
  resolved: [address: string];
}>();

const { reverseGeocode } = useGeocoding();

const mapContainer = ref<HTMLElement | null>(null);
const locating = ref(false);
const resolving = ref(false);
const mapError = ref('');

const DEFAULT_CENTER: L.LatLngExpression = [35.6892, 51.3890];

let map: L.Map | null = null;
let marker: L.Marker | null = null;
let geocodeTimer: ReturnType<typeof setTimeout> | null = null;
let syncingFromProps = false;
let lastGeocodeKey = '';
let geocodeRequestId = 0;

function hasCoords(): boolean {
  return props.latitude != null && props.longitude != null;
}

function roundCoord(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
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
    if (requestId === geocodeRequestId) {
      resolving.value = false;
    }
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
  if (props.geocode) {
    scheduleResolve(roundedLat, roundedLng);
  }
}

function updateFromCenter() {
  if (!map || props.readonly) return;
  const center = map.getCenter();
  emitCoords(center.lat, center.lng);
}

function setLocation(lat: number, lng: number, moveMap = true) {
  if (!map) return;
  syncingFromProps = true;
  if (moveMap) {
    map.setView([lat, lng], Math.max(map.getZoom(), props.zoom), { animate: false });
  }
  if (props.readonly) {
    marker?.setLatLng([lat, lng]);
    emit('update:latitude', roundCoord(lat));
    emit('update:longitude', roundCoord(lng));
  } else {
    emitCoords(lat, lng);
  }
  syncingFromProps = false;
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

function initMap() {
  if (!mapContainer.value || map) return;

  map = L.map(mapContainer.value, {
    center: hasCoords() ? [props.latitude!, props.longitude!] : DEFAULT_CENTER,
    zoom: props.zoom,
    scrollWheelZoom: !props.readonly,
    dragging: true,
    zoomControl: !props.readonly,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 20,
  }).addTo(map);

  if (props.readonly && hasCoords()) {
    marker = L.marker([props.latitude!, props.longitude!]).addTo(map);
    return;
  }

  if (!props.readonly) {
    map.on('moveend', updateFromCenter);
    setTimeout(updateFromCenter, 400);
  }
}

function refreshFromProps() {
  if (!map || !hasCoords()) return;
  syncingFromProps = true;
  map.setView([props.latitude!, props.longitude!], Math.max(map.getZoom(), props.zoom), { animate: false });
  if (props.readonly) {
    if (!marker) marker = L.marker([props.latitude!, props.longitude!]).addTo(map);
    else marker.setLatLng([props.latitude!, props.longitude!]);
  }
  syncingFromProps = false;
}

function invalidateSize() {
  nextTick(() => {
    map?.invalidateSize();
    if (hasCoords()) {
      map?.setView([props.latitude!, props.longitude!], map?.getZoom() || props.zoom, { animate: false });
    }
  });
}

defineExpose({ invalidateSize });

watch(
  () => [props.latitude, props.longitude],
  () => refreshFromProps()
);

onMounted(() => {
  nextTick(() => {
    initMap();
    setTimeout(invalidateSize, 250);
  });
});

onUnmounted(() => {
  if (geocodeTimer) clearTimeout(geocodeTimer);
  map?.remove();
  map = null;
  marker = null;
});
</script>

<template>
  <div class="space-y-2">
    <div class="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-gray-100">
      <div ref="mapContainer" :style="{ height }" class="w-full z-0 touch-pan-y" />

      <div
        v-if="!readonly"
        class="pointer-events-none absolute inset-0 flex items-center justify-center z-[401]"
      >
        <div class="relative -mt-8">
          <AppIcon name="lucide:map-pin" size="lg" class="text-primary-600 drop-shadow-md" />
          <span class="absolute left-1/2 top-full mt-1 -translate-x-1/2 w-2 h-2 rounded-full bg-primary-600/30" />
        </div>
      </div>

      <div v-if="!readonly" class="absolute top-3 end-3 z-[402]">
        <button
          type="button"
          class="w-10 h-10 rounded-xl bg-white shadow-md border border-gray-100 flex items-center justify-center"
          :disabled="locating"
          @click="useCurrentLocation"
        >
          <AppIcon
            :name="locating ? 'lucide:loader-2' : 'lucide:crosshair'"
            size="sm"
            :class="locating ? 'animate-spin text-primary-600' : 'text-gray-700'"
          />
        </button>
      </div>

      <div
        v-if="resolving"
        class="absolute bottom-3 start-3 end-3 z-[402] bg-white/95 text-xs text-gray-600 px-3 py-2 rounded-lg shadow flex items-center gap-1.5"
      >
        <AppIcon name="lucide:loader-2" size="sm" class="animate-spin text-primary-600" />
        در حال دریافت آدرس دقیق...
      </div>
    </div>

    <div v-if="!readonly" class="space-y-1">
      <p class="text-xs text-gray-500 leading-relaxed">
        {{ geocode ? 'نقشه را جابه‌جا کنید تا پین دقیقاً روی محل تحویل قرار بگیرد.' : 'فقط موقعیت GPS برای پیک مشخص می‌شود؛ آدرس را خودتان در فرم وارد کنید.' }}
      </p>
      <p v-if="hasCoords()" class="text-[11px] text-gray-400" dir="ltr">
        {{ latitude?.toFixed(6) }}, {{ longitude?.toFixed(6) }}
      </p>
    </div>

    <p v-if="mapError" class="text-xs text-amber-600">{{ mapError }}</p>
  </div>
</template>

<style scoped>
:deep(.leaflet-container) {
  font-family: inherit;
}
</style>
