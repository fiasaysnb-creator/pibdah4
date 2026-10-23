import React from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  change?: string;
  changeType?: 'increase' | 'decrease';
  iconBgColor?: string;
  iconColor?: string;
  subtitle?: string;
  colorVariant?: 'blue' | 'orange' | 'purple' | 'pink' | 'green' | 'red' | 'default';
  valueClassName?: string;
  description?: string; // Detail description untuk modal
  onClick?: () => void; // Handler untuk klik
  image?: string; // Gambar opsional untuk widget
  compactOnMobile?: boolean;
  iconBesideContentOnMobile?: boolean;
}

const StatCard: React.FC<StatCardProps> = React.memo(({
  icon,
  title,
  value,
  change,
  changeType,
  iconBgColor = 'bg-gray-700/50',
  iconColor = 'text-brand-text-primary',
  subtitle,
  colorVariant = 'default',
  valueClassName = '',
  description,
  onClick,
  image,
  compactOnMobile = false,
  iconBesideContentOnMobile = false
}) => {

  const changeColor = changeType === 'increase' ? 'text-brand-success' : 'text-brand-danger';

  // Solid & gradient accent variants (decorative)
  const colorVariants: Record<string, { iconBg: string; iconColor: string }> = {
    blue: {
      iconBg: 'grad-brand',
      iconColor: 'text-white'
    },
    orange: {
      iconBg: 'grad-orange',
      iconColor: 'text-white'
    },
    purple: {
      iconBg: 'grad-purple',
      iconColor: 'text-white'
    },
    pink: {
      iconBg: 'grad-pink',
      iconColor: 'text-white'
    },
    green: {
      iconBg: 'grad-green',
      iconColor: 'text-white'
    },
    red: {
      iconBg: 'bg-gradient-to-br from-red-600 to-red-700',
      iconColor: 'text-white'
    },
    default: {
      iconBg: 'grad-brand',
      iconColor: 'text-white'
    }
  };

  const colors = colorVariants[colorVariant] || colorVariants.default;

  const TrendingUpIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>
  );

  const TrendingDownIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </svg>
  );

  return (
    <div
      onClick={onClick}
      className={`
      relative
      ${compactOnMobile ? 'p-2 sm:p-6' : 'p-5 sm:p-6'}
      rounded-2xl
      bg-white
      border border-[#EAEFF4]
      shadow-[0_9px_17.5px_rgba(0,0,0,0.05)]
      hover:shadow-md
      transition-all duration-200 ease-out
      group
      h-full
      flex flex-col justify-between
      ${onClick ? 'cursor-pointer' : ''}
    `}>
      <div className={`relative z-10 h-full flex ${iconBesideContentOnMobile ? 'flex-row items-center gap-2 sm:flex-col sm:items-stretch sm:justify-between sm:gap-0' : 'flex-col justify-between'}`}>
        {/* Icon and Change Badge Section */}
        <div className={`flex items-start justify-between ${iconBesideContentOnMobile ? 'mb-0 sm:mb-4' : compactOnMobile ? 'mb-2 sm:mb-4' : 'mb-4'}`}>
          <div className={`
            ${iconBesideContentOnMobile ? 'w-8 h-8 sm:w-12 sm:h-12' : compactOnMobile ? 'w-10 h-10 sm:w-12 sm:h-12' : 'w-11 h-11 sm:w-12 sm:h-12'}
            rounded-xl
            flex items-center justify-center 
            flex-shrink-0 
            ${colors.iconBg} ${colors.iconColor}
            group-hover:scale-105
            transition-transform duration-200
            overflow-hidden
          `}>
            {image ? (
              <img src={image} alt="" className="w-full h-full object-cover"  loading="lazy" decoding="async" />
            ) : (
              <div className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center">
                {icon}
              </div>
            )}
          </div>

          {change && (
            <div className={`
              inline-flex items-center 
              text-[11px]
              font-bold
              gap-1
              px-2.5 py-1
              rounded-full
              flex-shrink-0
              ${changeType === 'increase' ? 'solid-green text-white' : 'bg-red-600 text-white'}
            `}>
              {changeType === 'increase' ? (
                <TrendingUpIcon className="w-3 h-3" />
              ) : (
                <TrendingDownIcon className="w-3 h-3" />
              )}
              <span>{change}</span>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className={iconBesideContentOnMobile ? 'min-w-0 flex-1 sm:flex-none' : ''}>
          <p className="
            text-xs
            text-[#5A6A85]
            font-semibold 
            uppercase
            tracking-wider
            mb-1
            leading-tight
          ">
            {title}
          </p>

          <p className={`
            text-xl sm:text-2xl
            font-extrabold 
            text-[#2A3547] 
            break-words
            tracking-tight
            leading-tight
            ${valueClassName}
          `}>
            {value}
          </p>

          {subtitle && (
            <p className="
              hidden sm:block
              text-xs 
              text-[#5A6A85]
              mt-1.5
              line-clamp-2
              leading-relaxed
              font-normal
            ">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

export default StatCard;