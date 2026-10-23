import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (limit: number) => void;
  label?: string;
  pageSizeOptions?: number[];
  className?: string;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  label = 'data',
  pageSizeOptions = [10, 20, 50],
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  // If no items at all, don't show navigation
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page numbers with window of 5
  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, 4, 5];
    }
    if (currentPage >= totalPages - 2) {
      return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
  };

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-3 border-t border-[#EAEFF4] bg-white rounded-b-xl text-xs text-[#5A6A85] ${className}`}>
      {/* Left: Info & items per page */}
      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        <span>
          Menampilkan <span className="font-bold text-[#2A3547]">{startItem}-{endItem}</span> dari{' '}
          <span className="font-bold text-[#2A3547]">{totalItems}</span> {label}
        </span>

        {onItemsPerPageChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="hidden md:inline">Baris:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                onItemsPerPageChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="bg-[#F4F6F9] border border-[#EAEFF4] rounded-lg px-2 py-1 text-xs font-semibold text-[#2A3547] focus:outline-hidden focus:ring-1 focus:ring-brand-accent cursor-pointer"
              aria-label="Jumlah baris per halaman"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / hal
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Page Navigation buttons */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-end">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#EAEFF4] bg-white text-[#5A6A85] hover:bg-[#F4F6F9] hover:text-[#2A3547] disabled:opacity-40 disabled:cursor-not-allowed transition-all font-medium"
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sebelumnya</span>
          </button>

          <div className="flex items-center gap-1">
            {getPageNumbers().map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                  currentPage === pageNum
                    ? 'bg-brand-accent text-white shadow-xs'
                    : 'border border-[#EAEFF4] bg-white text-[#5A6A85] hover:bg-[#F4F6F9] hover:text-[#2A3547]'
                }`}
                aria-label={`Ke halaman ${pageNum}`}
                aria-current={currentPage === pageNum ? 'page' : undefined}
              >
                {pageNum}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#EAEFF4] bg-white text-[#5A6A85] hover:bg-[#F4F6F9] hover:text-[#2A3547] disabled:opacity-40 disabled:cursor-not-allowed transition-all font-medium"
            aria-label="Halaman selanjutnya"
          >
            <span className="hidden sm:inline">Selanjutnya</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default TablePagination;
