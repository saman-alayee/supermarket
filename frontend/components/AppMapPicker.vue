<script setup lang="ts">
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

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
    zoom: 16,
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

/** کیاشهر، گیلان */
const KIASHAHR_CENTER = L.latLng(37.4255, 49.953);
const KIASHAHR_BOUNDS = L.latLngBounds([37.32, 49.82], [37.53, 50.1]);

let map: L.Map | null = null;
let marker: L.Marker | null = null;
let geocodeTimer: ReturnType<typeof setTimeout> | null = null;
let resizeObserver: ResizeObserver | null = null;
let syncingFromProps = false;
let lastGeocodeKey = '';
let geocodeRequestId = 0;

function hasCoords(): boolean {
  return props.latitude != null && Number.isFinite(props.latitude)
    && props.longitude != null && Number.isFinite(props.longitude);
}

function roundCoord(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function addTiles(target: L.Map) {
  const sources = [
    {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      options: {
        subdomains: 'abcd',
        maxZoom: 19,
        maxNativeZoom: 19,
        attribution: '&copy; OpenStreetMap &copy; CARTO',
      },
    },
    {
      url: 'https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png',
      options: {
        maxZoom: 19,
        maxNativeZoom: 18,
        attribution: '&copy; OpenStreetMap',
      },
    },
    {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      options: {
        maxZoom: 19,
        maxNativeZoom: 19,
        attribution: '&copy; OpenStreetMap',
      },
    },
  ];

  let sourceIndex = 0;
  let layer: L.TileLayer | null = null;
  let errors = 0;

  const useSource = (index: number) => {
    const source = sources[index];
    if (!source) return;
    if (layer) target.removeLayer(layer);
    layer = L.tileLayer(source.url, source.options);
    layer.on('tileerror', () => {
      errors += 1;
      if (errors >= 6 && sourceIndex < sources.length - 1) {
        errors = 0;
        sourceIndex += 1;
        useSource(sourceIndex);
      }
    });
    layer.addTo(target);
  };

  useSource(0);
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
  if (!map || props.readonly || syncingFromProps) return;
  const center = map.getCenter();
  emitCoords(center.lat, center.lng);
}

function clampToDeliveryArea(lat: number, lng: number): L.LatLng {
  const point = L.latLng(lat, lng);
  if (KIASHAHR_BOUNDS.contains(point)) return point;
  return KIASHAHR_BOUNDS.pad(-0.15).getCenter();
}

function setLocation(lat: number, lng: number, moveMap = true) {
  if (!map) return;
  const target = props.readonly ? L.latLng(lat, lng) : clampToDeliveryArea(lat, lng);
  if (!props.readonly && !KIASHAHR_BOUNDS.contains(L.latLng(lat, lng))) {
    mapError.value = 'موقعیت خارج از محدوده کیاشهر است. نقشه روی کیاشهر تنظیم شد.';
  }

  syncingFromProps = true;
  if (moveMap) {
    map.setView(target, map.getZoom() || props.zoom, { animate: false });
  }
  if (props.readonly) {
    marker?.setLatLng(target);
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

function initMap() {
  if (!mapContainer.value || map) return;

  const start = hasCoords()
    ? (props.readonly ? L.latLng(props.latitude!, props.longitude!) : clampToDeliveryArea(props.latitude!, props.longitude!))
    : KIASHAHR_CENTER;

  map = L.map(mapContainer.value, {
    center: start,
    zoom: props.zoom,
    minZoom: 12,
    maxZoom: 19,
    scrollWheelZoom: !props.readonly,
    dragging: !props.readonly,
    zoomControl: !props.readonly,
    attributionControl: true,
    maxBounds: props.readonly ? undefined : KIASHAHR_BOUNDS.pad(0.15),
    maxBoundsViscosity: props.readonly ? 0 : 0.7,
  });

  addTiles(map);

  if (props.readonly && hasCoords()) {
    marker = L.marker(start).addTo(map);
  }

  if (!props.readonly) {
    map.on('moveend', updateFromCenter);
    map.whenReady(() => {
      updateFromCenter();
      invalidateSize();
    });
  }

  if (mapContainer.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => invalidateSize());
    resizeObserver.observe(mapContainer.value);
  }
}

function refreshFromProps() {
  if (!map || !hasCoords() || syncingFromProps) return;

  const next = L.latLng(props.latitude!, props.longitude!);
  const current = map.getCenter();
  if (map.distance(current, next) < 12) return;

  syncingFromProps = true;
  map.panTo(next, { animate: false });
  if (props.readonly) {
    if (!marker) marker = L.marker(next).addTo(map);
    else marker.setLatLng(next);
  }
  nextTick(() => {
    syncingFromProps = false;
  });
}

function invalidateSize() {
  nextTick(() => {
    if (!map) return;
    map.invalidateSize({ animate: false });
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
    setTimeout(invalidateSize, 200);
    setTimeout(invalidateSize, 700);
  });
});

onUnmounted(() => {
  if (geocodeTimer) clearTimeout(geocodeTimer);
  resizeObserver?.disconnect();
  resizeObserver = null;
  map?.remove();
  map = null;
  marker = null;
});
</script>

<template>
  <div class="space-y-2">
    <div class="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-gray-100" dir="ltr">
      <div ref="mapContainer" :style="{ height }" class="w-full z-0" />

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
        {{ geocode ? 'نقشه را جابه‌جا کنید تا پین دقیقاً روی محل تحویل قرار بگیرد.' : 'نقشه را روی محل تحویل در کیاشهر بگذارید؛ آدرس را در فرم وارد کنید.' }}
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
  direction: ltr;
  background: #e8eef3;
}
:deep(.leaflet-control-zoom) {
  border: 0 !important;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.16);
}
:deep(.leaflet-touch .leaflet-control-zoom) {
  margin-top: 12px;
  margin-left: 12px;
}
</style>
