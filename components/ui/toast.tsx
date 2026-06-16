"use client";

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

type ToastInput = {
  description?: string;
  title: string;
  variant?: ToastVariant;
};

type Toast = ToastInput & {
  id: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles = {
  error: {
    icon: TriangleAlert,
    panel: "border-red-200 bg-white",
    iconWrap: "bg-red-50 text-red-600",
    title: "text-red-950"
  },
  info: {
    icon: Info,
    panel: "border-slate-200 bg-white",
    iconWrap: "bg-slate-100 text-slate-700",
    title: "text-slate-950"
  },
  success: {
    icon: CheckCircle2,
    panel: "border-teal-200 bg-white",
    iconWrap: "bg-teal-50 text-teal-700",
    title: "text-teal-950"
  }
} satisfies Record<
  ToastVariant,
  {
    icon: typeof CheckCircle2;
    iconWrap: string;
    panel: string;
    title: string;
  }
>;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ description, title, variant = "info" }: ToastInput) => {
      const id = crypto.randomUUID();

      setToasts((current) => [
        ...current,
        {
          description,
          id,
          title,
          variant
        }
      ]);
      window.setTimeout(() => dismissToast(id), 5000);
    },
    [dismissToast]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="fixed right-4 top-4 z-50 grid w-[calc(100vw-2rem)] max-w-sm gap-3 sm:right-6 sm:top-6"
      >
        {toasts.map((toast) => {
          const styles = variantStyles[toast.variant];
          const Icon = styles.icon;

          return (
            <div
              className={cn(
                "flex gap-3 rounded-lg border p-4 shadow-lg shadow-slate-900/10",
                styles.panel
              )}
              key={toast.id}
              role="status"
            >
              <div
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  styles.iconWrap
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-semibold", styles.title)}>
                  {toast.title}
                </p>
                {toast.description ? (
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    {toast.description}
                  </p>
                ) : null}
              </div>
              <button
                aria-label="Dismiss notification"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                onClick={() => dismissToast(toast.id)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider.");
  }

  return context;
}
