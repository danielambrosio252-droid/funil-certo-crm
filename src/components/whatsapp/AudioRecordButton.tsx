import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { needsTranscoding, transcodeToOgg, TranscodeProgress } from "@/lib/audioTranscode";

interface AudioRecordButtonProps {
  disabled?: boolean;
  onAudioRecorded: (audio: {
    url: string;
    filename: string;
    duration: number;
  }) => Promise<void>;
  companyId: string;
}

export function AudioRecordButton({
  disabled,
  onAudioRecorded,
  companyId,
}: AudioRecordButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording(false);
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      streamRef.current = stream;
      audioChunksRef.current = [];
      
      // Priority: OGG/Opus (native, best) > WebM/Opus (will be converted) > MP4
      const supportedFormats = [
        'audio/ogg;codecs=opus',
        'audio/webm;codecs=opus', 
        'audio/webm',
        'audio/mp4',
      ];
      
      let mimeType = '';
      for (const format of supportedFormats) {
        if (MediaRecorder.isTypeSupported(format)) {
          mimeType = format;
          break;
        }
      }
      
      if (!mimeType) {
        toast.error("Formato de áudio não suportado pelo navegador");
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      
      console.log('[AudioRecord] Recording with mime type:', mimeType);
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start(100);
      setIsRecording(true);
      startTimeRef.current = Date.now();
      
      timerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
      
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Não foi possível acessar o microfone");
    }
  }, []);

  const stopRecording = useCallback(async (save: boolean = true) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      return new Promise<void>((resolve) => {
        const recorder = mediaRecorderRef.current!;
        
        recorder.onstop = async () => {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          
          setIsRecording(false);
          const duration = recordingDuration;
          setRecordingDuration(0);
          
          if (save && audioChunksRef.current.length > 0 && duration >= 1) {
            await processAndUploadAudio(duration);
          } else if (save && duration < 1) {
            toast.error("Gravação muito curta (mínimo 1 segundo)");
          }
          
          audioChunksRef.current = [];
          mediaRecorderRef.current = null;
          resolve();
        };
        
        recorder.stop();
      });
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setIsRecording(false);
      setRecordingDuration(0);
      audioChunksRef.current = [];
    }
  }, [recordingDuration]);

  const cancelRecording = useCallback(() => {
    stopRecording(false);
  }, [stopRecording]);

  const handleProgress = (progress: TranscodeProgress) => {
    setProcessingMessage(progress.message);
  };

  const processAndUploadAudio = async (duration: number) => {
    if (audioChunksRef.current.length === 0) return;
    
    setIsProcessing(true);
    setProcessingMessage("Preparando áudio...");
    
    try {
      const firstChunk = audioChunksRef.current[0];
      const recordedMimeType = firstChunk.type || 'audio/webm';
      
      console.log('[AudioRecord] Recorded mime type:', recordedMimeType);
      
      let finalBlob: Blob;
      let contentType: string;
      let extension: string;
      
      // Check if transcoding is needed (WebM -> OGG)
      if (needsTranscoding(recordedMimeType)) {
        console.log('[AudioRecord] Transcoding required for:', recordedMimeType);
        setProcessingMessage("Convertendo áudio...");
        
        // Create blob from recorded chunks
        const rawBlob = new Blob(audioChunksRef.current, { type: recordedMimeType });
        
        // Transcode to OGG/Opus
        const result = await transcodeToOgg(rawBlob, recordedMimeType, handleProgress);
        
        finalBlob = result.blob;
        contentType = result.mimeType;
        extension = result.extension;
        
        console.log('[AudioRecord] Transcoding complete:', contentType);
      } else {
        console.log('[AudioRecord] No transcoding needed for:', recordedMimeType);
        
        // Already in a WhatsApp-compatible format
        if (recordedMimeType.includes('ogg')) {
          extension = 'ogg';
          contentType = 'audio/ogg';
        } else if (recordedMimeType.includes('mp4') || recordedMimeType.includes('m4a')) {
          extension = 'm4a';
          contentType = 'audio/mp4';
        } else {
          extension = 'ogg';
          contentType = 'audio/ogg';
        }
        
        finalBlob = new Blob(audioChunksRef.current, { type: contentType });
      }
      
      setProcessingMessage("Enviando...");
      
      console.log('[AudioRecord] Final blob - size:', finalBlob.size, 'type:', finalBlob.type);
      
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 7);
      const filename = `${timestamp}-${randomId}.${extension}`;
      const filePath = `${companyId}/audio/${filename}`;
      
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("whatsapp-media")
        .upload(filePath, finalBlob, {
          contentType,
          cacheControl: '3600',
          upsert: false,
        });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from("whatsapp-media")
        .getPublicUrl(filePath);
      
      console.log('[AudioRecord] Uploaded to:', publicUrl);
      
      await onAudioRecorded({
        url: publicUrl,
        filename,
        duration,
      });
      
      toast.success("Áudio gravado!");
    } catch (error) {
      console.error("Error processing audio:", error);
      toast.error("Erro ao processar áudio");
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isRecording) {
    return (
      <div className="flex items-center gap-2 bg-red-50 rounded-full px-3 py-1 border border-red-200">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        <span className="text-sm font-medium text-red-600 min-w-[40px]">
          {formatDuration(recordingDuration)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-200"
          onClick={cancelRecording}
        >
          <X className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          className="rounded-full h-8 w-8 bg-red-500 hover:bg-red-600 text-white"
          onClick={() => stopRecording(true)}
        >
          <Square className="w-3 h-3 fill-current" />
        </Button>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="flex items-center gap-2 bg-emerald-50 rounded-full px-3 py-1 border border-emerald-200">
        <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
        <span className="text-sm font-medium text-emerald-600">
          {processingMessage || "Processando..."}
        </span>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "rounded-full shrink-0 transition-colors",
        "hover:bg-emerald-50 hover:text-emerald-600"
      )}
      onClick={startRecording}
      disabled={disabled}
      title="Gravar áudio"
    >
      <Mic className="w-5 h-5 text-muted-foreground" />
    </Button>
  );
}
