function buildAddressFromNominatim(data: Record<string, unknown>): string {
  const displayName = (data.display_name as string | undefined)?.trim();
  const address = (data.address ?? {}) as Record<string, string | undefined>;

  const parts = [
    address.road || address.pedestrian || address.footway,
    address.neighbourhood || address.suburb || address.quarter,
    address.city || address.town || address.village || address.county,
    address.state,
  ].filter(Boolean);

  if (parts.length >= 2) return parts.join('، ');
  if (displayName) return displayName;
  if (parts.length === 1) return parts[0]!;
  return '';
}

async function fetchNominatimDirect(lat: number, lng: number): Promise<string> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(lat),
    lon: String(lng),
    'accept-language': 'fa,en',
    addressdetails: '1',
    zoom: '18',
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Nominatim request failed');
  }

  const data = (await response.json()) as Record<string, unknown>;
  const address = buildAddressFromNominatim(data);
  if (address) return address;

  const displayName = (data.display_name as string | undefined)?.trim();
  if (displayName) return displayName;

  throw new Error('Empty geocode result');
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const api = useApi();
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
    });
    const { data } = await api.get<{ address: string }>(`/geocode/reverse?${params.toString()}`);
    if (data.address) return data.address;
  } catch {
    // try direct fallback below
  }

  try {
    return await fetchNominatimDirect(lat, lng);
  } catch {
    return `موقعیت: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

export function mapsLink(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

export function useGeocoding() {
  return { reverseGeocode, mapsLink };
}
