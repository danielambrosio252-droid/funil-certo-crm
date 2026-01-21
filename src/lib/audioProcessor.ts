/**
 * Audio Processor - Handles async audio processing for WhatsApp
 * FAST PATH: Upload raw audio immediately, let Edge Function handle Meta upload
 * NO TRANSCODING in frontend - avoids blocking UI
 */

import { supabase } from "@/integrations/supabase/client";

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
  // Run FFmpeg in a Web Worker to avoid blocking UI thread.
  const { default: WorkerCtor } = await import("@/workers/audioTranscode.worker?worker");
  const worker = new WorkerCtor();

  const cleanup = () => {
    try {
      worker.terminate();
    } catch {
      // ignore
    }
  };

  return new Promise(async (resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("Audio transcode timeout (worker did not respond)"));
    }, 120_000);

    const abortHandler = () => {
      clearTimeout(timeoutId);
      cleanup();
      reject(new Error("Audio transcode aborted"));
    };
    if (signal) {
      if (signal.aborted) return abortHandler();
      signal.addEventListener("abort", abortHandler, { once: true });
    }

    worker.onmessage = (evt: MessageEvent) => {
      const msg = evt.data;
      if (msg?.type === "progress") {
        // Keep logs explicit for auditing
        console.log("[AudioProcessor][FFMPEG-WORKER]", msg.message);
        return;
      }
      if (msg?.type === "result") {
        clearTimeout(timeoutId);
        if (signal) signal.removeEventListener("abort", abortHandler);
        cleanup();
        resolve(new Blob([msg.oggArrayBuffer], { type: "audio/ogg" }));
        return;
      }
      if (msg?.type === "error") {
        clearTimeout(timeoutId);
        if (signal) signal.removeEventListener("abort", abortHandler);
        cleanup();
        reject(new Error(msg.error || "FFmpeg worker failed"));
      }
    };

    worker.onerror = (err) => {
      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener("abort", abortHandler);
      cleanup();
      reject(err);
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
            sampleRate: 16000, // WhatsApp voice note standard
            bitrate: "24k",
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
