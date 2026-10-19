import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Project, Client, Package, PaymentStatus, TransactionType, Transaction } from '../../../types';
import { InvoiceFormData, InvoiceLineItem } from '../types/invoiceForm';
import { createProject, updateProject, UpdateProjectInput, CreateProjectInput } from '../../../services/projects';
import { createClient } from '../../../services/clients';
import { createTransaction, updateTransaction } from '../../../services/transactions';
import { getLatestInvoicePaymentDate } from '../utils/invoicePdf';

interface UseInvoiceFormModalProps {
  isOpen: boolean;
  projectToEdit?: Project | null;
  clients: Client[];
  packages: Package[];
  /** All transactions — used to compute actual amountPaid from DB truth in edit mode */
  transactions?: Transaction[];
  showNotification: (msg: string) => void;
  onSuccess: (savedProject: Project, newTransaction?: Transaction) => void;
}

const getTodayIsoDate = () => new Date().toISOString().split('T')[0];

const generateId = () => Math.random().toString(36).substring(2, 9);

export function useInvoiceFormModal({
  isOpen,
  projectToEdit,
  clients,
  packages,
  transactions = [],
  showNotification,
  onSuccess,
}: UseInvoiceFormModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<InvoiceFormData>(() => createInitialState(projectToEdit, clients));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /**
   * Compute the true amount paid for a project from the transactions array.
   * Transactions are the source of truth for payment data.
   */
  function computeAmountPaidFromTransactions(projectId: string): number {
    if (!Array.isArray(transactions)) return 0;
    return transactions
      .filter((t) => t.projectId === projectId && t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }

  // Helper to construct initial state
  function createInitialState(editProj?: Project | null, clientList: Client[] = []): InvoiceFormData {
    if (editProj) {
      const client = clientList.find((c) => c.id === editProj.clientId) || clientList.find((c) => c.name.toLowerCase() === (editProj.clientName || '').toLowerCase());
      const lineItems: InvoiceLineItem[] = [];

      const safeAddOns = Array.isArray(editProj.addOns) ? editProj.addOns : [];
      const safeCustomCosts = Array.isArray(editProj.customCosts) ? editProj.customCosts : [];
      const mainPackage = packages.find((pkg) => pkg.id === editProj.packageId)
        || packages.find((pkg) => pkg.name === editProj.packageName);
      const selectedOption = mainPackage?.durationOptions?.find(
        (option) => option.label === editProj.durationSelection,
      );
      const packageDetails = [
        ...(selectedOption?.digitalItems?.length ? selectedOption.digitalItems : mainPackage?.digitalItems || []),
        ...(selectedOption?.physicalItems?.length ? selectedOption.physicalItems : mainPackage?.physicalItems || [])
          .map((item) => typeof item === 'string' ? item : item?.name || '')
          .filter(Boolean),
      ];

      // Reconstruct line items from editProj
      const subtotal = (Number(editProj.totalCost) || 0) + (Number(editProj.discountAmount) || 0);
      const addOnsTotal = safeAddOns.reduce((acc, curr) => acc + (Number(curr?.price) || 0), 0);
      const customCostsTotal = safeCustomCosts.reduce((acc, curr) => acc + (Number(curr?.amount) || 0), 0);
      const primaryItemPrice = Math.max(0, subtotal - addOnsTotal - (Number(editProj.transportCost) || 0) - customCostsTotal);

      // 1. Primary package / service line item
      lineItems.push({
        id: generateId(),
        description: editProj.packageName || editProj.projectName || 'Layanan Utama',
        quantity: 1,
        unitPrice: primaryItemPrice,
        totalPrice: primaryItemPrice,
        packageDetails,
        sourceType: 'package',
      });

      // 2. Add-ons as line items
      safeAddOns.forEach((ao) => {
        lineItems.push({
          id: ao.id || generateId(),
          description: ao.name,
          quantity: 1,
          unitPrice: ao.price || 0,
          totalPrice: ao.price || 0,
          sourceType: 'addon',
          originalAddOnId: ao.id,
        });
      });

      // 3. Custom costs as line items
      safeCustomCosts.forEach((cc) => {
        lineItems.push({
          id: cc.id || generateId(),
          description: cc.description,
          quantity: 1,
          unitPrice: cc.amount || 0,
          totalPrice: cc.amount || 0,
          sourceType: 'custom',
        });
      });

      const lineItemsSum = lineItems.reduce((s, it) => s + it.totalPrice, 0);
      const tCost = Number(editProj.transportCost) || 0;
      const dAmount = Number(editProj.discountAmount) || 0;

      // --- RULE 2 & 6: In edit mode, amountPaid is derived from transactions (source of truth).
      // If transactions array has records for this project, use their sum.
      // Fall back to project.amountPaid only when no transaction data is available.
      const txPaid = computeAmountPaidFromTransactions(editProj.id);
      const actualPaid = txPaid > 0 ? txPaid : (Number(editProj.amountPaid) || 0);
      const projectIncomeTransactions = transactions
        .filter((transaction) => transaction.projectId === editProj.id && transaction.type === TransactionType.INCOME)
        .sort((left, right) => right.date.localeCompare(left.date));
      const paymentDateTransaction = projectIncomeTransactions.find((transaction) =>
        `${transaction.category} ${transaction.description}`.toLowerCase().includes('dp'),
      ) || projectIncomeTransactions[0];

      // Recompute payment status based on actual paid vs invoice total
      const grandTotal = editProj.totalCost || 0;
      let actualPaymentStatus: PaymentStatus;
      if (grandTotal > 0 && actualPaid >= grandTotal) {
        actualPaymentStatus = PaymentStatus.LUNAS;
      } else if (actualPaid > 0) {
        actualPaymentStatus = PaymentStatus.DP_TERBAYAR;
      } else {
        actualPaymentStatus = PaymentStatus.BELUM_BAYAR;
      }

      return {
        id: editProj.id,
        invoiceNumber: `INV-${editProj.id.slice(-8).toUpperCase()}`,
        packageId: editProj.packageId || '',
        durationSelection: editProj.durationSelection || '',
        invoiceSignature: editProj.invoiceSignature || '',
        isNewClient: false,
        clientId: editProj.clientId || client?.id || '',
        clientName: editProj.clientName || client?.name || '',
        clientPhone: client?.phone || client?.whatsapp || '',
        clientEmail: client?.email || '',
        clientAddress: editProj.address || client?.address || '',
        title: editProj.projectName || '',
        projectType: editProj.projectType || 'Wedding',
        invoiceDate: getLatestInvoicePaymentDate(editProj.id, transactions).slice(0, 10),
        paymentDate: paymentDateTransaction?.date.slice(0, 10) || '',
        paymentDateTransactionId: paymentDateTransaction?.id || '',
        eventDate: editProj.deadlineDate ? editProj.deadlineDate.split('T')[0] : (editProj.date ? editProj.date.split('T')[0] : getTodayIsoDate()),
        location: editProj.location || '',
        address: editProj.address || '',
        lineItems: lineItems.length > 0 ? lineItems : [
          { id: generateId(), description: 'Jasa Dokumentasi Fotografi & Videografi', quantity: 1, unitPrice: 0, totalPrice: 0 }
        ],
        transportCost: tCost,
        discountType: 'fixed',
        discountValue: dAmount,
        discountAmount: dAmount,
        subtotal: lineItemsSum + tCost,
        grandTotal: grandTotal,
        // In edit mode: amountPaid is READ-ONLY — derived from transactions, not editable
        amountPaid: actualPaid,
        paymentStatus: actualPaymentStatus,
        notes: editProj.notes || '',
      };
    }

    // Default new invoice state
    return {
      isNewClient: false,
      clientId: clientList[0]?.id || '',
      clientName: clientList[0]?.name || '',
      clientPhone: clientList[0]?.phone || clientList[0]?.whatsapp || '',
      clientEmail: clientList[0]?.email || '',
      clientAddress: clientList[0]?.address || '',
      title: '',
      projectType: 'Wedding',
      packageId: '',
      durationSelection: '',
      invoiceSignature: '',
      invoiceDate: getTodayIsoDate(),
      eventDate: getTodayIsoDate(),
      location: '',
      address: '',
      lineItems: [
        {
          id: generateId(),
          description: 'Jasa Liputan & Dokumentasi',
          quantity: 1,
          unitPrice: 0,
          totalPrice: 0,
        },
      ],
      transportCost: 0,
      discountType: 'fixed',
      discountValue: 0,
      discountAmount: 0,
      subtotal: 0,
      grandTotal: 0,
      amountPaid: 0,
      paymentStatus: PaymentStatus.BELUM_BAYAR,
      notes: 'Pembayaran DP minimal 30% dari total biaya. Pelunasan paling lambat H-3 sebelum tanggal acara.',
    };
  }

  // Reset/re-initialize when modal opens or target project changes
  useEffect(() => {
    if (isOpen) {
      setFormData(createInitialState(projectToEdit, clients));
      setErrorMsg(null);
    }
  }, [isOpen, projectToEdit]);

  // Recalculate totals whenever items, transport, or discount changes
  const recalculate = useCallback((data: InvoiceFormData): InvoiceFormData => {
    // 1. Line items subtotal
    const updatedLineItems = data.lineItems.map((item) => ({
      ...item,
      totalPrice: (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
    }));

    const lineItemsSubtotal = updatedLineItems.reduce((sum, it) => sum + it.totalPrice, 0);
    const transport = Number(data.transportCost) || 0;
    const subtotal = lineItemsSubtotal + transport;

    // 2. Discount calculation
    let discountAmount = 0;
    if (data.discountType === 'percentage') {
      const pct = Math.min(100, Math.max(0, Number(data.discountValue) || 0));
      discountAmount = Math.round((subtotal * pct) / 100);
    } else {
      discountAmount = Math.max(0, Number(data.discountValue) || 0);
    }

    // 3. Grand total
    const grandTotal = Math.max(0, subtotal - discountAmount);
    const paid = Math.max(0, Number(data.amountPaid) || 0);

    // 4. Auto payment status
    let paymentStatus = data.paymentStatus;
    if (grandTotal > 0) {
      if (paid >= grandTotal) {
        paymentStatus = PaymentStatus.LUNAS;
      } else if (paid > 0) {
        paymentStatus = PaymentStatus.DP_TERBAYAR;
      } else {
        paymentStatus = PaymentStatus.BELUM_BAYAR;
      }
    }

    return {
      ...data,
      lineItems: updatedLineItems,
      discountAmount,
      subtotal,
      grandTotal,
      paymentStatus,
    };
  }, []);

  const handleFieldChange = (field: keyof InvoiceFormData, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      return recalculate(updated);
    });
  };

  const handleClientSelect = (selectedClientId: string) => {
    const matched = clients.find((c) => c.id === selectedClientId);
    if (matched) {
      setFormData((prev) => ({
        ...prev,
        clientId: matched.id,
        clientName: matched.name,
        clientPhone: matched.phone || matched.whatsapp || '',
        clientEmail: matched.email || '',
        clientAddress: matched.address || '',
      }));
    }
  };

  // Line item handlers
  const handleAddLineItem = (item?: Partial<InvoiceLineItem>) => {
    setFormData((prev) => {
      const newItem: InvoiceLineItem = {
        id: generateId(),
        description: item?.description || '',
        packageDetails: item?.packageDetails,
        quantity: item?.quantity || 1,
        unitPrice: item?.unitPrice || 0,
        totalPrice: (item?.quantity || 1) * (item?.unitPrice || 0),
        sourceType: item?.sourceType || 'custom',
      };
      const updated = {
        ...prev,
        lineItems: [...prev.lineItems, newItem],
      };
      return recalculate(updated);
    });
  };

  const handleUpdateLineItem = (
    id: string,
    field: 'description' | 'quantity' | 'unitPrice',
    val: string | number
  ) => {
    setFormData((prev) => {
      const updatedItems = prev.lineItems.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: val };
          if (field === 'quantity' || field === 'unitPrice') {
            const q = field === 'quantity' ? Number(val) || 1 : item.quantity;
            const p = field === 'unitPrice' ? Number(val) || 0 : item.unitPrice;
            updated.totalPrice = q * p;
          }
          return updated;
        }
        return item;
      });
      return recalculate({ ...prev, lineItems: updatedItems });
    });
  };

  const handleRemoveLineItem = (id: string) => {
    setFormData((prev) => {
      if (prev.lineItems.length <= 1) return prev;
      const updatedItems = prev.lineItems.filter((it) => it.id !== id);
      return recalculate({ ...prev, lineItems: updatedItems });
    });
  };

  // Submit action
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    // Validation
    const effectiveTitle = formData.title.trim() || `Invoice ${formData.clientName || 'Layanan'}`;
    if (!formData.isNewClient && !formData.clientId && !formData.clientName.trim()) {
      setErrorMsg('Pilih pengantin atau masukkan nama pengantin.');
      return;
    }
    if (formData.isNewClient && !formData.clientName.trim()) {
      setErrorMsg('Nama pengantin baru wajib diisi.');
      return;
    }
    if (formData.lineItems.length === 0) {
      setErrorMsg('Tambahkan minimal 1 item layanan pada invoice.');
      return;
    }
    const hasInvalidLineItem = formData.lineItems.some((it) => !it.description.trim());
    if (hasInvalidLineItem) {
      setErrorMsg('Semua baris item wajib memiliki deskripsi/nama item.');
      return;
    }

    setIsSubmitting(true);

    try {
      let finalClientId = formData.clientId;
      let finalClientName = formData.clientName.trim();
      let createdClientForCache: Client | undefined;

      // 1. If new client requested, persist client record first
      if (formData.isNewClient) {
        const newClientPayload = {
          name: finalClientName,
          email: formData.clientEmail.trim(),
          phone: formData.clientPhone.trim(),
          whatsapp: formData.clientPhone.trim(),
          address: formData.clientAddress.trim(),
          since: new Date().toISOString(),
          status: 'Aktif' as any,
          clientType: 'Langsung' as any,
          lastContact: new Date().toISOString(),
          portalAccessId: Math.random().toString(36).substring(2, 10).toUpperCase(),
        };

        const createdClient = await createClient(newClientPayload);
        createdClientForCache = createdClient;
        finalClientId = createdClient.id;
        finalClientName = createdClient.name;
      }

      // 2. Prepare line items mapping
      // Item 0 is primary package/service
      const primaryItem = formData.lineItems[0];
      const additionalItems = formData.lineItems.slice(1);

      // Separate add-ons vs custom items
      const addOnItems = additionalItems.filter((it) => it.sourceType === 'addon');
      const customCostItems = additionalItems.filter((it) => it.sourceType !== 'addon');

      // Custom costs for line items that are not add-ons
      const customCosts = customCostItems.map((item) => ({
        id: item.id || generateId(),
        description: item.quantity > 1 ? `${item.description} (${item.quantity}x)` : item.description,
        amount: item.totalPrice,
      }));

      const primaryPackageName = primaryItem
        ? (primaryItem.quantity > 1
            ? `${primaryItem.description} (${primaryItem.quantity}x)`
            : primaryItem.description)
        : (projectToEdit?.packageName || 'Layanan Utama');

      // Map add-on items directly to maintain synchronization with project_add_ons
      const updatedAddOns = addOnItems.map((it) => ({
        id: it.originalAddOnId || it.id,
        name: it.description,
        price: it.totalPrice,
      }));

      const projectDataPayload: CreateProjectInput & UpdateProjectInput = {
        projectName: effectiveTitle,
        clientName: finalClientName,
        clientId: finalClientId,
        projectType: formData.projectType || projectToEdit?.projectType || 'Wedding',
        packageName: primaryPackageName,
        packageId: projectToEdit?.packageId,
        date: (formData.eventDate || formData.invoiceDate)
          ? (formData.eventDate || formData.invoiceDate) + 'T00:00:00+07:00'
          : null,
        deadlineDate: (formData.eventDate || formData.invoiceDate)
          ? (formData.eventDate || formData.invoiceDate) + 'T00:00:00+07:00'
          : null,
        location: formData.location || '',
        address: formData.address || '',
        // Preserve status, progress and substatus workflows without accidental resets
        status: projectToEdit?.status || 'Sedang Berjalan',
        progress: projectToEdit?.progress ?? 0,
        activeSubStatuses: projectToEdit?.activeSubStatuses,
        customSubStatuses: projectToEdit?.customSubStatuses,
        confirmedSubStatuses: projectToEdit?.confirmedSubStatuses,
        clientSubStatusNotes: projectToEdit?.clientSubStatusNotes,
        subStatusConfirmationSentAt: projectToEdit?.subStatusConfirmationSentAt,
        bookingStatus: projectToEdit?.bookingStatus,
        isEditingConfirmedByClient: projectToEdit?.isEditingConfirmedByClient,
        isPrintingConfirmedByClient: projectToEdit?.isPrintingConfirmedByClient,
        isDeliveryConfirmedByClient: projectToEdit?.isDeliveryConfirmedByClient,
        printingDetails: projectToEdit?.printingDetails,
        printingCost: projectToEdit?.printingCost,
        driveLink: projectToEdit?.driveLink,
        clientDriveLink: projectToEdit?.clientDriveLink,
        finalDriveLink: projectToEdit?.finalDriveLink,
        startTime: projectToEdit?.startTime,
        endTime: projectToEdit?.endTime,
        totalCost: formData.grandTotal,
        amountPaid: formData.amountPaid,
        paymentStatus: formData.paymentStatus,
        discountAmount: Number(formData.discountAmount) || 0,
        transportCost: Number(formData.transportCost) || 0,
        customCosts: customCosts,
        addOns: updatedAddOns,
        notes: formData.notes || '',
      };

      let savedProject: Project;
      let recordedTx: Transaction | undefined = undefined;
      let updatedPaymentTransaction: Transaction | undefined;

      if (formData.id) {
        // ── EDIT MODE ──────────────────────────────────────────────────────
        // RULE 2, 6, 8: amountPaid comes from transactions (source of truth).
        // Editing an invoice ONLY changes invoice details (total, items, etc.).
        // It NEVER creates a new transaction and NEVER overwrites amountPaid from the form.
        const actualPaid = computeAmountPaidFromTransactions(formData.id);

        // Recompute payment status based on transactions sum vs new total
        const newTotal = formData.grandTotal;
        let recalcStatus: PaymentStatus;
        if (newTotal > 0 && actualPaid >= newTotal) {
          recalcStatus = PaymentStatus.LUNAS;
        } else if (actualPaid > 0) {
          recalcStatus = PaymentStatus.DP_TERBAYAR;
        } else {
          recalcStatus = PaymentStatus.BELUM_BAYAR;
        }

        // Override payment fields in payload with transaction-derived values
        projectDataPayload.amountPaid = actualPaid;
        projectDataPayload.paymentStatus = recalcStatus;

        const paymentDateTransaction = transactions.find(
          (transaction) => transaction.id === formData.paymentDateTransactionId,
        );
        const updated = await updateProject(formData.id, projectDataPayload);
        savedProject = {
          ...projectToEdit,
          ...updated,
          amountPaid: actualPaid,
          paymentStatus: recalcStatus,
          team: projectToEdit?.team || updated.team,
          weddingDayChecklist: projectToEdit?.weddingDayChecklist || updated.weddingDayChecklist,
        };

        if (
          paymentDateTransaction &&
          formData.paymentDate &&
          paymentDateTransaction.date.slice(0, 10) !== formData.paymentDate
        ) {
          updatedPaymentTransaction = await updateTransaction(paymentDateTransaction.id, {
            date: formData.paymentDate,
          });
          queryClient.setQueryData<Transaction[]>(['transactions'], (current) =>
            current?.map((transaction) => transaction.id === updatedPaymentTransaction?.id
              ? updatedPaymentTransaction
              : transaction
            ).sort((left, right) => right.date.localeCompare(left.date)),
          );
        }

        // RULE 3, 10, 11: Do NOT create any transaction when saving an invoice edit.
        // Transaction creation only happens via a dedicated payment flow.

        showNotification('Invoice berhasil diperbarui!');
      } else {
        // ── CREATE MODE ───────────────────────────────────────────────────
        const createdProject = await createProject(projectDataPayload);
        savedProject = {
          ...createdProject,
          addOns: updatedAddOns,
        };

        // RULE 4, 9: If initial amountPaid is entered on a NEW invoice, record one income transaction.
        if (formData.amountPaid > 0) {
          try {
            recordedTx = await createTransaction({
              date: formData.invoiceDate || getTodayIsoDate(),
              description: `DP / Pembayaran Invoice ${savedProject.projectName}`,
              amount: formData.amountPaid,
              type: TransactionType.INCOME,
              projectId: savedProject.id,
              category: 'Pembayaran Pengantin',
              method: 'Transfer Bank',
            });
          } catch (txErr) {
            console.warn('[useInvoiceFormModal] Failed to create initial transaction:', txErr);
          }
        }

        showNotification('Invoice berhasil dibuat!');
      }

      queryClient.setQueryData<Project[]>(['projects'], (current) => {
        if (!current) return current;
        return formData.id
          ? current.map((project) => project.id === savedProject.id ? savedProject : project)
          : [savedProject, ...current.filter((project) => project.id !== savedProject.id)];
      });
      const createdClient = createdClientForCache;
      if (createdClient) {
        queryClient.setQueryData<Client[]>(['clients'], (current) =>
          current ? [createdClient, ...current.filter((client) => client.id !== createdClient.id)] : current
        );
      }
      const savedTransaction = recordedTx;
      if (savedTransaction) {
        queryClient.setQueryData<Transaction[]>(['transactions'], (current) =>
          current ? [savedTransaction, ...current.filter((transaction) => transaction.id !== savedTransaction.id)] : current
        );
      }

      // Derived totals refresh in the background; do not hold the save button open.
      void queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });

      onSuccess(savedProject, recordedTx || (formData.id ? updatedPaymentTransaction : undefined));
    } catch (err: any) {
      console.error('[useInvoiceFormModal] Error saving invoice:', err);
      setErrorMsg(err.message || 'Gagal menyimpan invoice. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formData,
    isSubmitting,
    errorMsg,
    handleFieldChange,
    handleClientSelect,
    handleAddLineItem,
    handleUpdateLineItem,
    handleRemoveLineItem,
    handleSubmit,
  };
}
