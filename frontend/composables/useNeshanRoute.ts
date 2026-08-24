import polyline from '@mapbox/polyline';
import type { Map as LeafletMap, LayerGroup, Polyline } from 'leaflet';

export interface NeshanDirectionStep {
  polyline: string;
  start_location: [number, number];
}

export interface NeshanDirectionRoute {
  routes?: Array<{
    legs?: Array<{
      steps?: NeshanDirectionStep[];
    }>;
  }>;
}

export interface RouteDrawOptions {
  lineColor?: string;
  lineWeight?: number;
  showStepMarkers?: boolean;
}

const DEFAULT_ORIGIN = { lat: 37.419493, lng: 49.946101 };

export async function fetchNeshanDirection(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  apiKey: string
): Promise<NeshanDirectionRoute> {
  try {
    const api = useApi();
    const params = new URLSearchParams({
      originLat: String(origin.lat),
      originLng: String(origin.lng),
      destLat: String(destination.lat),
      destLng: String(destination.lng),
      type: 'car',
    });
    const { data } = await api.get<NeshanDirectionRoute>(`/geocode/direction?${params.toString()}`);
    if (data?.routes?.length) return data;
  } catch {
    // fall through to direct API call
  }

  const params = new URLSearchParams({
    type: 'car',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    alternative: 'false',
  });

  const response = await fetch(`https://api.neshan.org/v4/direction?${params.toString()}`, {
    headers: {
      'Api-Key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Neshan direction HTTP ${response.status}`);
  }

  return (await response.json()) as NeshanDirectionRoute;
}

export function drawNeshanRouteOnMap(
  map: LeafletMap,
  direction: NeshanDirectionRoute,
  L: typeof import('leaflet'),
  options: RouteDrawOptions = {}
): LayerGroup {
  const {
    lineColor = '#250ECD',
    lineWeight = 8,
    showStepMarkers = false,
  } = options;

  const group = L.layerGroup().addTo(map);

  for (const route of direction.routes ?? []) {
    for (const leg of route.legs ?? []) {
      for (const step of leg.steps ?? []) {
        if (!step.polyline) continue;

        const decoded = polyline.decode(step.polyline);
        L.polyline(decoded, {
          color: lineColor,
          weight: lineWeight,
        }).addTo(group);

        if (showStepMarkers && step.start_location?.length === 2) {
          const [lng, lat] = step.start_location;
          L.circleMarker([lat, lng], {
            weight: 1,
            color: '#FFFFFF',
            radius: 4,
            fill: true,
            fillColor: '#9fbef9',
            fillOpacity: 1,
          }).addTo(group);
        }
      }
    }
  }

  return group;
}

export function fitMapToRoute(map: LeafletMap, layerGroup: LayerGroup) {
  const layers = layerGroup.getLayers() as Polyline[];
  if (!layers.length) return;

  const bounds = layers[0]!.getBounds();
  for (let i = 1; i < layers.length; i += 1) {
    bounds.extend(layers[i]!.getBounds());
  }
  map.fitBounds(bounds, { padding: [24, 24] });
}

export function useNeshanRoute() {
  return {
    DEFAULT_ORIGIN,
    fetchNeshanDirection,
    drawNeshanRouteOnMap,
    fitMapToRoute,
  };
}
