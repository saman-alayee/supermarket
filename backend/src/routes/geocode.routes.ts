import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, successResponse, validateQuery } from '../utils/errors';

const router = Router();

const reverseQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

function buildPersianAddress(data: Record<string, unknown>): string {
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

async function fetchNominatim(lat: number, lng: number) {
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
      'User-Agent': 'KIAA-KALA-Supermarket/1.0 (contact: daftar72331222@gmail.com)',
      Referer: 'http://localhost:3000',
    },
  });

  if (!response.ok) {
    throw new Error(`Nominatim HTTP ${response.status}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

router.get(
  '/reverse',
  validateQuery(reverseQuerySchema),
  asyncHandler(async (req, res) => {
    const { lat, lng } = (req as typeof req & { validatedQuery: z.infer<typeof reverseQuerySchema> }).validatedQuery;

    try {
      const data = await fetchNominatim(lat, lng);
      const address = buildPersianAddress(data) || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

      successResponse(res, {
        address,
        latitude: lat,
        longitude: lng,
        displayName: (data.display_name as string | undefined) || address,
      });
    } catch (error) {
      console.error('Geocode reverse failed:', error);
      successResponse(res, {
        address: `موقعیت انتخاب‌شده (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
        latitude: lat,
        longitude: lng,
        displayName: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        fallback: true,
      });
    }
  })
);

export default router;
