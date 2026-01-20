import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Paperclip, Image, FileText, Mic, Video, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MediaUploadButtonProps {
  onMediaSelected: (media: {
    type: "image" | "audio" | "document" | "video";
    url: string;
    filename: string;
    caption?: string;
  }) => void;
  disabled?: boolean;
}

export function MediaUploadButton({ onMediaSelected, disabled }: MediaUploadButtonProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{
    type: string;
    url: string;
    filename: string;
  } | null>(null);
  const [caption, setCaption] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentTypeRef = useRef<"image" | "audio" | "document" | "video">("image");

  const acceptMap = {
    image: "image/jpeg,image/png,image/webp,image/gif",
    audio: "audio/mpeg,audio/mp4,audio/ogg,audio/amr,audio/aac",
    video: "video/mp4,video/3gpp",
    document: "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain",
  };

  const handleSelectType = (type: "image" | "audio" | "document" | "video") => {
    currentTypeRef.current = type;
    if (fileInputRef.current) {
      fileInputRef.current.accept = acceptMap[type];
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 16MB for WhatsApp)
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Arquivo muito grande", {
        description: "O tamanho máximo permitido é 16MB.",
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${currentTypeRef.current}s/${fileName}`;

      const { data, error } = await supabase.storage
        .from("whatsapp-media")
        .upload(filePath, file);

      if (error) throw error;

      const { data: publicUrl } = supabase.storage
        .from("whatsapp-media")
        .getPublicUrl(data.path);

      setPreview({
        type: currentTypeRef.current,
        url: publicUrl.publicUrl,
        filename: file.name,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao fazer upload", {
        description: "Não foi possível enviar o arquivo.",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSend = () => {
    if (!preview) return;

    onMediaSelected({
      type: preview.type as "image" | "audio" | "document" | "video",
      url: preview.url,
      filename: preview.filename,
      caption: caption || undefined,
    });

    setPreview(null);
    setCaption("");
  };

  const handleCancel = () => {
    setPreview(null);
    setCaption("");
  };

  if (preview) {
    return (
      <div className="flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {preview.type === "image" && <Image className="w-4 h-4 text-emerald-600 shrink-0" />}
          {preview.type === "audio" && <Mic className="w-4 h-4 text-emerald-600 shrink-0" />}
          {preview.type === "video" && <Video className="w-4 h-4 text-emerald-600 shrink-0" />}
          {preview.type === "document" && <FileText className="w-4 h-4 text-emerald-600 shrink-0" />}
          <span className="text-sm text-foreground truncate">{preview.filename}</span>
        </div>
        <input
          type="text"
          placeholder="Legenda (opcional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="flex-1 bg-transparent border-0 text-sm focus:outline-none min-w-[100px]"
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={handleCancel}
        >
          <X className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          className="h-7 bg-emerald-600 hover:bg-emerald-700 shrink-0"
          onClick={handleSend}
        >
          Enviar
        </Button>
      </div>
    );
  }

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full shrink-0"
            disabled={disabled || uploading}
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            ) : (
              <Paperclip className="w-5 h-5 text-muted-foreground" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={() => handleSelectType("image")} className="gap-2">
            <Image className="w-4 h-4 text-emerald-600" />
            <span>Imagem</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSelectType("video")} className="gap-2">
            <Video className="w-4 h-4 text-blue-600" />
            <span>Vídeo</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSelectType("audio")} className="gap-2">
            <Mic className="w-4 h-4 text-orange-600" />
            <span>Áudio</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSelectType("document")} className="gap-2">
            <FileText className="w-4 h-4 text-purple-600" />
            <span>Documento</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
