/**
 * Audio Processor - Handles async audio processing for WhatsApp
 * FAST PATH: Upload raw audio immediately, let Edge Function handle Meta upload
 * NO TRANSCODING in frontend - avoids blocking UI
 */

import { supabase } from "@/integrations/supabase/client";

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
    const abortHandler = () => {
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
        if (signal) signal.removeEventListener("abort", abortHandler);
        cleanup();
        resolve(new Blob([msg.oggArrayBuffer], { type: "audio/ogg" }));
        return;
      }
      if (msg?.type === "error") {
        if (signal) signal.removeEventListener("abort", abortHandler);
        cleanup();
        reject(new Error(msg.error || "FFmpeg worker failed"));
      }
    };

    worker.onerror = (err) => {
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
    let uploadMime = mimeType.split(';')[0];
    let extension = 'ogg';

    const needsOgg = !uploadMime.includes('ogg');
    if (needsOgg) {
      console.log('[AudioProcessor] Transcoding required. From:', uploadMime);
      uploadBlob = await transcodeToOggInWorker(blob, mimeType, abortController.signal);
      uploadMime = 'audio/ogg';
      extension = 'ogg';
      console.log('[AudioProcessor] Transcoded OK. Size:', uploadBlob.size, 'Mime:', uploadMime, 'Duration(s):', duration);
    } else {
      // Keep it OGG, but normalize mime/extension
      uploadMime = 'audio/ogg';
      extension = 'ogg';
      console.log('[AudioProcessor] Already OGG. Size:', uploadBlob.size, 'Duration(s):', duration);
    }
    
    const filename = `${timestamp}-${randomId}.${extension}`;
    const filePath = `${companyId}/audio/${filename}`;
    
    console.log('[AudioProcessor] Final file path:', filePath);
    console.log('[AudioProcessor] Final upload size:', uploadBlob.size, 'mime:', uploadMime);

    // Upload (must be audio/ogg, otherwise bucket rejects)
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
