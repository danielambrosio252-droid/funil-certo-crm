import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  const [isUploading, setIsUploading] = useState(false);
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
      
      // Use webm for better compatibility, will be converted or sent as-is
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      startTimeRef.current = Date.now();
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
      
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Não foi possível acessar o microfone");
    }
  }, []);

  const stopRecording = useCallback(async (save: boolean = true) => {
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      return new Promise<void>((resolve) => {
        const recorder = mediaRecorderRef.current!;
        
        recorder.onstop = async () => {
          // Stop all tracks
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          
          setIsRecording(false);
          const duration = recordingDuration;
          setRecordingDuration(0);
          
          if (save && audioChunksRef.current.length > 0 && duration >= 1) {
            await uploadAudio(duration);
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
      // Cleanup without recording
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

  const uploadAudio = async (duration: number) => {
    if (audioChunksRef.current.length === 0) return;
    
    setIsUploading(true);
    
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 7);
      const filename = `${timestamp}-${randomId}.webm`;
      const filePath = `${companyId}/audio/${filename}`;
      
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("whatsapp-media")
        .upload(filePath, audioBlob, {
          contentType: 'audio/webm',
          cacheControl: '3600',
        });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("whatsapp-media")
        .getPublicUrl(filePath);
      
      await onAudioRecorded({
        url: publicUrl,
        filename,
        duration,
      });
      
      toast.success("Áudio enviado!");
    } catch (error) {
      console.error("Error uploading audio:", error);
      toast.error("Erro ao enviar áudio");
    } finally {
      setIsUploading(false);
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

  if (isUploading) {
    return (
      <Button variant="ghost" size="icon" className="rounded-full shrink-0" disabled>
        <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
      </Button>
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
