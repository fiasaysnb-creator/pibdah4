import React, { Suspense } from "react";
import { lazyWithRetry as lazy } from "./lazyWithRetry";
import {
  Client,
  Project,
  TeamMember,
  Transaction,
  Profile,
  Lead,
  Card,
  ClientFeedback,
  Notification,
  PromoCode,
  Package,
  AddOn,
  TeamProjectPayment,
  TeamPaymentRecord,
  User,
  ViewType,
} from "../types";
import { markSubStatusConfirmed } from "../services/projectSubStatusConfirmations";
import { LAST_ROUTE_STORAGE_KEY, ROUTE_PATH_MAP, ROUTE_TO_VIEW_MAP } from "./routesConfig";

// Lightweight/core components
import Homepage from "../pages/home/Homepage";
import Login from "../pages/auth/LoginPage";

// Lazy-loaded public route components
const VendorPublicProfile = lazy(() => import("../pages/public/VendorPublicProfile"));
const BioLinkPage = lazy(() => import("../pages/public/BioLinkPage"));
const PortfolioDetailPage = lazy(() => import("../pages/public/PortfolioDetailPage"));
const PublicPackages = lazy(() => import("../features/public/components/PublicPackages"));
const PublicBookingForm = lazy(() => import("../features/public/components/PublicBookingForm"));
const PublicLeadForm = lazy(() => import("../features/public/components/PublicLeadForm"));
const PublicFeedbackForm = lazy(() => import("../features/public/components/PublicFeedbackForm"));
const SuggestionForm = lazy(() => import("../features/public/components/SuggestionForm"));
const PublicGallery = lazy(() => import("../features/public/components/PublicGallery"));
const PublicRouter = lazy(() => import("../features/public/components/PublicRouter"));
const PublicInvoice = lazy(() => import("../features/public/components/PublicInvoice"));
const PublicReceipt = lazy(() => import("../features/public/components/PublicReceipt"));
const ClientPortal = lazy(() => import("../features/clients/components/ClientPortal"));
const FreelancerPortal = lazy(() => import("../features/team/components/FreelancerPortal"));

/**
 * Route yang sudah dipakai halaman lain sehingga tidak boleh diperlakukan
 * sebagai slug Link Publik di root (contoh: /dashboard, /bio-links, /login).
 */
const RESERVED_ROOT_SLUGS = new Set<string>([
  ...Object.keys(ROUTE_TO_VIEW_MAP),
  ...Object.values(ROUTE_PATH_MAP).filter((value): value is string => Boolean(value)),
  ...Object.values(ViewType).flatMap(value => [value.toLowerCase(), value.toLowerCase().replace(/\s+/g, "-")]),
  "link",
  "public",
  "share",
  "portal",
  "gallery",
  "invoice",
  "receipt",
  "feedback",
  "suggestion-form",
  "test-signature",
  "public-booking",
  "public-packages",
  "public-lead-form",
  "freelancer-portal",
  "form-prospek",
]);

/**
 * Mendukung link publik singkat di root, contoh: /#/link-bisnis
 * (sebelumnya harus /#/link/link-bisnis).
 */
export function resolveBioLinkSlugFromRoot(route: string): string | null {
  const r = route.startsWith("#") ? route.slice(1) : route;
  const path = r.split(/[?#]/)[0];
  const segments = path.split("/").filter(Boolean);
  if (segments.length !== 1) return null;

  const slug = decodeURIComponent(segments[0]).trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  return RESERVED_ROOT_SLUGS.has(slug) ? null : slug;
}

export function isPublicRoutePath(route: string): boolean {
  // route sudah di-slice sehingga tidak ada '#' di depan (contoh: '/public-booking?...')
  // Juga tangani kasus jika route masih punya '#' di depan
  const r = route.startsWith("#") ? route.slice(1) : route;
  return (
    resolveBioLinkSlugFromRoot(r) !== null ||
    r.startsWith("/home") ||
    r === "/" ||
    r === "" ||
    r.startsWith("/login") ||
    r.startsWith("/profile") ||
    r === "/link" ||
    r.startsWith("/link/") ||
    r.startsWith("/portfolio/") ||
    r.startsWith("/public-packages") ||
    r.startsWith("/public-booking") ||
    r.startsWith("/public-lead-form") ||
    r.startsWith("/feedback") ||
    r.startsWith("/suggestion-form") ||
    r.startsWith("/gallery/") ||
    r.startsWith("/public/") ||
    r.startsWith("/portal/invoice/") ||
    r.startsWith("/invoice/") ||
    r.startsWith("/portal/receipt/") ||
    r.startsWith("/receipt/") ||
    r.startsWith("/portal/") ||
    r.startsWith("/freelancer-portal/")
  );
}

export interface PublicRoutesProps {
  route: string;
  isAuthenticated: boolean;
  users: User[];
  handleLoginSuccess: (user: User) => void;
  profile: Profile;
  showNotification: (msg: string, duration?: number) => void;
  addNotification: (
    newNotificationData: Omit<Notification, "id" | "timestamp" | "isRead">,
  ) => Promise<void>;
  clients: Client[];
  projects: Project[];
  teamMembers: TeamMember[];
  transactions: Transaction[];
  cards: Card[];
  leads: Lead[];
  pockets: any[];
  promoCodes: PromoCode[];
  packages: Package[];
  addOns: AddOn[];
  clientFeedback: ClientFeedback[];
  notifications: Notification[];
  teamProjectPayments: TeamProjectPayment[];
  teamPaymentRecords: TeamPaymentRecord[];
  // Setters untuk halaman publik
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  setPockets: React.Dispatch<React.SetStateAction<any[]>>;
  setPromoCodes: React.Dispatch<React.SetStateAction<PromoCode[]>>;
  setClientFeedback: React.Dispatch<React.SetStateAction<ClientFeedback[]>>;
}

export const PublicRoutes: React.FC<PublicRoutesProps> = ({
  route,
  isAuthenticated,
  users,
  handleLoginSuccess,
  profile,
  showNotification,
  addNotification,
  clients,
  projects,
  teamMembers,
  transactions,
  cards,
  leads,
  pockets,
  promoCodes,
  packages,
  addOns,
  clientFeedback,
  notifications,
  teamProjectPayments,
  teamPaymentRecords,
  setClients,
  setProjects,
  setTransactions,
  setCards,
  setLeads,
  setPockets,
  setPromoCodes,
  setClientFeedback,
}) => {
  // Normalisasi: hapus '#' dari depan route jika ada
  const r = route.startsWith("#") ? route.slice(1) : route;

  if (r === "/" || r === "") {
    if (isAuthenticated) {
      try {
        const last = window.localStorage.getItem(LAST_ROUTE_STORAGE_KEY);
        if (
          last &&
          typeof last === "string" &&
          last.startsWith("#/") &&
          !last.startsWith("#/home") &&
          `#${r}` !== last
        ) {
          window.location.hash = last;
          return null;
        }
      } catch (e) {
        console.warn("[Routing] Failed to read last route from localStorage:", e);
      }

      window.location.hash = "#/dashboard";
      return null;
    }

    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent"></div>
          </div>
        }
      >
        <VendorPublicProfile />
      </Suspense>
    );
  }

  if (r.startsWith("/home")) {
    if (isAuthenticated) {
      window.location.hash = "#/dashboard";
      return null;
    }

    return <Homepage />;
  }

  if (r.startsWith("/login")) {
    return <Login onLoginSuccess={handleLoginSuccess} users={users} />;
  }

  if (r.startsWith("/profile")) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent"></div>
          </div>
        }
      >
        <VendorPublicProfile />
      </Suspense>
    );
  }

  if (r === "/link" || r.startsWith("/link/")) {
    const slug = r.startsWith("/link/") ? r.slice("/link/".length) : undefined;
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent"></div>
          </div>
        }
      >
        <BioLinkPage slug={slug} />
      </Suspense>
    );
  }

  const bioLinkSlugFromRoot = resolveBioLinkSlugFromRoot(r);
  if (bioLinkSlugFromRoot) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent"></div>
          </div>
        }
      >
        <BioLinkPage slug={bioLinkSlugFromRoot} />
      </Suspense>
    );
  }

  if (r.startsWith("/portfolio/")) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent"></div>
          </div>
        }
      >
        <PortfolioDetailPage />
      </Suspense>
    );
  }

  if (r.startsWith("/public-packages")) {
    return (
      <PublicPackages
        userProfile={profile}
        showNotification={showNotification}
        setClients={setClients}
        setProjects={setProjects}
        setTransactions={setTransactions}
        setCards={setCards}
        setLeads={setLeads}
        addNotification={addNotification}
        cards={cards}
        promoCodes={promoCodes}
        setPromoCodes={setPromoCodes}
        leads={leads}
      />
    );
  }

  if (r.startsWith("/public-booking")) {
    const allDataForForm = {
      clients,
      projects,
      teamMembers,
      transactions,
      teamProjectPayments,
      teamPaymentRecords,
      pockets,
      profile,
      leads,
      cards,
      clientFeedback,
      notifications,
      promoCodes,
      packages,
      addOns,
    };
    return (
      <PublicBookingForm
        {...allDataForForm}
        userProfile={profile}
        showNotification={showNotification}
        setClients={setClients}
        setProjects={setProjects}
        setTransactions={setTransactions}
        setCards={setCards}
        setPockets={setPockets}
        setPromoCodes={setPromoCodes}
        setLeads={setLeads}
        addNotification={addNotification}
      />
    );
  }

  if (r.startsWith("/public-lead-form")) {
    return (
      <PublicLeadForm
        setLeads={setLeads}
        userProfile={profile}
        showNotification={showNotification}
        addNotification={addNotification}
      />
    );
  }

  if (r.startsWith("/feedback")) {
    return <PublicFeedbackForm setClientFeedback={setClientFeedback} />;
  }

  if (r.startsWith("/suggestion-form")) {
    return <SuggestionForm setLeads={setLeads} />;
  }

  if (r.startsWith("/gallery/")) {
    const raw = r.split("/gallery/")[1] || "";
    const galleryId = decodeURIComponent((raw.split(/[?#]/)[0] || "").split("/")[0] || "").trim();
    return <PublicGallery galleryId={galleryId} />;
  }

  if (r.startsWith("/public/")) {
    const raw = r.slice("/public/".length);
    const slug = decodeURIComponent((raw.split(/[?#]/)[0] || "").split("/")[0] || "").trim();
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
            <div className="relative flex justify-center items-center mb-6">
              <div className="absolute border-4 border-indigo-200 rounded-full w-16 h-16"></div>
              <div className="animate-spin border-4 border-transparent border-t-indigo-600 rounded-full w-16 h-16"></div>
            </div>
            <p className="text-sm font-medium text-slate-600">Memuat halaman publik...</p>
          </div>
        }
      >
        <PublicRouter
          slug={slug}
          clients={clients}
          projects={projects}
          transactions={transactions}
          teamMembers={teamMembers}
          userProfile={profile}
          packages={packages}
          showNotification={showNotification}
          setClientFeedback={setClientFeedback}
          onClientSubStatusConfirmation={async (pId, sub, note) => {
            setProjects((prev) =>
              prev.map((p) =>
                p.id === pId
                  ? {
                      ...p,
                      confirmedSubStatuses: [...(p.confirmedSubStatuses || []), sub],
                      clientSubStatusNotes: {
                        ...(p.clientSubStatusNotes || {}),
                        [sub]: note,
                      },
                    }
                  : p,
              ),
            );
            try {
              await markSubStatusConfirmed(pId, sub, note);
            } catch (error) {
              console.warn("[Portal] Failed to persist sub-status confirmation:", error);
            }
          }}
          addNotification={addNotification}
        />
      </Suspense>
    );
  }

  if (r.startsWith("/portal/invoice/") || r.startsWith("/invoice/")) {
    const raw = r.startsWith("/portal/invoice/")
      ? r.split("/portal/invoice/")[1] || ""
      : r.split("/invoice/")[1] || "";
    const projectId = decodeURIComponent((raw.split(/[?#]/)[0] || "").split("/")[0] || "").trim();
    return (
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center py-20 min-h-screen">
            <div className="relative flex justify-center items-center">
              <div className="absolute border-4 border-brand-accent/20 rounded-full w-12 h-12"></div>
              <div className="animate-spin border-4 border-transparent border-t-brand-accent rounded-full w-12 h-12"></div>
            </div>
            <p className="mt-4 text-sm font-medium text-slate-600">Memuat Invoice...</p>
          </div>
        }
      >
        <PublicInvoice projectId={projectId} />
      </Suspense>
    );
  }

  if (r.startsWith("/portal/receipt/") || r.startsWith("/receipt/")) {
    const raw = r.startsWith("/portal/receipt/")
      ? r.split("/portal/receipt/")[1] || ""
      : r.split("/receipt/")[1] || "";
    const transactionId = decodeURIComponent((raw.split(/[?#]/)[0] || "").split("/")[0] || "").trim();
    return (
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center py-20 min-h-screen">
            <div className="relative flex justify-center items-center">
              <div className="absolute border-4 border-brand-accent/20 rounded-full w-12 h-12"></div>
              <div className="animate-spin border-4 border-transparent border-t-brand-accent rounded-full w-12 h-12"></div>
            </div>
            <p className="mt-4 text-sm font-medium text-slate-600">Memuat Kuitansi...</p>
          </div>
        }
      >
        <PublicReceipt transactionId={transactionId} />
      </Suspense>
    );
  }

  if (r.startsWith("/portal/")) {
    const raw = r.split("/portal/")[1] || "";
    const accessId = decodeURIComponent((raw.split(/[?#]/)[0] || "").split("/")[0] || "").trim();
    return (
      <ClientPortal
        key={accessId}
        accessId={accessId}
        clients={clients}
        projects={projects}
        setClientFeedback={setClientFeedback}
        showNotification={showNotification}
        transactions={transactions}
        userProfile={profile}
        packages={packages}
        teamMembers={teamMembers}
        onClientSubStatusConfirmation={async (pId, sub, note) => {
          setProjects((prev) =>
            prev.map((p) =>
              p.id === pId
                ? {
                    ...p,
                    confirmedSubStatuses: [...(p.confirmedSubStatuses || []), sub],
                    clientSubStatusNotes: {
                      ...(p.clientSubStatusNotes || {}),
                      [sub]: note,
                    },
                  }
                : p,
            ),
          );
          try {
            await markSubStatusConfirmed(pId, sub, note);
          } catch (e) {
            console.warn("[Portal] Failed to persist sub-status confirmation:", e);
          }
        }}
      />
    );
  }

  if (r.startsWith("/freelancer-portal/")) {
    const raw = r.split("/freelancer-portal/")[1] || "";
    const accessId = decodeURIComponent((raw.split(/[?#]/)[0] || "").split("/")[0] || "").trim();
    return (
      <FreelancerPortal
        key={accessId}
        accessId={accessId}
        teamMembers={teamMembers}
        clients={clients}
        projects={projects}
        teamProjectPayments={teamProjectPayments}
        teamPaymentRecords={teamPaymentRecords}
        showNotification={showNotification}
        userProfile={profile}
        addNotification={addNotification}
      />
    );
  }

  return null;
};

export default PublicRoutes;
