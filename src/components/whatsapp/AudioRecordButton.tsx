import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AudioRecordButtonProps {
  disabled?: boolean;
  /**
   * Called immediately when recording stops with raw audio blob.
   * Parent component handles async processing for optimistic UI.
   */
  onRecordingComplete: (data: {
    blob: Blob;
    mimeType: string;
    duration: number;
  }) => void;
}

export function AudioRecordButton({
  disabled,
  onRecordingComplete,
}: AudioRecordButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const recordedMimeTypeRef = useRef<string>('audio/webm');

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
      
      // PRIORITY: OGG/Opus native (eliminates transcoding entirely)
      // Fallback: WebM/Opus → will be transcoded on Edge Function (backend)
      // Note: Chrome 91+, Firefox, Edge support audio/ogg;codecs=opus
      const supportedFormats = [
        'audio/ogg;codecs=opus', // BEST: No transcode needed!
        'audio/ogg',            // OGG without explicit opus
        // IMPORTANT: Prefer MP4 over WebM to avoid FFmpeg WASM download/transcode.
        // Most Chromium browsers support recording to audio/mp4.
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
      ];
      
      let mimeType = '';
      for (const format of supportedFormats) {
        if (MediaRecorder.isTypeSupported(format)) {
          mimeType = format;
          break;
        }
      }
      
      console.log('[AudioRecord] Browser supported formats check:', 
        supportedFormats.map(f => `${f}: ${MediaRecorder.isTypeSupported(f)}`).join(', '));
      
      if (!mimeType) {
        toast.error("Formato de áudio não suportado pelo navegador");
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      
      console.log('[AudioRecord] Recording with mime type:', mimeType);
      recordedMimeTypeRef.current = mimeType;
      
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

  const stopRecording = useCallback((save: boolean = true) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      const recorder = mediaRecorderRef.current;
      const duration = recordingDuration;
      
      recorder.onstop = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        setIsRecording(false);
        setRecordingDuration(0);
        
        if (save && audioChunksRef.current.length > 0 && duration >= 1) {
          // Create blob and call parent immediately (no blocking)
          const mimeType = recordedMimeTypeRef.current;
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          
          console.log('[AudioRecord] Recording complete, size:', blob.size, 'type:', mimeType);
          
          // Call parent synchronously - they handle async processing
          onRecordingComplete({
            blob,
            mimeType,
            duration,
          });
        } else if (save && duration < 1) {
          toast.error("Gravação muito curta (mínimo 1 segundo)");
        }
        
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
      };
      
      recorder.stop();
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setIsRecording(false);
      setRecordingDuration(0);
      audioChunksRef.current = [];
    }
  }, [recordingDuration, onRecordingComplete]);

  const cancelRecording = useCallback(() => {
    stopRecording(false);
  }, [stopRecording]);

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
