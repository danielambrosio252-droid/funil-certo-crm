/**
 * Audio Processor - Handles async audio processing for WhatsApp
 * Provides optimistic UI pattern: process in background, update via realtime
 */

import { supabase } from "@/integrations/supabase/client";
import { needsTranscoding, transcodeToOgg } from "./audioTranscode";

interface AudioProcessingJob {
  blob: Blob;
  mimeType: string;
  duration: number;
  contactId: string;
  companyId: string;
  tempMessageId: string;
}

// Queue for concurrent audio processing
const processingQueue: Map<string, AbortController> = new Map();

/**
 * Process and send audio in background (non-blocking)
 * Returns immediately, updates DB when complete
 */
export async function processAndSendAudioAsync(job: AudioProcessingJob): Promise<void> {
  const { blob, mimeType, duration, contactId, companyId, tempMessageId } = job;
  
  const abortController = new AbortController();
  processingQueue.set(tempMessageId, abortController);
  
  try {
    console.log('[AudioProcessor] Starting async processing for:', tempMessageId);
    
    let finalBlob: Blob;
    let contentType: string;
    let extension: string;
    
    // Step 1: Transcode if needed (WebM -> OGG)
    if (needsTranscoding(mimeType)) {
      console.log('[AudioProcessor] Transcoding required for:', mimeType);
      
      const result = await transcodeToOgg(blob, mimeType);
      
      if (abortController.signal.aborted) {
        console.log('[AudioProcessor] Job aborted:', tempMessageId);
        return;
      }
      
      finalBlob = result.blob;
      contentType = result.mimeType;
      extension = result.extension;
      
      console.log('[AudioProcessor] Transcoding complete:', contentType);
    } else {
      console.log('[AudioProcessor] No transcoding needed for:', mimeType);
      
      if (mimeType.includes('ogg')) {
        extension = 'ogg';
        contentType = 'audio/ogg';
      } else if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
        extension = 'm4a';
        contentType = 'audio/mp4';
      } else {
        extension = 'ogg';
        contentType = 'audio/ogg';
      }
      
      finalBlob = new Blob([blob], { type: contentType });
    }
    
    if (abortController.signal.aborted) return;
    
    // Step 2: Upload to Supabase Storage
    console.log('[AudioProcessor] Uploading to storage...');
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 7);
    const filename = `${timestamp}-${randomId}.${extension}`;
    const filePath = `${companyId}/audio/${filename}`;
    
    const { error: uploadError } = await supabase.storage
      .from("whatsapp-media")
      .upload(filePath, finalBlob, {
        contentType,
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
    
    // Step 3: Send via edge function
    console.log('[AudioProcessor] Sending via edge function...');
    const { data, error } = await supabase.functions.invoke("whatsapp-cloud-send", {
      body: {
        contact_id: contactId,
        content: "[AUDIO]",
        message_type: "audio",
        media_url: publicUrl,
        media_filename: filename,
      },
    });
    
    if (error) {
      console.error('[AudioProcessor] Send failed:', error);
      throw error;
    }
    
    console.log('[AudioProcessor] Audio sent successfully:', data?.message_id);
    
  } catch (error) {
    console.error('[AudioProcessor] Processing failed:', error);
    // The message status will be updated by the edge function to "failed"
    // If we failed before creating the message, we just log it
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
