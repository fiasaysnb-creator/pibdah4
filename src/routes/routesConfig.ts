import { ViewType } from "../types";

export const LAST_ROUTE_STORAGE_KEY = "weddfin-lastRoute";

export const ROUTE_PATH_MAP: Partial<Record<ViewType, string>> = {
  [ViewType.HOMEPAGE]: "home",
  [ViewType.DASHBOARD]: "dashboard",
  [ViewType["Calon Pengantin"]]: "prospek",
  [ViewType.BOOKING]: "booking",
  [ViewType.CLIENTS]: "clients",
  [ViewType.TEAM]: "team",
  [ViewType.FINANCE]: "finance",
  [ViewType.CALENDAR]: "calendar",
  [ViewType.PACKAGES]: "packages",
  [ViewType.PROMO_CODES]: "promo-codes",
  [ViewType.CLIENT_REPORTS]: "client-reports",
  [ViewType.SETTINGS]: "settings",
  [ViewType.VENDOR_PROFILE]: "vendor-profile",
  [ViewType.BIO_LINKS]: "bio-links",
  [ViewType.INVOICES]: "invoices",
};

export const ROUTE_TO_VIEW_MAP: Record<string, ViewType> = {
  home: ViewType.HOMEPAGE,
  dashboard: ViewType.DASHBOARD,
  "calon pengantin": ViewType["Calon Pengantin"],
  prospek: ViewType["Calon Pengantin"],
  booking: ViewType.BOOKING,
  clients: ViewType.CLIENTS,
  "manajemen klien": ViewType.CLIENTS,
  "manajemen-pengantin": ViewType.CLIENTS,
  proyek: ViewType.CLIENTS,
  acara: ViewType.CLIENTS,
  projects: ViewType.CLIENTS,
  team: ViewType.TEAM,
  finance: ViewType.FINANCE,
  calendar: ViewType.CALENDAR,
  packages: ViewType.PACKAGES,
  "promo-codes": ViewType.PROMO_CODES,
  gallery: ViewType.GALLERY,
  "client-reports": ViewType.CLIENT_REPORTS,
  "laporan klien": ViewType.CLIENT_REPORTS,
  "laporan-pengantin": ViewType.CLIENT_REPORTS,
  settings: ViewType.SETTINGS,
  "vendor-profile": ViewType.VENDOR_PROFILE,
  "bio-links": ViewType.BIO_LINKS,
  invoices: ViewType.INVOICES,
};

export const resolveViewFromPath = (path: string): ViewType => {
  const normalizedPath = path.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ROUTE_TO_VIEW_MAP, normalizedPath)) {
    return ROUTE_TO_VIEW_MAP[normalizedPath];
  }

  const matchedView = Object.values(ViewType).find(
    (v) => v.toLowerCase() === normalizedPath || v.toLowerCase().replace(/ /g, "-") === normalizedPath,
  );

  if (matchedView) {
    return matchedView;
  }

  if (normalizedPath === "team") {
    return ViewType.TEAM;
  }

  return ViewType.HOMEPAGE;
};
