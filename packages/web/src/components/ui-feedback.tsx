"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import { Toast, type ToastVariant } from "@/components/ui/toast";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type PromptOptions = {
  title?: string;
  message?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  placeholder?: string;
};

type NoticeOptions = {
  message: string;
  variant?: ToastVariant;
};

type UiFeedbackContextValue = {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  prompt: (options: PromptOptions | string, defaultValue?: string) => Promise<string | null>;
  notice: (options: NoticeOptions | string) => void;
};

const UiFeedbackContext = createContext<UiFeedbackContextValue | null>(null);

const TOAST_DISMISS_MS = 4000;

type ConfirmState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type PromptState = PromptOptions & {
  resolve: (value: string | null) => void;
};

export function UiFeedbackProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [promptState, setPromptState] = useState<PromptState | null>(null);
  const [toast, setToast] = useState<NoticeOptions | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const clearToastTimer = useCallback(() => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const notice = useCallback(
    (options: NoticeOptions | string) => {
      const next = typeof options === "string" ? { message: options, variant: "error" as const } : options;
      clearToastTimer();
      setToast(next);
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, TOAST_DISMISS_MS);
    },
    [clearToastTimer]
  );

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const next = typeof options === "string" ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...next, resolve });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions | string, defaultValue = "") => {
    const next =
      typeof options === "string"
        ? { message: options, defaultValue }
        : { defaultValue, ...options };
    return new Promise<string | null>((resolve) => {
      setPromptState({ ...next, resolve });
    });
  }, []);

  const closeConfirm = useCallback((value: boolean) => {
    setConfirmState((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  const closePrompt = useCallback((value: string | null) => {
    setPromptState((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  useEffect(() => () => clearToastTimer(), [clearToastTimer]);

  const value = useMemo(() => ({ confirm, prompt, notice }), [confirm, prompt, notice]);

  return (
    <UiFeedbackContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title}
        message={confirmState?.message ?? ""}
        confirmLabel={confirmState?.confirmLabel}
        cancelLabel={confirmState?.cancelLabel}
        destructive={confirmState?.destructive}
        onConfirm={() => closeConfirm(true)}
        onCancel={() => closeConfirm(false)}
      />
      <PromptDialog
        open={!!promptState}
        title={promptState?.title}
        message={promptState?.message}
        defaultValue={promptState?.defaultValue}
        confirmLabel={promptState?.confirmLabel}
        cancelLabel={promptState?.cancelLabel}
        placeholder={promptState?.placeholder}
        onSubmit={(nextValue) => closePrompt(nextValue)}
        onCancel={() => closePrompt(null)}
      />
      {toast && <Toast message={toast.message} variant={toast.variant} />}
    </UiFeedbackContext.Provider>
  );
}

export function useUiFeedback(): UiFeedbackContextValue {
  const context = useContext(UiFeedbackContext);
  if (!context) {
    throw new Error("useUiFeedback must be used within UiFeedbackProvider");
  }
  return context;
}
