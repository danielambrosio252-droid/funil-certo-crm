import { memo, useState, useRef, useEffect, useCallback } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { 
  Play, 
  MessageCircle, 
  FileText, 
  Image, 
  Clock, 
  MessageSquare, 
  GitBranch, 
  Flag,
  Plus,
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BaseNodeData {
  label?: string;
  config?: Record<string, unknown>;
  onConfigure?: () => void;
  onUpdateConfig?: (config: Record<string, unknown>) => void;
  nodeIndex?: number;
}

// ============================================
// CHAT-STYLE MESSAGE NODE - WhatsApp/iMessage inspired
// ============================================
function ChatMessageNode({ 
  data, 
  selected 
}: { 
  data: BaseNodeData; 
  selected?: boolean;
}) {
  const config = data.config || {};
  const message = (config.message as string) || "";
  const buttons = (config.buttons as string[]) || [];
  const [localMessage, setLocalMessage] = useState(message);
  const [localButtons, setLocalButtons] = useState<string[]>(buttons);
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync with external config
  useEffect(() => {
    setLocalMessage((config.message as string) || "");
    setLocalButtons((config.buttons as string[]) || []);
  }, [config.message, config.buttons]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [localMessage, isEditing]);

  const saveChanges = useCallback(() => {
    if (data.onUpdateConfig) {
      data.onUpdateConfig({
        ...config,
        message: localMessage,
        buttons: localButtons.filter(b => b.trim()),
      });
    }
    setIsEditing(false);
  }, [data, config, localMessage, localButtons]);

  const addButton = () => {
    if (localButtons.length < 3) {
      setLocalButtons([...localButtons, ""]);
    }
  };

  const updateButton = (index: number, value: string) => {
    const newButtons = [...localButtons];
    newButtons[index] = value;
    setLocalButtons(newButtons);
  };

  const removeButton = (index: number) => {
    setLocalButtons(localButtons.filter((_, i) => i !== index));
  };

  const hasButtons = localButtons.length > 0;

  return (
    <div className={cn(
      "relative min-w-[300px] max-w-[340px] transition-all",
      selected && "scale-[1.02]"
    )}>
      {/* Target handle - top center */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-slate-500 !border-2 !border-slate-900 !-top-1.5"
      />

      {/* Chat bubble container */}
      <div 
        className={cn(
          "relative rounded-2xl shadow-xl transition-all overflow-hidden",
          "bg-gradient-to-br from-emerald-500 to-emerald-600",
          selected && "ring-2 ring-white/30 ring-offset-2 ring-offset-slate-900"
        )}
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
      >
        {/* Bubble tail */}
        <div className="absolute -bottom-1 right-4 w-4 h-4 bg-emerald-600 transform rotate-45" />
        
        {/* Message content */}
        <div className="relative p-4">
          {/* Header label */}
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/20">
            <MessageCircle className="w-4 h-4 text-white/80" />
            <span className="text-xs font-medium text-white/80 uppercase tracking-wide">
              Mensagem
            </span>
            {data.nodeIndex !== undefined && data.nodeIndex > 0 && (
              <span className="ml-auto flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-[10px] font-bold text-white">
                {data.nodeIndex}
              </span>
            )}
          </div>

          {/* Editable message area */}
          {isEditing ? (
            <div className="space-y-3">
              <textarea
                ref={textareaRef}
                value={localMessage}
                onChange={(e) => setLocalMessage(e.target.value)}
                onBlur={saveChanges}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsEditing(false);
                  }
                }}
                placeholder="Digite sua mensagem..."
                className="w-full bg-white/10 text-white placeholder-white/50 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-white/30 min-h-[60px]"
                autoFocus
              />
            </div>
          ) : (
            <p className={cn(
              "text-sm text-white leading-relaxed min-h-[40px]",
              !localMessage && "italic opacity-60"
            )}>
              {localMessage || "Clique para escrever sua mensagem..."}
            </p>
          )}
        </div>

        {/* Quick Reply Buttons */}
        {(hasButtons || isEditing) && (
          <div className="px-4 pb-4 space-y-2">
            <div className="border-t border-white/20 pt-3 space-y-2">
              {localButtons.map((btn, index) => (
                <div key={index} className="relative group">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={btn}
                        onChange={(e) => updateButton(index, e.target.value)}
                        onBlur={saveChanges}
                        placeholder={`Botão ${index + 1}`}
                        maxLength={20}
                        className="flex-1 bg-white/20 text-white placeholder-white/50 rounded-xl px-4 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-white/30"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeButton(index);
                        }}
                        className="p-1.5 rounded-full bg-red-500/80 text-white hover:bg-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="bg-white/20 backdrop-blur-sm text-white rounded-xl px-4 py-2.5 text-sm text-center font-medium hover:bg-white/30 transition-colors cursor-pointer">
                        {btn || `Botão ${index + 1}`}
                      </div>
                      {/* Handle for each button */}
                      <Handle
                        type="source"
                        position={Position.Bottom}
                        id={`btn-${index}`}
                        className="!w-2.5 !h-2.5 !bg-white !border-2 !border-emerald-600 !-bottom-1 !left-1/2 !-translate-x-1/2"
                        style={{ position: 'absolute', left: '50%', bottom: '-6px' }}
                      />
                    </div>
                  )}
                </div>
              ))}
              
              {/* Add button - only in edit mode */}
              {isEditing && localButtons.length < 3 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addButton();
                  }}
                  className="w-full bg-white/10 hover:bg-white/20 text-white/70 rounded-xl px-4 py-2.5 text-sm text-center transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar botão
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Default source handle - only if no buttons */}
      {!hasButtons && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-slate-900 !-bottom-1.5"
        />
      )}
    </div>
  );
}

// ============================================
// START NODE - Clean trigger indicator
// ============================================
function StartNodeComponent({ data, selected }: { data: BaseNodeData; selected?: boolean }) {
  return (
    <div className={cn(
      "relative w-[180px] transition-all",
      selected && "scale-[1.02]"
    )}>
      <div className={cn(
        "flex items-center gap-3 px-5 py-4 rounded-2xl",
        "bg-gradient-to-r from-emerald-500 to-teal-500",
        "shadow-lg shadow-emerald-500/25",
        selected && "ring-2 ring-white/30 ring-offset-2 ring-offset-slate-900"
      )}>
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm">
          <Play className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-sm font-semibold text-white">Início</span>
          <p className="text-xs text-white/70">Gatilho</p>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-emerald-400 !border-2 !border-slate-900 !-bottom-1.5"
      />
    </div>
  );
}

// ============================================
// TEMPLATE NODE - Meta template selector (inline)
// ============================================
function TemplateNodeComponent({ data, selected }: { data: BaseNodeData; selected?: boolean }) {
  const config = data.config || {};
  const templateName = config.template_name as string;

  return (
    <div className={cn(
      "relative min-w-[280px] transition-all",
      selected && "scale-[1.02]"
    )}>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-slate-500 !border-2 !border-slate-900 !-top-1.5"
      />

      <div 
        className={cn(
          "rounded-2xl overflow-hidden shadow-xl cursor-pointer",
          "bg-gradient-to-br from-violet-500 to-purple-600",
          selected && "ring-2 ring-white/30 ring-offset-2 ring-offset-slate-900"
        )}
        onClick={data.onConfigure}
      >
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/20">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium text-white/80 uppercase tracking-wide">
              Template Meta
            </span>
            {data.nodeIndex !== undefined && data.nodeIndex > 0 && (
              <span className="ml-auto flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-[10px] font-bold text-white">
                {data.nodeIndex}
              </span>
            )}
          </div>
          
          {templateName ? (
            <div className="bg-white/10 rounded-xl px-4 py-3">
              <p className="text-sm text-white font-medium">{templateName}</p>
              <p className="text-xs text-white/60 mt-1">Template aprovado</p>
            </div>
          ) : (
            <div className="bg-white/10 rounded-xl px-4 py-3 text-center">
              <Sparkles className="w-5 h-5 text-white/60 mx-auto mb-1" />
              <p className="text-xs text-white/60">Clique para selecionar</p>
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-violet-400 !border-2 !border-slate-900 !-bottom-1.5"
      />
    </div>
  );
}

// ============================================
// MEDIA NODE - Visual media preview
// ============================================
function MediaNodeComponent({ data, selected }: { data: BaseNodeData; selected?: boolean }) {
  const config = data.config || {};
  const mediaType = config.media_type as string;
  const mediaUrl = config.media_url as string;

  const getMediaIcon = () => {
    switch (mediaType) {
      case "image": return Image;
      case "video": return Image;
      case "audio": return MessageSquare;
      default: return FileText;
    }
  };
  const MediaIcon = getMediaIcon();

  return (
    <div className={cn(
      "relative min-w-[280px] transition-all",
      selected && "scale-[1.02]"
    )}>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-slate-500 !border-2 !border-slate-900 !-top-1.5"
      />

      <div 
        className={cn(
          "rounded-2xl overflow-hidden shadow-xl cursor-pointer",
          "bg-gradient-to-br from-orange-500 to-amber-600",
          selected && "ring-2 ring-white/30 ring-offset-2 ring-offset-slate-900"
        )}
        onClick={data.onConfigure}
      >
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/20">
              <Image className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium text-white/80 uppercase tracking-wide">
              Mídia
            </span>
            {data.nodeIndex !== undefined && data.nodeIndex > 0 && (
              <span className="ml-auto flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-[10px] font-bold text-white">
                {data.nodeIndex}
              </span>
            )}
          </div>
          
          {mediaUrl ? (
            <div className="bg-white/10 rounded-xl p-3">
              {mediaType === "image" && (
                <img 
                  src={mediaUrl} 
                  alt="Preview" 
                  className="w-full h-24 object-cover rounded-lg"
                />
              )}
              {mediaType !== "image" && (
                <div className="flex items-center gap-3">
                  <MediaIcon className="w-8 h-8 text-white/80" />
                  <div>
                    <p className="text-sm text-white font-medium capitalize">{mediaType}</p>
                    <p className="text-xs text-white/60">Arquivo configurado</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white/10 rounded-xl px-4 py-6 text-center">
              <MediaIcon className="w-8 h-8 text-white/40 mx-auto mb-2" />
              <p className="text-xs text-white/60">Clique para enviar mídia</p>
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-orange-400 !border-2 !border-slate-900 !-bottom-1.5"
      />
    </div>
  );
}

// ============================================
// DELAY NODE - Clean timer display
// ============================================
function DelayNodeComponent({ data, selected }: { data: BaseNodeData; selected?: boolean }) {
  const config = data.config || {};
  const delayValue = config.delay_value as number;
  const delayUnit = config.delay_unit as string;
  const smartDelay = config.smart_delay as boolean;

  const unitLabels: Record<string, string> = {
    seconds: "seg",
    minutes: "min", 
    hours: "h",
    days: "dias"
  };

  return (
    <div className={cn(
      "relative min-w-[200px] transition-all",
      selected && "scale-[1.02]"
    )}>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-slate-500 !border-2 !border-slate-900 !-top-1.5"
      />

      <div 
        className={cn(
          "rounded-2xl overflow-hidden shadow-xl cursor-pointer",
          "bg-gradient-to-br from-amber-500 to-yellow-600",
          selected && "ring-2 ring-white/30 ring-offset-2 ring-offset-slate-900"
        )}
        onClick={data.onConfigure}
      >
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-white/80" />
            <span className="text-xs font-medium text-white/80 uppercase tracking-wide">
              Pausar
            </span>
          </div>
          
          {delayValue ? (
            <div className="bg-white/20 rounded-xl px-4 py-3">
              <p className="text-2xl font-bold text-white">
                {delayValue} <span className="text-sm">{unitLabels[delayUnit] || delayUnit}</span>
              </p>
              {smartDelay && (
                <p className="text-xs text-white/70 mt-1">⚡ Intervalo inteligente</p>
              )}
            </div>
          ) : (
            <div className="bg-white/10 rounded-xl px-4 py-3">
              <p className="text-xs text-white/60">Definir tempo</p>
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-amber-400 !border-2 !border-slate-900 !-bottom-1.5"
      />
    </div>
  );
}

// ============================================
// WAIT RESPONSE NODE - Waiting indicator
// ============================================
function WaitResponseNodeComponent({ data, selected }: { data: BaseNodeData; selected?: boolean }) {
  const config = data.config || {};
  const hasTimeout = config.has_timeout as boolean;
  const timeout = config.timeout as number;
  const keywords = config.keywords as string;

  return (
    <div className={cn(
      "relative min-w-[240px] transition-all",
      selected && "scale-[1.02]"
    )}>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-slate-500 !border-2 !border-slate-900 !-top-1.5"
      />

      <div 
        className={cn(
          "rounded-2xl overflow-hidden shadow-xl cursor-pointer",
          "bg-gradient-to-br from-pink-500 to-rose-600",
          selected && "ring-2 ring-white/30 ring-offset-2 ring-offset-slate-900"
        )}
        onClick={data.onConfigure}
      >
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/20">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium text-white/80 uppercase tracking-wide">
              Aguardar Resposta
            </span>
          </div>
          
          <div className="space-y-2">
            {keywords && (
              <div className="bg-white/10 rounded-xl px-3 py-2">
                <p className="text-xs text-white/60">Palavras-chave:</p>
                <p className="text-sm text-white truncate">{keywords}</p>
              </div>
            )}
            {hasTimeout && timeout && (
              <div className="bg-white/10 rounded-xl px-3 py-2">
                <p className="text-xs text-white/60">Timeout: {timeout}h</p>
              </div>
            )}
            {!keywords && !hasTimeout && (
              <div className="bg-white/10 rounded-xl px-3 py-2 text-center">
                <p className="text-xs text-white/60">Aguardar qualquer resposta</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Multiple outputs for wait_response */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="response"
        className="!w-3 !h-3 !bg-pink-400 !border-2 !border-slate-900 !-bottom-1.5 !left-[30%]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="timeout"
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-slate-900 !-bottom-1.5 !left-[70%]"
      />
    </div>
  );
}

// ============================================
// CONDITION NODE - Branch logic
// ============================================
function ConditionNodeComponent({ data, selected }: { data: BaseNodeData; selected?: boolean }) {
  const config = data.config || {};
  const field = config.field as string;
  const operator = config.operator as string;

  return (
    <div className={cn(
      "relative min-w-[220px] transition-all",
      selected && "scale-[1.02]"
    )}>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-slate-500 !border-2 !border-slate-900 !-top-1.5"
      />

      <div 
        className={cn(
          "rounded-2xl overflow-hidden shadow-xl cursor-pointer",
          "bg-gradient-to-br from-indigo-500 to-blue-600",
          selected && "ring-2 ring-white/30 ring-offset-2 ring-offset-slate-900"
        )}
        onClick={data.onConfigure}
      >
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/20">
              <GitBranch className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium text-white/80 uppercase tracking-wide">
              Condição
            </span>
          </div>
          
          {field && operator ? (
            <div className="bg-white/10 rounded-xl px-4 py-3 text-center">
              <p className="text-sm text-white">Se <strong>{field}</strong> {operator}</p>
            </div>
          ) : (
            <div className="bg-white/10 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-white/60">Definir condição</p>
            </div>
          )}
        </div>

        {/* Yes/No labels */}
        <div className="flex justify-between px-6 pb-3">
          <span className="text-xs font-medium text-emerald-300">✓ Sim</span>
          <span className="text-xs font-medium text-red-300">✗ Não</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        className="!w-3 !h-3 !bg-emerald-400 !border-2 !border-slate-900 !-bottom-1.5 !left-[25%]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        className="!w-3 !h-3 !bg-red-400 !border-2 !border-slate-900 !-bottom-1.5 !left-[75%]"
      />
    </div>
  );
}

// ============================================
// END NODE - Flow terminator
// ============================================
function EndNodeComponent({ data, selected }: { data: BaseNodeData; selected?: boolean }) {
  const config = data.config || {};
  const addTag = config.add_tag as boolean;
  const tagName = config.tag_name as string;

  return (
    <div className={cn(
      "relative min-w-[180px] transition-all",
      selected && "scale-[1.02]"
    )}>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-slate-500 !border-2 !border-slate-900 !-top-1.5"
      />

      <div 
        className={cn(
          "rounded-2xl overflow-hidden shadow-xl cursor-pointer",
          "bg-gradient-to-br from-slate-600 to-slate-700",
          selected && "ring-2 ring-white/30 ring-offset-2 ring-offset-slate-900"
        )}
        onClick={data.onConfigure}
      >
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Flag className="w-5 h-5 text-white/80" />
            <span className="text-sm font-medium text-white">Fim</span>
          </div>
          
          {addTag && tagName && (
            <div className="bg-white/10 rounded-lg px-3 py-1.5 mt-2">
              <p className="text-xs text-white/70">Tag: {tagName}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// EXPORTS
// ============================================
export const StartNode = memo(({ data, selected }: NodeProps) => (
  <StartNodeComponent data={data as BaseNodeData} selected={selected} />
));

export const MessageNode = memo(({ data, selected }: NodeProps) => (
  <ChatMessageNode data={data as BaseNodeData} selected={selected} />
));

export const TemplateNode = memo(({ data, selected }: NodeProps) => (
  <TemplateNodeComponent data={data as BaseNodeData} selected={selected} />
));

export const MediaNode = memo(({ data, selected }: NodeProps) => (
  <MediaNodeComponent data={data as BaseNodeData} selected={selected} />
));

export const DelayNode = memo(({ data, selected }: NodeProps) => (
  <DelayNodeComponent data={data as BaseNodeData} selected={selected} />
));

export const WaitResponseNode = memo(({ data, selected }: NodeProps) => (
  <WaitResponseNodeComponent data={data as BaseNodeData} selected={selected} />
));

export const ConditionNode = memo(({ data, selected }: NodeProps) => (
  <ConditionNodeComponent data={data as BaseNodeData} selected={selected} />
));

export const EndNode = memo(({ data, selected }: NodeProps) => (
  <EndNodeComponent data={data as BaseNodeData} selected={selected} />
));

// Export node types for React Flow
export const flowNodeTypes = {
  start: StartNode,
  message: MessageNode,
  template: TemplateNode,
  media: MediaNode,
  delay: DelayNode,
  wait_response: WaitResponseNode,
  condition: ConditionNode,
  end: EndNode,
};

// Export node info for toolbar
export const availableNodeTypes = [
  { type: "message", icon: MessageCircle, label: "Mensagem", bgColor: "bg-emerald-500" },
  { type: "template", icon: FileText, label: "Template Meta", bgColor: "bg-violet-500" },
  { type: "media", icon: Image, label: "Mídia", bgColor: "bg-orange-500" },
  { type: "delay", icon: Clock, label: "Pausar", bgColor: "bg-amber-500" },
  { type: "wait_response", icon: MessageSquare, label: "Aguardar Resposta", bgColor: "bg-pink-500" },
  { type: "condition", icon: GitBranch, label: "Condição", bgColor: "bg-indigo-500" },
  { type: "end", icon: Flag, label: "Fim", bgColor: "bg-slate-500" },
] as const;
