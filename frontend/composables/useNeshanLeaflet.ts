const NESHAN_CSS = 'https://static.neshan.org/sdk/leaflet/v1.9.4/neshan-sdk/v1.0.8/index.css';
const NESHAN_JS = 'https://static.neshan.org/sdk/leaflet/v1.9.4/neshan-sdk/v1.0.8/index.js';
export const NESHAN_OSM_FALLBACK = 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png';

type NeshanLeaflet = typeof import('leaflet');

let sdkPromise: Promise<NeshanLeaflet | null> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function loadStylesheet(href: string) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

export async function loadNeshanLeaflet(): Promise<NeshanLeaflet | null> {
  if (!import.meta.client) return null;

  const existing = (window as typeof window & { L?: NeshanLeaflet }).L;
  if (existing?.Map) return existing;

  if (!sdkPromise) {
    sdkPromise = (async () => {
      try {
        loadStylesheet(NESHAN_CSS);
        await loadScript(NESHAN_JS);
        const L = (window as typeof window & { L?: NeshanLeaflet }).L;
        return L?.Map ? L : null;
      } catch {
        try {
          const mod = await import('@neshan-maps-platform/leaflet');
          await import('@neshan-maps-platform/leaflet/dist/leaflet.css');
          return mod.default as NeshanLeaflet;
        } catch {
          return null;
        }
      }
    })();
  }

  return sdkPromise;
}

export function useNeshanLeaflet() {
  return { loadNeshanLeaflet, NESHAN_OSM_FALLBACK };
}
