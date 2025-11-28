
import React from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color?: string;
  className?: string;
  variant?: 'light' | 'dark'; // New prop
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, trend, color = "indigo", className = "", variant = 'light' }) => {
  const isDark = variant === 'dark';
  
  return (
    <div className={`rounded-lg border px-3 py-3 flex items-center justify-between transition-colors ${
      isDark 
        ? 'bg-slate-800 border-slate-700 text-slate-100' 
        : 'bg-slate-50 border-slate-200 text-slate-800'
    } ${className}`}>
      <div>
        <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>{title}</p>
        <h3 className={`text-xl font-bold font-mono leading-none ${isDark ? 'text-white' : 'text-slate-800'}`}>{value}</h3>
      </div>
      <div className={`p-2 rounded-md ${
        isDark 
          ? `bg-slate-700/50 text-${color}-400` 
          : `bg-${color}-100 text-${color}-600`
      }`}>
        {icon}
      </div>
    </div>
  );
};
