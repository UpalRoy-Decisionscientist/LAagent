import { useEffect, useState } from "react";
import { ZoomIn, X } from "lucide-react";
import type { LessonStep } from "../../../shared/types.ts";

export function ConsoleSnapshot({ step }: { step: LessonStep }) {
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    setZoomed(false);
  }, [step.id]);

  const picture = (
    <picture>
      <source srcSet={`${step.imageSrc} 2x`} type="image/webp" />
      <img
        src={step.imageSrc}
        alt={step.alt}
        width={step.imageWidth}
        height={step.imageHeight}
        className="w-full h-auto object-contain bg-slate-950"
        decoding="async"
      />
    </picture>
  );

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-950 shadow-lg">
        {picture}
        <button
          type="button"
          onClick={() => setZoomed(true)}
          className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 rounded-md text-white"
          title="Open high-DPI snapshot"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-slate-500 mt-2 italic">
        High-DPI 2x console snapshot · account identifiers redacted · {step.imageWidth}×
        {step.imageHeight}
      </p>

      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/80 p-4 overflow-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Zoomed console snapshot"
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white bg-black/60 rounded-full p-2"
            onClick={() => setZoomed(false)}
          >
            <X className="w-5 h-5" />
          </button>
          <div className="max-w-[1920px] mx-auto mt-10">{picture}</div>
        </div>
      )}
    </div>
  );
}
