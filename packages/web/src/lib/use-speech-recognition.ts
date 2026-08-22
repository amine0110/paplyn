"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type SpeechRecognitionStatus =
  | "unsupported"
  | "idle"
  | "listening"
  | "denied"
  | "error";

export interface UseSpeechRecognitionOptions {
  /** Append interim/final transcript to existing input. */
  onTranscript: (text: string, isFinal: boolean) => void;
  /** Called when recognition ends (user or auto). */
  onEnd?: () => void;
  lang?: string;
  continuous?: boolean;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions) {
  const { onTranscript, onEnd, lang = "en-US", continuous = true } = options;
  const [status, setStatus] = useState<SpeechRecognitionStatus>(() =>
    getSpeechRecognitionCtor() ? "idle" : "unsupported"
  );
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onEndRef = useRef(onEnd);
  onTranscriptRef.current = onTranscript;
  onEndRef.current = onEnd;

  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setStatus("unsupported");
      return;
    }

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      const isFinal = event.results[event.results.length - 1]?.isFinal ?? false;
      onTranscriptRef.current(transcript, isFinal);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setStatus("denied");
      } else if (event.error !== "aborted") {
        setStatus("error");
      }
    };

    recognition.onend = () => {
      setStatus((prev) => (prev === "listening" ? "idle" : prev));
      onEndRef.current?.();
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [lang, continuous]);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setStatus("unsupported");
      return;
    }
    try {
      recognition.start();
      setStatus("listening");
    } catch {
      // start() throws if already started — toggle handles that
      setStatus("listening");
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setStatus("idle");
  }, []);

  const toggle = useCallback(() => {
    if (status === "listening") {
      stop();
    } else if (status === "idle" || status === "error") {
      start();
    }
  }, [start, stop, status]);

  return {
    status,
    isListening: status === "listening",
    isSupported: status !== "unsupported",
    start,
    stop,
    toggle,
  };
}
