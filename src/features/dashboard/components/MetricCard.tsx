import React from "react";

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon }) => {
  return (
    <div className="bg-surface rounded-xl p-5 border border-border-faint/80 shadow-soft flex items-center gap-4 transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-border-subtle">
      <div className="p-3 bg-surface-sunken rounded-xl">
        {icon}
      </div>
      <div>
        <p className="text-xs sm:text-[10px] uppercase font-medium text-content-subtle">{title}</p>
        <p className="text-xl font-medium text-content-strong">{value}</p>
      </div>
    </div>
  );
};
