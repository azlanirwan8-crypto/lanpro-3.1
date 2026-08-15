import React, { useRef, useEffect, useMemo, useState } from "react";
import { format, differenceInDays } from "date-fns";
import { Loader2, Calendar, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Task = any;

// --- Utils ---
export const cn = (...classes: any[]) => classes.filter(Boolean).join(" ");

export const ensureDate = (dateValue: any): Date => {
  if (!dateValue) return new Date();
  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? new Date() : dateValue;
  }
  if (dateValue && typeof dateValue.toDate === "function") {
    const d = dateValue.toDate();
    return isNaN(d.getTime()) ? new Date() : d;
  }
  const d = new Date(dateValue);
  return isNaN(d.getTime()) ? new Date() : d;
};

export const safeFormat = (
  dateValue: any,
  formatStr: string,
  fallback: string = "-",
) => {
  try {
    const d = ensureDate(dateValue);
    if (!dateValue || isNaN(d.getTime())) return fallback;
    return format(d, formatStr);
  } catch (e) {
    return fallback;
  }
};

// --- Components ---
export const TimelineDatePills = ({
  task,
  minDate,
  totalDays,
  interaction,
  tempDates,
}: {
  task: Task;
  minDate: Date;
  totalDays: number;
  interaction: any;
  tempDates: any;
}) => {
  const dates = tempDates[task.id] || {
    startDate: task.startDate,
    endDate: task.endDate,
  };
  if (!dates.startDate || !dates.endDate) return null;

  const start = ensureDate(dates.startDate);
  const end = ensureDate(dates.endDate);
  const duration = differenceInDays(end, start) + 1;

  return (
    <>
      <div className="absolute -left-1 transform -translate-x-full pr-2 top-1/2 -translate-y-1/2 whitespace-nowrap z-50 pointer-events-none">
        <div className="bg-slate-900/90 text-xs sm:text-[10px] font-medium text-white px-2 py-1 rounded shadow-soft-lg backdrop-blur-sm border border-slate-700/50 flex items-center gap-1.5 animate-in fade-in slide-in-from-right-1">
          <Calendar className="w-2.5 h-2.5 text-content-subtle" />
          {format(start, "MMM d, yyyy")}
        </div>
      </div>
      <div className="absolute -right-1 transform translate-x-full pl-2 top-1/2 -translate-y-1/2 whitespace-nowrap z-50 pointer-events-none">
        <div className="bg-slate-900/90 text-xs sm:text-[10px] font-medium text-white px-2 py-1 rounded shadow-soft-lg backdrop-blur-sm border border-slate-700/50 flex items-center gap-1.5 animate-in fade-in slide-in-from-left-1">
          <Calendar className="w-2.5 h-2.5 text-content-subtle" />
          {format(end, "MMM d, yyyy")}
          <span className="text-content-subtle font-normal">
            ({duration} {duration === 1 ? "day" : "days"})
          </span>
        </div>
      </div>
    </>
  );
};

// --- Components ---
export const Button = ({
  children,
  onClick,
  variant = "primary",
  className = "",
  disabled = false,
  size = "md",
}: any) => {
  /* Warna diambil dari token merek, bukan palet Tailwind bawaan. Versi
   * sebelumnya memakai bg-blue-600 dan gray-*, sehingga tombol "bersama" ini
   * justru satu-satunya tempat di aplikasi yang TIDAK memakai warna merek.
   *
   * Tinggi minimum 44px pada ukuran md dan lg memenuhi WCAG 2.5.5; ukuran sm
   * disediakan untuk toolbar padat di desktop dan sengaja tidak dipaksa 44px,
   * tetapi tetap diberi min-h-9 agar tidak sekecil sebelumnya. */
  const base =
    "rounded-lg font-medium transition-all inline-flex items-center justify-center gap-2 " +
    "disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none " +
    "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 active:scale-[0.98]";
  const sizes: any = {
    sm: "px-3 py-2 min-h-9 text-xs",
    md: "px-4 py-2.5 min-h-11 text-sm",
    lg: "px-6 py-3 min-h-12 text-base",
  };
  const variants: any = {
    primary: "bg-primary text-white hover:bg-primary-hover active:bg-primary-active shadow-soft",
    secondary: "bg-surface-muted text-content-body hover:bg-border-subtle border border-border-subtle",
    danger: "bg-danger text-white hover:opacity-90 shadow-soft",
    ghost: "text-content-secondary hover:bg-surface-muted",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export const Input = ({
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
  ...props
}: any) => (
  <input
    type={type}
    value={value ?? ""}
    onChange={onChange}
    placeholder={placeholder}
    className={`w-full px-4 py-2.5 min-h-11 bg-surface text-content border border-border-subtle rounded-lg placeholder:text-content-subtle focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${className}`}
    {...props}
  />
);

export const Textarea = ({
  value,
  onChange,
  placeholder,
  className = "",
  rows = 3,
}: any) => (
  <textarea
    value={value ?? ""}
    onChange={onChange}
    placeholder={placeholder}
    rows={rows}
    className={`w-full px-4 py-2.5 bg-surface text-content border border-border-subtle rounded-lg placeholder:text-content-subtle focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none ${className}`}
  />
);

// --- Error Handling ---

class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    const error = (this as any).state.error;
    if ((this as any).state.hasError) {
      let message = "Something went wrong. Please try refreshing the page.";
      try {
        const errObj = JSON.parse(error.message);
        if (
          errObj.error.includes("permission-denied") ||
          errObj.error.includes("Missing or insufficient permissions")
        ) {
          message =
            "You don't have permission to perform this action. Please check your project access.";
        }
      } catch (e) {
        // Not a JSON error
      }
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-medium text-gray-900 mb-2">
            Oops! An error occurred
          </h2>
          <p className="text-gray-600 mb-6 max-w-md">{message}</p>
          <Button onClick={() => window.location.reload()}>Refresh Page</Button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export const VelzonFloatingParticles = () => {
  const particles = useMemo(() => {
    return Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      size: Math.floor(Math.random() * 5) + 3, // 3px to 8px
      left: `${(i * 2.4 + Math.random() * 3) % 98}%`,
      duration: Math.random() * 8 + 6, // 6s to 14s
      delay: Math.random() * 6,
      opacity: Math.random() * 0.7 + 0.25,
      drift: Math.random() * 40 - 20,
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-surface shadow-[0_0_12px_rgba(255,255,255,0.9)]"
          style={{
            width: p.size,
            height: p.size,
            left: p.left,
            bottom: "-20px",
          }}
          animate={{
            y: ["0vh", "-115vh"],
            x: [0, p.drift, 0],
            opacity: [0, p.opacity, p.opacity, 0],
            scale: [0.6, 1.2, 0.8],
          }}
          transition={{
            duration: p.duration,
            repeat: Number.POSITIVE_INFINITY,
            delay: p.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

/* ─── Card ─────────────────────────────────────────────────────────────────
 * Kartu adalah wadah paling sering dipakai di aplikasi ini, tetapi selama ini
 * ditulis ulang di tiap layar dengan kombinasi utility yang sedikit berbeda —
 * ada yang rounded-lg, ada rounded-xl, ada shadow-sm, ada tanpa bayangan.
 * Ketiga komponen di bawah menyatukannya, memakai token sehingga otomatis
 * benar di mode gelap.
 * ───────────────────────────────────────────────────────────────────────── */

export const Card = ({ children, className = "", ...props }: any) => (
  <div
    className={cn(
      "bg-surface border border-border-subtle rounded-lg shadow-soft overflow-hidden",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader = ({ children, className = "", ...props }: any) => (
  <div
    className={cn(
      "px-5 py-4 border-b border-border-subtle flex items-center justify-between gap-3",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const CardBody = ({ children, className = "", ...props }: any) => (
  <div className={cn("p-5", className)} {...props}>
    {children}
  </div>
);

/* ─── Badge ────────────────────────────────────────────────────────────────
 * Label status kecil. Varian mengikuti warna status pada sistem token, dengan
 * latar transparan agar terbaca di mode terang maupun gelap tanpa perlu dua
 * definisi warna.
 * ───────────────────────────────────────────────────────────────────────── */

type BadgeVariant = "primary" | "success" | "warning" | "danger" | "info" | "neutral";

export const Badge = ({
  children,
  variant = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) => {
  const variants: Record<BadgeVariant, string> = {
    primary: "bg-primary/10 text-primary border-primary/20",
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/15 text-warning border-warning/30",
    danger: "bg-danger/10 text-danger border-danger/20",
    info: "bg-info/10 text-info border-info/20",
    neutral: "bg-surface-muted text-content-secondary border-border-subtle",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-md border",
        "text-xs sm:text-[11px] font-medium uppercase tracking-wide whitespace-nowrap",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
};
