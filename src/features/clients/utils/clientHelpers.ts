import { PaymentStatus, ClientType } from '../../../types';

export const formatCurrency = (amount: number) => {
    // Ensure proper Indonesian currency formatting with correct decimal separator
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

export const normalizeTerminology = (text: string): string => {
    if (!text) return text;
    return text
        .replace(/Proyek/g, 'Acara Pernikahan')
        .replace(/DP Proyek/g, 'DP Acara Pernikahan')
        .replace(/Pelunasan Proyek/g, 'Pelunasan Acara Pernikahan')
        .replace(/Pembayaran Proyek/g, 'Pembayaran Acara Pernikahan');
};

export const getPaymentStatusClass = (status: PaymentStatus | null) => {
    if (!status) return 'bg-gray-500/20 text-gray-400';
    switch (status) {
        case PaymentStatus.LUNAS: return 'solid-green text-white';
        case PaymentStatus.DP_TERBAYAR: return 'solid-blue text-white';
        case PaymentStatus.BELUM_BAYAR: return 'solid-orange text-white';
        default: return 'bg-gray-500/20 text-gray-400';
    }
};

export const ensureOnlineOrNotify = (showNotification: (message: string) => void): boolean => {
    if (!navigator.onLine) {
        showNotification('Harus online untuk melakukan perubahan');
        return false;
    }
    return true;
};

export interface CustomFormItem {
    id: string;
    name: string;
    price: number;
}

export const initialFormState = {
    clientId: '',
    clientName: '',
    avatarUrl: '',
    email: '',
    phone: '',
    whatsapp: '',
    instagram: '',
    clientType: ClientType.DIRECT,
    projectId: '',
    projectName: '',
    projectType: '',
    location: '',
    date: '',
    packageId: '',
    selectedAdditionalPackageIds: [] as string[],
    selectedAddOnIds: [] as string[],
    customItems: [] as CustomFormItem[],
    durationSelection: '',
    unitPrice: undefined as number | undefined,
    dp: '',
    dpDestinationCardId: '',
    dpProofFile: null as File | null,
    dpProofUrl: '',
    notes: '',
    accommodation: '',
    driveLink: '',
    promoCodeId: '',
    address: '',
    homeAddress: '', // Alamat rumah pengantin untuk pengiriman cetakan
};

export type ClientFormData = typeof initialFormState;
export const initialClientFormState = initialFormState;
