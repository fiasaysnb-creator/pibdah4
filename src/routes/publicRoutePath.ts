/**
 * Halaman publik "ringan": hanya menampilkan katalog paket/formulir booking dan
 * membaca satu lead lewat `lid`. Kedua halaman ini tidak memakai dataset vendor
 * (clients, transactions, team, kalender, laporan, notifikasi), sehingga query
 * global tersebut tidak perlu dikirim untuk pengunjung anonim.
 *
 * Route publik lain (portal klien, invoice) tetap memakai
 * dataset global dan TIDAK boleh masuk daftar ini.
 */
import { ROUTE_PATH_MAP, ROUTE_TO_VIEW_MAP } from './routesConfig';
import { ViewType } from '../types';

const PUBLIC_FORM_DATA_PREFIXES = ["/public-packages", "/public-booking"];

// Halaman ini mengambil data yang dibutuhkan secara langsung atau hanya
// menampilkan konten statis. Hindari memuat seluruh dataset vendor di latar.
const STANDALONE_PUBLIC_PREFIXES = [
  "/home",
  "/login",
  "/profile",
  "/link",
  "/portfolio/",
  "/public-lead-form",
  "/feedback",
  "/suggestion-form",
  "/gallery/",
  "/portal/invoice/",
  "/invoice/",
  "/portal/receipt/",
  "/receipt/",
];

const RESERVED_ROOT_SLUGS = new Set([
  ...Object.keys(ROUTE_TO_VIEW_MAP),
  ...Object.values(ROUTE_PATH_MAP)
    .filter((value): value is string => Boolean(value))
    .map(value => value.toLowerCase().replace(/\s+/g, '-')),
  ...Object.values(ViewType).map(value => value.toLowerCase().replace(/\s+/g, '-')),
  'link', 'public', 'share', 'portal', 'gallery', 'invoice', 'receipt',
  'feedback', 'suggestion-form', 'test-signature', 'public-booking', 'public-packages',
  'public-lead-form', 'freelancer-portal',
]);

function isRootBioLinkSlugRoute(route: string): boolean {
  const segments = route.split(/[?#]/)[0].split('/').filter(Boolean);
  if (segments.length !== 1) return false;

  let slug = '';
  try {
    slug = decodeURIComponent(segments[0]).trim().toLowerCase();
  } catch {
    return false;
  }

  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !RESERVED_ROOT_SLUGS.has(slug);
}

export function isPublicFormDataRoute(route: string): boolean {
  const r = route.startsWith("#") ? route.slice(1) : route;
  return PUBLIC_FORM_DATA_PREFIXES.some(prefix => r.startsWith(prefix));
}

export function isPublicLeadFormRoute(route: string): boolean {
  const r = route.startsWith("#") ? route.slice(1) : route;
  return r.startsWith("/public-lead-form");
}

export function isLightweightPublicRoute(route: string): boolean {
  const r = route.startsWith("#") ? route.slice(1) : route;
  return (
    r === "/" ||
    r === "" ||
    isRootBioLinkSlugRoute(r) ||
    isPublicFormDataRoute(r) ||
    STANDALONE_PUBLIC_PREFIXES.some(prefix => r.startsWith(prefix))
  );
}

/** Route publik ringan saat ini, dibaca langsung dari location.hash. */
export function isLightweightPublicRouteNow(): boolean {
  if (typeof window === "undefined") return false;
  return isLightweightPublicRoute(window.location.hash || "/");
}

export function isPublicFormDataRouteNow(): boolean {
  if (typeof window === "undefined") return false;
  return isPublicFormDataRoute(window.location.hash || "/");
}

export function isPublicLeadFormRouteNow(): boolean {
  if (typeof window === "undefined") return false;
  return isPublicLeadFormRoute(window.location.hash || "/");
}
