/**
 * Audio Processor - Handles async audio processing for WhatsApp
 * FAST PATH: Upload raw audio immediately, let Edge Function handle Meta upload
 * NO TRANSCODING in frontend - avoids blocking UI
 */

import { supabase } from "@/integrations/supabase/client";

// -----------------------------
// Shared FFmpeg Worker (reused)
// -----------------------------
// Creating a new worker per audio forces FFmpeg to download/init repeatedly and frequently hits timeouts.
// We keep a single worker alive for the whole session and serialize transcode jobs.
let sharedWorker: Worker | null = null;
let ffmpegReady = false;

let preloadPromise: Promise<void> | null = null;
let preloadResolve: (() => void) | null = null;
let preloadReject: ((e: Error) => void) | null = null;
let preloadTimeoutId: ReturnType<typeof setTimeout> | null = null;

type ActiveJob = {
  resolve: (b: Blob) => void;
  reject: (e: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  abortHandler?: () => void;
};
let activeJob: ActiveJob | null = null;

let transcodeQueue: Promise<unknown> = Promise.resolve();

function ensureSharedWorker(): Worker {
  if (sharedWorker) return sharedWorker;

  // Lazy import is not allowed in sync context; worker is created by bundler import below.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  // NOTE: Vite supports worker constructor via dynamic import, but we need it here.
  // We'll create worker in an async path (preload/transcode) and store it.
  throw new Error("Shared worker not initialized");
}

async function getOrCreateWorker(): Promise<Worker> {
  if (sharedWorker) return sharedWorker;
  const { default: WorkerCtor } = await import("@/workers/audioTranscode.worker?worker");
  const worker = new WorkerCtor();
  sharedWorker = worker;

  worker.onmessage = (evt: MessageEvent) => {
    const msg = evt.data;

    if (msg?.type === "progress") {
      console.log("[AudioProcessor][FFMPEG-WORKER]", msg.message);
      if (!ffmpegReady && typeof msg.message === "string" && msg.message.toLowerCase().includes("ready")) {
        ffmpegReady = true;
        if (preloadTimeoutId) {
          clearTimeout(preloadTimeoutId);
          preloadTimeoutId = null;
        }
        preloadResolve?.();
        preloadResolve = null;
        preloadReject = null;
        preloadPromise = null;
      }
      return;
    }

    if (msg?.type === "result") {
      if (!activeJob) return;
      const job = activeJob;
      activeJob = null;
      clearTimeout(job.timeoutId);
      job.abortHandler?.();
      job.resolve(new Blob([msg.oggArrayBuffer], { type: "audio/ogg" }));
      return;
    }

    if (msg?.type === "error") {
      const err = new Error(msg.error || "FFmpeg worker failed");

      // If a transcode is running, fail it; otherwise, fail preload if waiting.
      if (activeJob) {
        const job = activeJob;
        activeJob = null;
        clearTimeout(job.timeoutId);
        job.abortHandler?.();
        job.reject(err);
        return;
      }

      if (!ffmpegReady && preloadReject) {
        if (preloadTimeoutId) {
          clearTimeout(preloadTimeoutId);
          preloadTimeoutId = null;
        }
        preloadReject(err);
        preloadResolve = null;
        preloadReject = null;
        preloadPromise = null;
      }
    }
  };

  worker.onerror = (err) => {
    const e = err instanceof Error ? err : new Error("FFmpeg worker error");
    if (activeJob) {
      const job = activeJob;
      activeJob = null;
      clearTimeout(job.timeoutId);
      job.abortHandler?.();
      job.reject(e);
    }
    if (!ffmpegReady && preloadReject) {
      if (preloadTimeoutId) {
        clearTimeout(preloadTimeoutId);
        preloadTimeoutId = null;
      }
      preloadReject(e);
      preloadResolve = null;
      preloadReject = null;
      preloadPromise = null;
    }
  };

  return worker;
}

export async function preloadAudioTranscoder(): Promise<void> {
  if (ffmpegReady) return;
  if (preloadPromise) return preloadPromise;

  const worker = await getOrCreateWorker();

  preloadPromise = new Promise<void>((resolve, reject) => {
    preloadResolve = resolve;
    preloadReject = reject;

    preloadTimeoutId = setTimeout(() => {
      preloadTimeoutId = null;
      preloadResolve = null;
      preloadReject = null;
      preloadPromise = null;
      reject(new Error("FFmpeg preload timeout"));
    }, 240_000);

    // Trigger load without transcoding
    worker.postMessage({ type: "preload" });
  });

  return preloadPromise;
}

function enqueueTranscode<T>(fn: () => Promise<T>): Promise<T> {
  const next = transcodeQueue.then(fn, fn);
  transcodeQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function inspectOgg(blob: Blob): Promise<{
  size: number;
  duration?: number;
  sampleRate?: number;
  channels?: number;
}> {
  const size = blob.size;
  const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return { size };

  const ctx = new AudioCtx();
  try {
    // decodeAudioData may detach the buffer; pass a copy.
    const ab = await blob.arrayBuffer();
    const copy = ab.slice(0);
    const audioBuffer = await ctx.decodeAudioData(copy);
    return {
      size,
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
    };
  } catch (e) {
    console.warn("[AudioProcessor] Could not decode OGG for inspection:", e);
    return { size };
  } finally {
    try {
      await ctx.close();
    } catch {
      // ignore
    }
  }
}

async function transcodeToOggInWorker(
  input: Blob,
  originalMimeType: string,
  signal?: AbortSignal
): Promise<Blob> {
  return enqueueTranscode(async () => {
    const worker = await getOrCreateWorker();
    await preloadAudioTranscoder();

    if (activeJob) {
      throw new Error("FFmpeg worker is busy");
    }

    return new Promise<Blob>(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        activeJob = null;
        reject(new Error("Audio transcode timeout"));
      }, 240_000);

      const abortHandler = () => {
        if (signal) signal.removeEventListener("abort", abortHandler);
      };

      const onAbort = () => {
        clearTimeout(timeoutId);
        activeJob = null;
        reject(new Error("Audio transcode aborted"));
      };
      if (signal) {
        if (signal.aborted) return onAbort();
        signal.addEventListener("abort", onAbort, { once: true });
      }

      activeJob = {
        resolve,
        reject,
        timeoutId,
        signal,
        abortHandler,
      };

      const arrayBuffer = await input.arrayBuffer();
      worker.postMessage(
        {
          type: "transcode",
          originalMimeType,
          inputArrayBuffer: arrayBuffer,
        },
        [arrayBuffer]
      );
    });
  });
}

interface AudioProcessingJob {
  blob: Blob;
  mimeType: string;
  duration: number;
  contactId: string;
  companyId: string;
  tempMessageId: string;
}

// Queue for tracking concurrent audio processing
const processingQueue: Map<string, AbortController> = new Map();

/**
 * Process and send audio in background (non-blocking)
 * FAST: No transcoding in frontend - just upload and call edge function
 */
export async function processAndSendAudioAsync(job: AudioProcessingJob): Promise<void> {
  const { blob, mimeType, duration, contactId, companyId, tempMessageId } = job;
  
  const abortController = new AbortController();
  processingQueue.set(tempMessageId, abortController);
  
  try {
    console.log('[AudioProcessor] Starting FAST async processing for:', tempMessageId);
    console.log('[AudioProcessor] Original format:', mimeType, 'Size:', blob.size);
    
    if (abortController.signal.aborted) return;
    
    // Step 1: Ensure Storage-compatible & WhatsApp-compatible format.
    // Storage bucket currently rejects audio/webm; WhatsApp requires audio/ogg (opus).
    // We transcode in a Web Worker to avoid blocking UI.
    console.log('[AudioProcessor] Preparing audio for upload (ogg/opus)...');
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 7);

    let uploadBlob = blob;
    const originalBaseMime = mimeType.split(";")[0].toLowerCase();
    let uploadMime = originalBaseMime;
    let extension = "ogg";

    const isOggNative = originalBaseMime.includes("ogg");

    if (isOggNative) {
      // BEST PATH: Browser recorded native OGG/Opus - no transcode needed.
      uploadMime = "audio/ogg";
      extension = "ogg";
      console.log(
        "[AudioProcessor] Native OGG! No transcode. Size:",
        uploadBlob.size,
        "Duration(s):",
        duration
      );
    } else {
      // ALL OTHER FORMATS (MP4, WebM, etc): Transcode to OGG/Opus for Meta Cloud API compatibility.
      // Meta /media endpoint REJECTS audio/mp4 - it requires audio/ogg for audio messages.
      console.log("[AudioProcessor] Non-OGG format:", originalBaseMime, "- transcoding to OGG/Opus...");
      uploadBlob = await transcodeToOggInWorker(blob, mimeType, abortController.signal);
      uploadMime = "audio/ogg";
      extension = "ogg";
      console.log("[AudioProcessor] Transcoded OK. Size:", uploadBlob.size, "Mime:", uploadMime);
    }

    // Post-processing validation for OGG files
    const inspected = await inspectOgg(uploadBlob);
    console.log(
      "[AudioProcessor] Post-conversion inspection:",
      JSON.stringify(
        {
          size_bytes: inspected.size,
          duration_s: inspected.duration,
          sample_rate_hz: inspected.sampleRate,
          channels: inspected.channels,
          codec: "opus (libopus)",
          target: {
            channels: 1,
            sampleRate: 48000, // Opus standard (passes Meta scrutiny better)
            bitrate: "32k",
            container: "ogg",
          },
        },
        null,
        2
      )
    );

    if (inspected.size < 512) {
      throw new Error(`Converted audio too small (<512B): ${inspected.size} bytes`);
    }
    if (typeof inspected.duration === "number" && inspected.duration < 0.5) {
      throw new Error(`Converted audio duration < 0.5s: ${inspected.duration}`);
    }
    
    const filename = `${timestamp}-${randomId}.${extension}`;
    const filePath = `${companyId}/audio/${filename}`;
    
    console.log('[AudioProcessor] Final file path:', filePath);
    console.log('[AudioProcessor] Final upload size:', uploadBlob.size, 'mime:', uploadMime);

    // Upload
    const { error: uploadError } = await supabase.storage
      .from("whatsapp-media")
      .upload(filePath, uploadBlob, {
        contentType: uploadMime,
        cacheControl: '3600',
        upsert: false,
      });
    
    if (uploadError) {
      console.error('[AudioProcessor] Upload failed:', uploadError);
      throw uploadError;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from("whatsapp-media")
      .getPublicUrl(filePath);
    
    console.log('[AudioProcessor] Uploaded to:', publicUrl);
    
    if (abortController.signal.aborted) return;
    
    // Step 2: Send via edge function - it will handle Meta upload
    console.log('[AudioProcessor] Calling edge function...');
    const { data, error } = await supabase.functions.invoke("whatsapp-cloud-send", {
      body: {
        contact_id: contactId,
        content: "[AUDIO]",
        message_type: "audio",
        media_url: publicUrl,
        media_filename: filename,
        audio_duration: duration,
      },
    });
    
    if (error) {
      console.error('[AudioProcessor] Edge function error:', error);
      throw error;
    }
    
    console.log('[AudioProcessor] Audio queued successfully:', data?.message_id);
    
  } catch (error) {
    console.error('[AudioProcessor] Processing failed:', error);
    // Message status will be updated by edge function to "failed"
  } finally {
    processingQueue.delete(tempMessageId);
  }
}

/**
 * Cancel a pending audio processing job
 */
export function cancelAudioProcessing(tempMessageId: string): void {
  const controller = processingQueue.get(tempMessageId);
  if (controller) {
    controller.abort();
    processingQueue.delete(tempMessageId);
  }
}

/**
 * Check if any audio is currently being processed
 */
export function isProcessingAudio(): boolean {
  return processingQueue.size > 0;
}

/**
 * Get count of pending audio jobs
 */
export function getPendingAudioCount(): number {
  return processingQueue.size;
}
