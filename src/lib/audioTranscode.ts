/**
 * Audio Transcoding Utility using FFmpeg WebAssembly
 * Converts WebM/other formats to OGG/Opus for WhatsApp Cloud API compatibility
 */

let ffmpegInstance: any = null;
let isLoading = false;
let loadPromise: Promise<any> | null = null;

/**
 * Lazy-load FFmpeg only when needed
 */
async function loadFFmpeg(): Promise<any> {
  if (ffmpegInstance) {
    return ffmpegInstance;
  }

  if (loadPromise) {
    return loadPromise;
  }

  isLoading = true;
  loadPromise = (async () => {
    try {
      console.log('[FFmpeg] Loading FFmpeg WebAssembly...');
      
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { fetchFile } = await import('@ffmpeg/util');
      
      const ffmpeg = new FFmpeg();
      
      // Load FFmpeg core from CDN
      await ffmpeg.load({
        coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
        wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
      });
      
      console.log('[FFmpeg] FFmpeg loaded successfully');
      ffmpegInstance = { ffmpeg, fetchFile };
      return ffmpegInstance;
    } catch (error) {
      console.error('[FFmpeg] Failed to load FFmpeg:', error);
      loadPromise = null;
      throw error;
    } finally {
      isLoading = false;
    }
  })();

  return loadPromise;
}

/**
 * Check if the audio format needs transcoding for WhatsApp compatibility
 */
export function needsTranscoding(mimeType: string): boolean {
  // WhatsApp Cloud API accepts: audio/aac, audio/mp4, audio/mpeg, audio/amr, audio/ogg (opus only)
  // WebM is NOT accepted by WhatsApp
  const acceptedFormats = [
    'audio/ogg',
    'audio/aac',
    'audio/mp4',
    'audio/mpeg',
    'audio/amr',
    'audio/m4a',
  ];
  
  const normalizedType = mimeType.split(';')[0].toLowerCase();
  return !acceptedFormats.some(f => normalizedType.includes(f.replace('audio/', '')));
}

/**
 * Get input format for FFmpeg based on MIME type
 */
function getInputFormat(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'mp4';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm'; // Default
}

export interface TranscodeResult {
  blob: Blob;
  mimeType: string;
  extension: string;
}

export interface TranscodeProgress {
  progress: number; // 0-100
  message: string;
}

/**
 * Transcode audio to OGG/Opus format for WhatsApp compatibility
 */
export async function transcodeToOgg(
  audioBlob: Blob,
  originalMimeType: string,
  onProgress?: (progress: TranscodeProgress) => void
): Promise<TranscodeResult> {
  console.log('[FFmpeg] Starting transcoding from:', originalMimeType);
  
  onProgress?.({ progress: 10, message: 'Carregando conversor...' });
  
  const { ffmpeg, fetchFile } = await loadFFmpeg();
  
  onProgress?.({ progress: 30, message: 'Preparando áudio...' });
  
  const inputFormat = getInputFormat(originalMimeType);
  const inputFileName = `input.${inputFormat}`;
  const outputFileName = 'output.ogg';
  
  try {
    // Write input file to FFmpeg virtual filesystem
    const inputData = await fetchFile(audioBlob);
    await ffmpeg.writeFile(inputFileName, inputData);
    
    onProgress?.({ progress: 50, message: 'Convertendo para OGG/Opus...' });
    
    // Transcode to OGG with Opus codec
    // -c:a libopus: Use Opus codec (required by WhatsApp)
    // -b:a 64k: 64kbps bitrate (good quality for voice)
    // -vn: No video
    // -ar 48000: 48kHz sample rate (Opus standard)
    await ffmpeg.exec([
      '-i', inputFileName,
      '-c:a', 'libopus',
      '-b:a', '64k',
      '-vn',
      '-ar', '48000',
      outputFileName
    ]);
    
    onProgress?.({ progress: 80, message: 'Finalizando...' });
    
    // Read output file
    const outputData = await ffmpeg.readFile(outputFileName);
    
    // Cleanup virtual filesystem
    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);
    
    // Create blob with correct MIME type
    const outputBlob = new Blob([outputData], { type: 'audio/ogg' });
    
    onProgress?.({ progress: 100, message: 'Conversão concluída!' });
    
    console.log('[FFmpeg] Transcoding complete. Output size:', outputBlob.size);
    
    return {
      blob: outputBlob,
      mimeType: 'audio/ogg',
      extension: 'ogg'
    };
  } catch (error) {
    console.error('[FFmpeg] Transcoding error:', error);
    throw new Error('Falha na conversão do áudio');
  }
}

/**
 * Check if FFmpeg is already loaded
 */
export function isFFmpegLoaded(): boolean {
  return ffmpegInstance !== null;
}

/**
 * Preload FFmpeg (optional, for faster first transcoding)
 */
export async function preloadFFmpeg(): Promise<void> {
  try {
    await loadFFmpeg();
  } catch (error) {
    console.warn('[FFmpeg] Preload failed:', error);
  }
}
