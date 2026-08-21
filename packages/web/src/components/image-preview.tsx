"use client";

interface ImagePreviewProps {
  src: string;
  alt: string;
}

export function ImagePreview({ src, alt }: ImagePreviewProps) {
  return (
    <div className="flex-1 flex items-center justify-center overflow-auto p-6 bg-canvas-dark min-h-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="max-w-full max-h-full object-contain rounded-sm shadow-sm" />
    </div>
  );
}
