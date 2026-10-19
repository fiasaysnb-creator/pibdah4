import React, { lazy, Suspense } from 'react';
import {
    AddOn,
    Card,
    Client,
    ClientFeedback,
    Contract,
    FinancialPocket,
    Lead,
    NavigationAction,
    Notification,
    Package,
    Profile,
    Project,
    PromoCode,
    TeamProjectPayment,
    TeamPaymentRecord,
    TeamMember,
    Transaction,
    ViewType,
} from '../../types';

const Clients = lazy(() => import('../clients/ClientsPage'));

interface DataPengantinHubProps {
    activeView: ViewType;
    handleNavigation: (view: ViewType, action?: NavigationAction, notificationId?: string) => void;
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    projects: Project[];
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
    teamProjectPayments: TeamProjectPayment[];
    setTeamProjectPayments: React.Dispatch<React.SetStateAction<TeamProjectPayment[]>>;
    teamPaymentRecords?: TeamPaymentRecord[];
    leads: Lead[];
    teamMembers: TeamMember[];
    transactions: Transaction[];
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    packages: Package[];
    setPackages: React.Dispatch<React.SetStateAction<Package[]>>;
    addOns: AddOn[];
    setAddOns: React.Dispatch<React.SetStateAction<AddOn[]>>;
    clientFeedback: ClientFeedback[];
    setClientFeedback: React.Dispatch<React.SetStateAction<ClientFeedback[]>>;
    profile: Profile;
    showNotification: (message: string, duration?: number) => void;
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => Promise<void>;
    cards: Card[];
    setCards: React.Dispatch<React.SetStateAction<Card[]>>;
    pockets: FinancialPocket[];
    setPockets: React.Dispatch<React.SetStateAction<FinancialPocket[]>>;
    promoCodes: PromoCode[];
    setPromoCodes: React.Dispatch<React.SetStateAction<PromoCode[]>>;
    contracts: Contract[];
    setContracts: React.Dispatch<React.SetStateAction<Contract[]>>;
    appData: any;
    initialAction: NavigationAction | null;
    setInitialAction: React.Dispatch<React.SetStateAction<NavigationAction | null>>;
    onSignInvoice: (projectId: string, sig: string) => void;
    onSignTransaction: (transactionId: string, sig: string) => void;
    onRecordPayment: (projectId: string, amount: number, destinationCardId: string) => Promise<void>;
}

export const DataPengantinHub: React.FC<DataPengantinHubProps> = (props) => {
    const totals = props.appData?.totals || {
        projects: 0,
        activeProjects: 0,
        clients: 0,
        activeClients: 0,
        leads: 0,
        discussionLeads: 0,
        followUpLeads: 0,
        teamMembers: 0,
        transactions: 0,
        revenue: 0,
        expense: 0,
    };

    return (
        <Suspense fallback={<div className="py-8 text-center text-sm text-[#5A6A85]">Memuat data...</div>}>
            <Clients
                {...props}
                userProfile={props.profile}
                totals={totals}
                handleNavigation={props.handleNavigation}
            />
        </Suspense>
    );
};
