/**
 * Audio Processor - Handles async audio processing for WhatsApp
 * FAST PATH: Upload raw audio immediately, let Edge Function handle Meta upload
 * NO TRANSCODING in frontend - avoids blocking UI
 */

import { supabase } from "@/integrations/supabase/client";

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
    
    // Step 1: Upload to Supabase Storage immediately (no transcoding)
    // Edge function will handle conversion if needed
    console.log('[AudioProcessor] Uploading raw audio to storage...');
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 7);
    
    // Determine extension based on MIME type
    let extension = 'ogg';
    if (mimeType.includes('webm')) extension = 'webm';
    else if (mimeType.includes('mp4') || mimeType.includes('m4a')) extension = 'm4a';
    else if (mimeType.includes('ogg')) extension = 'ogg';
    
    const filename = `${timestamp}-${randomId}.${extension}`;
    const filePath = `${companyId}/audio/${filename}`;
    
    // Upload with original MIME type - Edge function handles conversion
    const { error: uploadError } = await supabase.storage
      .from("whatsapp-media")
      .upload(filePath, blob, {
        contentType: mimeType.split(';')[0], // Remove codec info
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
