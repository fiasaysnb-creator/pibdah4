import React from 'react';
import { FileTextIcon, PlusIcon } from '../../../constants';

interface BuktiPembayaranTabProps {
  onCreateSlip: () => void;
}

const BuktiPembayaranTab: React.FC<BuktiPembayaranTabProps> = ({ onCreateSlip }) => {
  return (
    <div className="space-y-6">
      {/* Header dengan button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-brand-text-primary">Bukti Pembayaran</h3>
          <p className="text-sm text-brand-text-secondary mt-1">
            Kelola semua bukti pembayaran untuk tim dan vendor
          </p>
        </div>
        <button
          onClick={onCreateSlip}
          className="button-primary inline-flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          Buat Slip Pembayaran
        </button>
      </div>

      {/* Placeholder content */}
      <div className="border-2 border-dashed border-brand-border rounded-xl p-12 text-center">
        <FileTextIcon className="w-16 h-16 mx-auto mb-4 text-brand-accent/50" />
        <h4 className="text-base font-semibold text-brand-text-primary mb-2">
          Belum ada bukti pembayaran
        </h4>
        <p className="text-sm text-brand-text-secondary mb-4">
          Klik tombol di atas untuk membuat slip pembayaran baru
        </p>
      </div>
    </div>
  );
};

export default BuktiPembayaranTab;
