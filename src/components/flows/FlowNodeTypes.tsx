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
        buttons: localButtons, // Keep all buttons (even empty) so they don't vanish
      });
    }
    setIsEditing(false);
  }, [data, config, localMessage, localButtons]);

  const addButton = () => {
    if (localButtons.length < 3) {
      const newButtons = [...localButtons, ""];
      setLocalButtons(newButtons);
      // Persist immediately so blur doesn't lose the new button
      if (data.onUpdateConfig) {
        data.onUpdateConfig({
          ...config,
          message: localMessage,
          buttons: newButtons,
        });
      }
    }
  };

  const updateButton = (index: number, value: string) => {
    const newButtons = [...localButtons];
    newButtons[index] = value;
    setLocalButtons(newButtons);
  };

  const removeButton = (index: number) => {
    const newButtons = localButtons.filter((_, i) => i !== index);
    setLocalButtons(newButtons);
    // Persist immediately
    if (data.onUpdateConfig) {
      data.onUpdateConfig({
        ...config,
        message: localMessage,
        buttons: newButtons,
      });
    }
  };

  const hasButtons = localButtons.length > 0;

  return (
    <div className={cn(
      "relative min-w-[320px] max-w-[380px] transition-all",
      selected && "scale-[1.01]"
    )}>
      {/* Target handle - top center - VISIBLE */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !bg-white !border-2 !border-emerald-500 !-top-2"
      />

      {/* Chat bubble container - LIGHT ON DARK - HIGH CONTRAST */}
      <div 
        className={cn(
          "relative rounded-xl overflow-visible",
          "bg-white border-2 border-slate-300",
          "shadow-[0_4px_20px_rgba(0,0,0,0.25)]",
          selected && "ring-2 ring-emerald-500 ring-offset-2 ring-offset-slate-800"
        )}
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
      >
        {/* Header - Distinct colored bar */}
        <div className="flex items-center gap-2 p-3 border-b border-slate-200 bg-emerald-50 rounded-t-xl">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-800">
            💬 Mensagem
          </span>
          {data.nodeIndex !== undefined && data.nodeIndex > 0 && (
            <span className="ml-auto flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-xs font-bold text-white">
              {data.nodeIndex}
            </span>
          )}
        </div>

        {/* Message content area - CLEAR TEXT */}
        <div className="p-4 bg-white">
          {isEditing ? (
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
              className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[60px] border-2 border-slate-300"
              autoFocus
            />
          ) : (
            <p className={cn(
              "text-sm text-slate-800 leading-relaxed min-h-[40px]",
              !localMessage && "italic text-slate-400"
            )}>
              {localMessage || "Clique para escrever sua mensagem..."}
            </p>
          )}
        </div>

        {/* Buttons Section - LIGHT THEME BUTTONS */}
        <div className="px-4 pb-4 space-y-2 bg-white rounded-b-xl">
          {/* Add button trigger */}
          {isEditing && localButtons.length < 3 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                addButton();
              }}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-lg px-3 py-2 text-xs text-center transition-colors flex items-center justify-center gap-2 border-2 border-dashed border-slate-300"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar botão
            </button>
          )}

          {/* Buttons with individual handles */}
          {localButtons.map((btn, index) => (
            <div key={index} className="relative">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center bg-slate-100 rounded-lg border-2 border-slate-300 overflow-hidden">
                    <span className="px-3 py-2 bg-slate-200 text-slate-500 text-xs">⬜</span>
                    <input
                      type="text"
                      value={btn}
                      onChange={(e) => updateButton(index, e.target.value)}
                      onBlur={saveChanges}
                      placeholder={`Botão ${index + 1}`}
                      maxLength={20}
                      className="flex-1 bg-transparent text-slate-800 placeholder-slate-400 px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeButton(index);
                    }}
                    className="p-1.5 rounded-md bg-red-100 text-red-500 hover:bg-red-200 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative flex items-center">
                  {/* Button visual - CLEAR AND VISIBLE */}
                  <div className="flex-1 flex items-center bg-slate-100 hover:bg-slate-200 rounded-lg border-2 border-slate-300 transition-colors cursor-pointer">
                    <span className="px-3 py-2.5 text-slate-500 text-sm">⬜</span>
                    <span className="flex-1 text-sm text-slate-700 font-medium pr-10">
                      {btn || `Botão ${index + 1}`}
                    </span>
                  </div>
                  
                  {/* Connection point on the right - VISIBLE HANDLE */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center">
                    <div className="w-6 h-0.5 bg-emerald-400" />
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={`btn-${index}`}
                      className="!relative !transform-none !w-4 !h-4 !bg-emerald-500 !border-2 !border-white !right-0 !shadow-md"
                      style={{ position: 'relative', right: 0, top: 0, transform: 'none' }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Default source handle - only if no buttons */}
      {!hasButtons && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-white !-bottom-2 !shadow-md"
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
      "relative w-[200px] transition-all",
      selected && "scale-[1.01]"
    )}>
      <div className={cn(
        "flex items-center gap-3 px-5 py-4 rounded-xl",
        "bg-white border-2 border-emerald-400",
        "shadow-[0_4px_20px_rgba(0,0,0,0.25)]",
        selected && "ring-2 ring-emerald-500 ring-offset-2 ring-offset-slate-800"
      )}>
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500">
          <Play className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-base font-bold text-slate-800">Início</span>
          <p className="text-xs text-slate-500">Gatilho</p>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-white !-bottom-2 !shadow-md"
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
      "relative min-w-[300px] transition-all",
      selected && "scale-[1.01]"
    )}>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !bg-violet-500 !border-2 !border-white !-top-2 !shadow-md"
      />

      <div 
        className={cn(
          "rounded-xl overflow-hidden cursor-pointer",
          "bg-white border-2 border-violet-400",
          "shadow-[0_4px_20px_rgba(0,0,0,0.25)]",
          selected && "ring-2 ring-violet-500 ring-offset-2 ring-offset-slate-800"
        )}
        onClick={data.onConfigure}
      >
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b border-slate-200 bg-violet-50">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-800">
            Template Meta
          </span>
          {data.nodeIndex !== undefined && data.nodeIndex > 0 && (
            <span className="ml-auto flex items-center justify-center w-6 h-6 rounded-full bg-violet-500 text-xs font-bold text-white">
              {data.nodeIndex}
            </span>
          )}
        </div>
        
        <div className="p-4 bg-white">
          {templateName ? (
            <div className="bg-violet-50 rounded-lg px-4 py-3 border border-violet-200">
              <p className="text-sm text-slate-800 font-medium">{templateName}</p>
              <p className="text-xs text-slate-500 mt-1">✓ Template aprovado</p>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-lg px-4 py-3 text-center border border-slate-200">
              <Sparkles className="w-5 h-5 text-violet-400 mx-auto mb-1" />
              <p className="text-xs text-slate-500">Clique para selecionar</p>
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !bg-violet-500 !border-2 !border-white !-bottom-2 !shadow-md"
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
      "relative min-w-[300px] transition-all",
      selected && "scale-[1.01]"
    )}>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !bg-orange-500 !border-2 !border-white !-top-2 !shadow-md"
      />

      <div 
        className={cn(
          "rounded-xl overflow-hidden cursor-pointer",
          "bg-white border-2 border-orange-400",
          "shadow-[0_4px_20px_rgba(0,0,0,0.25)]",
          selected && "ring-2 ring-orange-500 ring-offset-2 ring-offset-slate-800"
        )}
        onClick={data.onConfigure}
      >
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b border-slate-200 bg-orange-50">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-500">
            <Image className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-800">
            Mídia
          </span>
          {data.nodeIndex !== undefined && data.nodeIndex > 0 && (
            <span className="ml-auto flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-xs font-bold text-white">
              {data.nodeIndex}
            </span>
          )}
        </div>
        
        <div className="p-4 bg-white">
          {mediaUrl ? (
            <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
              {mediaType === "image" && (
                <img 
                  src={mediaUrl} 
                  alt="Preview" 
                  className="w-full h-24 object-cover rounded-lg"
                />
              )}
              {mediaType !== "image" && (
                <div className="flex items-center gap-3">
                  <MediaIcon className="w-8 h-8 text-orange-500" />
                  <div>
                    <p className="text-sm text-slate-800 font-medium capitalize">{mediaType}</p>
                    <p className="text-xs text-slate-500">✓ Arquivo configurado</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 rounded-lg px-4 py-6 text-center border border-slate-200">
              <MediaIcon className="w-8 h-8 text-orange-400 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Clique para enviar mídia</p>
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !bg-orange-500 !border-2 !border-white !-bottom-2 !shadow-md"
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
      "relative min-w-[220px] transition-all",
      selected && "scale-[1.01]"
    )}>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !bg-amber-500 !border-2 !border-white !-top-2 !shadow-md"
      />

      <div 
        className={cn(
          "rounded-xl overflow-hidden cursor-pointer",
          "bg-white border-2 border-amber-400",
          "shadow-[0_4px_20px_rgba(0,0,0,0.25)]",
          selected && "ring-2 ring-amber-500 ring-offset-2 ring-offset-slate-800"
        )}
        onClick={data.onConfigure}
      >
        {/* Header */}
        <div className="flex items-center justify-center gap-2 p-3 border-b border-slate-200 bg-amber-50">
          <Clock className="w-5 h-5 text-amber-600" />
          <span className="text-sm font-semibold text-slate-800">
            Pausar
          </span>
        </div>
        
        <div className="p-4 bg-white text-center">
          {delayValue ? (
            <div className="bg-amber-50 rounded-lg px-4 py-3 border border-amber-200">
              <p className="text-2xl font-bold text-slate-800">
                {delayValue} <span className="text-sm text-slate-600">{unitLabels[delayUnit] || delayUnit}</span>
              </p>
              {smartDelay && (
                <p className="text-xs text-amber-600 mt-1">⚡ Intervalo inteligente</p>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
              <p className="text-sm text-slate-500">Definir tempo</p>
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !bg-amber-500 !border-2 !border-white !-bottom-2 !shadow-md"
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
      "relative min-w-[260px] transition-all",
      selected && "scale-[1.01]"
    )}>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !bg-pink-500 !border-2 !border-white !-top-2 !shadow-md"
      />

      <div 
        className={cn(
          "rounded-xl overflow-hidden cursor-pointer",
          "bg-white border-2 border-pink-400",
          "shadow-[0_4px_20px_rgba(0,0,0,0.25)]",
          selected && "ring-2 ring-pink-500 ring-offset-2 ring-offset-slate-800"
        )}
        onClick={data.onConfigure}
      >
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b border-slate-200 bg-pink-50">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-pink-500">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-800">
            Aguardar Resposta
          </span>
        </div>
        
        <div className="p-4 bg-white space-y-2">
          {keywords && (
            <div className="bg-pink-50 rounded-lg px-3 py-2 border border-pink-200">
              <p className="text-xs text-slate-500">Palavras-chave:</p>
              <p className="text-sm text-slate-800 font-medium truncate">{keywords}</p>
            </div>
          )}
          {hasTimeout && timeout && (
            <div className="bg-pink-50 rounded-lg px-3 py-2 border border-pink-200">
              <p className="text-sm text-slate-700">⏱ Timeout: {timeout}h</p>
            </div>
          )}
          {!keywords && !hasTimeout && (
            <div className="bg-slate-50 rounded-lg px-3 py-2 text-center border border-slate-200">
              <p className="text-xs text-slate-500">Aguardar qualquer resposta</p>
            </div>
          )}
        </div>

        {/* Output labels */}
        <div className="flex justify-between px-4 pb-3 bg-white">
          <span className="text-xs font-semibold text-emerald-600">✓ Resposta</span>
          <span className="text-xs font-semibold text-slate-500">⏱ Timeout</span>
        </div>
      </div>

      {/* Multiple outputs for wait_response */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="response"
        className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-white !-bottom-2 !left-[30%] !shadow-md"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="timeout"
        className="!w-4 !h-4 !bg-slate-400 !border-2 !border-white !-bottom-2 !left-[70%] !shadow-md"
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
      "relative min-w-[240px] transition-all",
      selected && "scale-[1.01]"
    )}>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !bg-indigo-500 !border-2 !border-white !-top-2 !shadow-md"
      />

      <div 
        className={cn(
          "rounded-xl overflow-hidden cursor-pointer",
          "bg-white border-2 border-indigo-400",
          "shadow-[0_4px_20px_rgba(0,0,0,0.25)]",
          selected && "ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-800"
        )}
        onClick={data.onConfigure}
      >
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b border-slate-200 bg-indigo-50">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500">
            <GitBranch className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-800">
            Condição
          </span>
        </div>
        
        <div className="p-4 bg-white">
          {field && operator ? (
            <div className="bg-indigo-50 rounded-lg px-4 py-3 text-center border border-indigo-200">
              <p className="text-sm text-slate-800 font-medium">Se <strong>{field}</strong> {operator}</p>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-lg px-4 py-3 text-center border border-slate-200">
              <p className="text-sm text-slate-500">Definir condição</p>
            </div>
          )}
        </div>

        {/* Yes/No labels */}
        <div className="flex justify-between px-6 pb-3 bg-white">
          <span className="text-xs font-bold text-emerald-600">✓ Sim</span>
          <span className="text-xs font-bold text-red-500">✗ Não</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-white !-bottom-2 !left-[25%] !shadow-md"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        className="!w-4 !h-4 !bg-red-500 !border-2 !border-white !-bottom-2 !left-[75%] !shadow-md"
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
      selected && "scale-[1.01]"
    )}>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !bg-slate-500 !border-2 !border-white !-top-2 !shadow-md"
      />

      <div 
        className={cn(
          "rounded-xl overflow-hidden cursor-pointer",
          "bg-white border-2 border-slate-400",
          "shadow-[0_4px_20px_rgba(0,0,0,0.25)]",
          selected && "ring-2 ring-slate-500 ring-offset-2 ring-offset-slate-800"
        )}
        onClick={data.onConfigure}
      >
        {/* Header */}
        <div className="flex items-center justify-center gap-2 p-3 border-b border-slate-200 bg-slate-100">
          <Flag className="w-5 h-5 text-slate-600" />
          <span className="text-sm font-bold text-slate-700">Fim</span>
        </div>
        
        <div className="p-3 bg-white">
          {addTag && tagName && (
            <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
              <p className="text-xs text-slate-600">🏷 Tag: {tagName}</p>
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
