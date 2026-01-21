import { useEffect, useRef } from "react";
import { preloadAudioTranscoder } from "@/lib/audioProcessor";

/**
 * Hook to pre-load FFmpeg WebAssembly in background
 * This ensures faster audio recording by loading FFmpeg before user starts recording
 */
export function useFFmpegPreload() {
  const preloadedRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Only preload once per session
    if (preloadedRef.current) return;
    preloadedRef.current = true;

    // Delay preload by 2 seconds to not block initial page render
    const timeoutId = setTimeout(async () => {
      try {
        console.log("[FFmpegPreload] Starting background preload...");

        // Use the shared worker used by the audio pipeline (prevents duplicate downloads/timeouts)
        await preloadAudioTranscoder();
        console.log("[FFmpegPreload] FFmpeg cached and ready!");

      } catch (error) {
        console.warn("[FFmpegPreload] Background preload failed (non-critical):", error);
      }
    }, 2000);

    return () => {
      clearTimeout(timeoutId);
      workerRef.current = null;
    };
  }, []);

  return workerRef;
}
