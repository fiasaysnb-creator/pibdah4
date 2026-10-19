import { PaymentStatus } from '../../../types';

export interface InvoiceLineItem {
  id: string;
  description: string;
  /** Optional sub-details from a package (digital/physical items). Displayed below description. */
  packageDetails?: string[];
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sourceType?: 'package' | 'addon' | 'custom';
  originalAddOnId?: string;
}

export interface InvoiceFormData {
  id?: string;
  invoiceNumber?: string;
  packageId?: string;
  durationSelection?: string;
  paymentDate?: string;
  paymentDateTransactionId?: string;
  invoiceSignature?: string;

  // Client info
  isNewClient: boolean;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientAddress: string;

  // Service & Project info
  title: string;
  projectType: string;
  invoiceDate: string; // YYYY-MM-DD
  eventDate: string;   // YYYY-MM-DD
  location: string;
  address: string;

  // Items
  lineItems: InvoiceLineItem[];

  // Extras
  transportCost: number;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  discountAmount: number;

  // Totals
  subtotal: number;
  grandTotal: number;

  // Payment
  amountPaid: number;
  paymentStatus: PaymentStatus;
  dpProofUrl?: string;
  paymentProofs: { url: string; amount: number; date: string }[];

  // Notes
  notes: string;
}
