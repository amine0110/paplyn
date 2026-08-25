"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PromptDialogProps {
  open: boolean;
  title?: string;
  message?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function PromptDialog({
  open,
  title,
  message,
  defaultValue = "",
  confirmLabel = "Create",
  cancelLabel = "Cancel",
  placeholder,
  onSubmit,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValue(defaultValue);
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, defaultValue]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <div
      className="fixed inset-0 bg-ink/20 flex items-center justify-center z-[100] p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="bg-surface rounded-lg border border-border p-6 w-full max-w-md shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "prompt-dialog-title" : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 id="prompt-dialog-title" className="font-serif text-lg font-semibold mb-4">
            {title}
          </h2>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {message && (
            <Label htmlFor="prompt-dialog-input" className="text-sm text-ink-muted">
              {message}
            </Label>
          )}
          <Input
            ref={inputRef}
            id="prompt-dialog-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            required
          />
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button type="submit" disabled={!value.trim()}>
              {confirmLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
