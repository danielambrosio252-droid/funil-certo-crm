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

        // Send a ping to trigger loading
        worker.postMessage({ type: "ping" });
        
        // Also trigger actual load by sending a tiny transcode request
        // This ensures FFmpeg is fully initialized
        const silentBlob = new Blob([new Uint8Array(1000)], { type: "audio/webm" });
        const arrayBuffer = await silentBlob.arrayBuffer();
        
        // Trigger load (it will fail on transcode but FFmpeg will be loaded)
        worker.postMessage({
          type: "transcode",
          originalMimeType: "audio/webm",
          inputArrayBuffer: arrayBuffer,
        }, [arrayBuffer]);

      } catch (error) {
        console.warn("[FFmpegPreload] Background preload failed (non-critical):", error);
      }
    }, 2000);

    return () => {
      clearTimeout(timeoutId);
      // Don't terminate worker on unmount - keep it for actual recording
    };
  }, []);

  return workerRef;
}
