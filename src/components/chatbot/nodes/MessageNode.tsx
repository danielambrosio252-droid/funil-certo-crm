import { memo, useState, useCallback, useRef } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  MessageSquare, 
  Trash2, 
  Plus, 
  Paperclip, 
  Image, 
  Mic, 
  Video, 
  FileText, 
  X, 
  Loader2 
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BlockSelectionMenu } from "../menus/BlockSelectionMenu";
import { NodeType } from "@/hooks/useChatbotFlows";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MessageNodeData {
  message?: string;
  mediaType?: "text" | "image" | "audio" | "video" | "document";
  mediaUrl?: string;
  mediaFilename?: string;
  onUpdate?: (config: Record<string, unknown>) => void;
  onDelete?: () => void;
  onAddNode?: (nodeType: NodeType, sourceNodeId: string) => void;
}

const acceptMap = {
  image: "image/jpeg,image/png,image/webp,image/gif",
  audio: "audio/mpeg,audio/mp4,audio/ogg,audio/amr,audio/aac",
  video: "video/mp4,video/3gpp",
  document: "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain",
};

function MessageNode({ id, data }: NodeProps) {
  const nodeData = data as MessageNodeData;
  const [editing, setEditing] = useState(false);
  const [localMessage, setLocalMessage] = useState(nodeData?.message || "");
  const [showMenu, setShowMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [mediaType, setMediaType] = useState<"text" | "image" | "audio" | "video" | "document">(
    nodeData?.mediaType || "text"
  );
  const [mediaUrl, setMediaUrl] = useState(nodeData?.mediaUrl || "");
  const [mediaFilename, setMediaFilename] = useState(nodeData?.mediaFilename || "");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentTypeRef = useRef<"image" | "audio" | "video" | "document">("image");

  const handleBlur = useCallback(() => {
    setEditing(false);
    nodeData?.onUpdate?.({ 
      message: localMessage,
      mediaType,
      mediaUrl,
      mediaFilename
    });
  }, [localMessage, mediaType, mediaUrl, mediaFilename, nodeData]);

  const handleSelectBlock = (type: NodeType) => {
    nodeData?.onAddNode?.(type, id);
    setShowMenu(false);
  };

  const handleSelectMediaType = (type: "image" | "audio" | "video" | "document") => {
    currentTypeRef.current = type;
    if (fileInputRef.current) {
      fileInputRef.current.accept = acceptMap[type];
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      const filePath = `chatbot/${currentTypeRef.current}s/${fileName}`;

      const { data, error } = await supabase.storage
        .from("whatsapp-media")
        .upload(filePath, file);

      if (error) throw error;

      const { data: publicUrl } = supabase.storage
        .from("whatsapp-media")
        .getPublicUrl(data.path);

      setMediaType(currentTypeRef.current);
      setMediaUrl(publicUrl.publicUrl);
      setMediaFilename(file.name);
      
      nodeData?.onUpdate?.({ 
        message: localMessage,
        mediaType: currentTypeRef.current,
        mediaUrl: publicUrl.publicUrl,
        mediaFilename: file.name
      });

      toast.success("Mídia enviada com sucesso!");
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

  const handleRemoveMedia = () => {
    setMediaType("text");
    setMediaUrl("");
    setMediaFilename("");
    nodeData?.onUpdate?.({ 
      message: localMessage,
      mediaType: "text",
      mediaUrl: "",
      mediaFilename: ""
    });
  };

  const renderMediaPreview = () => {
    if (!mediaUrl || mediaType === "text") return null;

    return (
      <div className="mb-3 relative">
        <div className="bg-slate-100 rounded-xl p-3 flex items-center gap-2">
          {mediaType === "image" && (
            <>
              <Image className="w-4 h-4 text-emerald-600 shrink-0" />
              <img 
                src={mediaUrl} 
                alt="Preview" 
                className="w-16 h-16 object-cover rounded-lg"
              />
            </>
          )}
          {mediaType === "audio" && (
            <Mic className="w-4 h-4 text-orange-600 shrink-0" />
          )}
          {mediaType === "video" && (
            <Video className="w-4 h-4 text-blue-600 shrink-0" />
          )}
          {mediaType === "document" && (
            <FileText className="w-4 h-4 text-purple-600 shrink-0" />
          )}
          <span className="text-xs text-slate-600 truncate flex-1">{mediaFilename}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={handleRemoveMedia}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card className="w-[320px] bg-white border shadow-lg rounded-2xl overflow-visible">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
      />
      
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-slate-400 !border-2 !border-white"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-white" />
          <span className="font-medium text-white text-sm">Mensagem</span>
        </div>
        {nodeData?.onDelete && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-white/70 hover:text-white hover:bg-white/20"
            onClick={() => nodeData?.onDelete?.()}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>

      <CardContent className="p-4">
        {renderMediaPreview()}
        
        <div className="flex items-start gap-2">
          {/* Media attach button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full shrink-0 mt-1"
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                ) : (
                  <Paperclip className="w-4 h-4 text-muted-foreground" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuItem onClick={() => handleSelectMediaType("image")} className="gap-2">
                <Image className="w-4 h-4 text-emerald-600" />
                <span>Imagem</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSelectMediaType("video")} className="gap-2">
                <Video className="w-4 h-4 text-blue-600" />
                <span>Vídeo</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSelectMediaType("audio")} className="gap-2">
                <Mic className="w-4 h-4 text-orange-600" />
                <span>Áudio</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSelectMediaType("document")} className="gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                <span>Documento</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Text input */}
          <div 
            className="flex-1 bg-slate-200 rounded-2xl rounded-tl-sm p-3 cursor-text min-h-[50px] transition-all hover:bg-slate-300/80"
            onClick={() => setEditing(true)}
          >
            {editing ? (
              <textarea
                autoFocus
                className="w-full bg-transparent border-none outline-none resize-none text-sm font-medium text-slate-800"
                placeholder={mediaType !== "text" ? "Legenda (opcional)..." : "Digite a mensagem do bot..."}
                value={localMessage}
                onChange={(e) => setLocalMessage(e.target.value)}
                onBlur={handleBlur}
                rows={2}
              />
            ) : (
              <p className="text-sm font-medium text-slate-800 whitespace-pre-wrap">
                {localMessage || (
                  <span className="text-slate-500">
                    {mediaType !== "text" ? "Legenda (opcional)..." : "Clique para adicionar texto..."}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </CardContent>

      {/* Output handle with + button */}
      <div 
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          if (!showMenu) setShowMenu(false);
        }}
      >
        <Handle
          type="source"
          position={Position.Right}
          className="!w-4 !h-4 !bg-blue-400 !border-2 !border-white transition-all"
        />
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className={`
            absolute top-1/2 -translate-y-1/2 left-3
            w-6 h-6 rounded-full bg-blue-500 hover:bg-blue-600
            flex items-center justify-center
            text-white shadow-lg
            transition-all duration-200
            ${(isHovered || showMenu) ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}
            z-10
          `}
        >
          <Plus className="w-4 h-4" />
        </button>

        {showMenu && (
          <div className="absolute top-1/2 -translate-y-1/2 left-12 z-50">
            <BlockSelectionMenu 
              onSelect={handleSelectBlock} 
              onClose={() => setShowMenu(false)} 
            />
          </div>
        )}
      </div>
    </Card>
  );
}

export default memo(MessageNode);
