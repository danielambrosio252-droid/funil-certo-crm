import { useEffect, useRef } from "react";

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
        
        const { default: WorkerCtor } = await import("@/workers/audioTranscode.worker?worker");
        const worker = new WorkerCtor();
        workerRef.current = worker;

        worker.onmessage = (evt: MessageEvent) => {
          const msg = evt.data;
          if (msg?.type === "progress") {
            console.log("[FFmpegPreload]", msg.message);
          }
          if (msg?.type === "error") {
            console.warn("[FFmpegPreload] Preload warning:", msg.error);
            // Don't terminate - let it retry on actual use
          }
          // If loaded successfully, keep worker alive for faster first use
          if (msg?.message?.includes("ready")) {
            console.log("[FFmpegPreload] FFmpeg cached and ready!");
          }
        };

        // Trigger load without transcoding (avoids errors and heavy CPU)
        worker.postMessage({ type: "preload" });

      } catch (error) {
        console.warn("[FFmpegPreload] Background preload failed (non-critical):", error);
      }
    }, 2000);

    return () => {
      clearTimeout(timeoutId);
      // This worker is only for preloading; safe to terminate.
      try {
        workerRef.current?.terminate();
      } catch {
        // ignore
      }
      workerRef.current = null;
    };
  }, []);

  return workerRef;
}
