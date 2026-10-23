import React from "react";

export interface AccessDeniedProps {
  onBackToDashboard: () => void;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  onBackToDashboard,
}) => (
  <div
    className="
        flex flex-col items-center justify-center 
        h-full 
        text-center 
        p-4 sm:p-6 md:p-8
        animate-fade-in
    "
  >
    <div
      className="
            w-32 h-32 sm:w-40 sm:h-40
            flex items-center justify-center
            mb-4 sm:mb-6
        "
    >
      <img
        src="/assets/images/backgrounds/errorimg.svg"
        alt="Akses Ditolak"
        width="160"
        height="160"
        loading="lazy"
        decoding="async"
        className="w-full h-full object-contain" />
    </div>
    <h2
      className="
            text-xl sm:text-2xl 
            font-bold 
            text-red-600 
            mb-2 sm:mb-3
        "
    >
      Akses Ditolak
    </h2>
    <p
      className="
            text-brand-text-secondary 
            mb-6 sm:mb-8 
            max-w-md
            leading-relaxed
        "
    >
      Anda tidak memiliki izin untuk mengakses halaman ini.
    </p>
    <button onClick={onBackToDashboard} className="button-primary">
      Kembali ke Dashboard
    </button>
  </div>
);

export default AccessDenied;
