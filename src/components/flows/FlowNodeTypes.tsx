import { memo, useState, useRef, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { 
  Play, 
  MessageCircle, 
  FileText, 
  Image, 
  Clock, 
  Pause, 
  GitBranch, 
  CheckCircle,
  Plus,
  Minus,
  X,
  GripVertical,
  Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BaseNodeData {
  label?: string;
  config?: Record<string, unknown>;
  onConfigure?: () => void;
  nodeIndex?: number;
  // Channel info passed from FlowEditor
  channelInfo?: {
    mode: 'cloud_api' | 'baileys' | null;
    phoneNumber: string | null;
    displayName: string;
  };
}

const nodeStyles = {
  start: {
    icon: Play,
    bgColor: "bg-emerald-500",
    borderColor: "border-emerald-500/30",
    badgeColor: "bg-emerald-500",
    label: "Iniciar robô",
  },
  message: {
    icon: MessageCircle,
    bgColor: "bg-sky-500",
    borderColor: "border-sky-500/30",
    badgeColor: "bg-sky-500",
    label: "Enviar mensagem",
  },
  template: {
    icon: FileText,
    bgColor: "bg-violet-500",
    borderColor: "border-violet-500/30",
    badgeColor: "bg-violet-500",
    label: "Template Meta",
  },
  media: {
    icon: Image,
    bgColor: "bg-orange-500",
    borderColor: "border-orange-500/30",
    badgeColor: "bg-orange-500",
    label: "Enviar mídia",
  },
  delay: {
    icon: Clock,
    bgColor: "bg-amber-500",
    borderColor: "border-amber-500/30",
    badgeColor: "bg-amber-500",
    label: "Pausar",
  },
  wait_response: {
    icon: Pause,
    bgColor: "bg-pink-500",
    borderColor: "border-pink-500/30",
    badgeColor: "bg-pink-500",
    label: "Aguardar resposta",
  },
  condition: {
    icon: GitBranch,
    bgColor: "bg-indigo-500",
    borderColor: "border-indigo-500/30",
    badgeColor: "bg-indigo-500",
    label: "Condição",
  },
  end: {
    icon: CheckCircle,
    bgColor: "bg-slate-500",
    borderColor: "border-slate-500/30",
    badgeColor: "bg-slate-500",
    label: "Fim",
  },
};

// Base node wrapper for non-message nodes
function BaseNode({ 
  type, 
  data, 
  selected,
  showSourceHandle = true,
  showTargetHandle = true,
}: { 
  type: keyof typeof nodeStyles;
  data: BaseNodeData;
  selected?: boolean;
  showSourceHandle?: boolean;
  showTargetHandle?: boolean;
}) {
  const style = nodeStyles[type];
  const Icon = style.icon;
  const label = data.label || style.label;
  const nodeIndex = data.nodeIndex;

  return (
    <div
      className={cn(
        "relative min-w-[220px] rounded-lg border-2 bg-card/95 backdrop-blur-sm shadow-xl transition-all cursor-pointer",
        "hover:shadow-2xl hover:scale-[1.02]",
        style.borderColor,
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.02]"
      )}
      onClick={data.onConfigure}
    >
      {/* Top header with number and title */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-t-md border-b border-border/50",
        "bg-muted/50"
      )}>
        {nodeIndex !== undefined && nodeIndex > 0 && (
          <span className={cn(
            "flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold text-white",
            style.badgeColor
          )}>
            {nodeIndex}
          </span>
        )}
        <span className="text-xs font-medium text-muted-foreground truncate">
          {type === "start" ? "" : getNodeTypeLabel(type)}
        </span>
      </div>

      {/* Main content area */}
      <div className="p-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
            style.bgColor
          )}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{label}</p>
            {data.config && Object.keys(data.config).length > 0 && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {getConfigPreview(type, data.config)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Handles */}
      {showTargetHandle && type !== "start" && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background !-left-1.5"
        />
      )}

      {showSourceHandle && type !== "end" && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background !-right-1.5"
        />
      )}

      {/* Condition node has multiple outputs */}
      {type === "condition" && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="yes"
            className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background !-right-1.5 !top-[35%]"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="no"
            className="!w-3 !h-3 !bg-red-500 !border-2 !border-background !-right-1.5 !top-[65%]"
          />
        </>
      )}
    </div>
  );
}

// Kommo-style Message Node - exact replica of Kommo CRM style
function KommoMessageNode({ data, selected }: { data: BaseNodeData; selected?: boolean }) {
  const config = data.config || {};
  const message = config.message as string || "";
  const buttons = (config.buttons as string[]) || [];
  const useTemplate = config.use_template as boolean;
  const templateName = config.template_name as string;
  const nodeIndex = data.nodeIndex;

  const validButtons = buttons.filter(b => b?.trim());

  // Reference for measuring content height
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className={cn(
        "relative rounded-lg shadow-lg transition-all cursor-pointer",
        "bg-[#1a3a4a] dark:bg-[#1a3a4a] border border-[#2d5a6e]",
        "hover:shadow-xl",
        selected && "ring-2 ring-sky-400 ring-offset-2 ring-offset-[#0d1f29]"
      )}
      style={{ minWidth: 300, maxWidth: 380 }}
    >
      {/* Header - Kommo style with real channel info */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-t-lg bg-[#0d1f29]/50 border-b border-[#2d5a6e]">
        {nodeIndex !== undefined && nodeIndex > 0 && (
          <span className="flex items-center justify-center w-5 h-5 rounded bg-[#2d5a6e] text-[10px] font-bold text-white">
            {nodeIndex}
          </span>
        )}
        <span className="text-xs text-[#7eb8d0]">
          Enviar m...
        </span>
        <span className="text-[10px] text-[#5a8fa8] ml-auto">
          Canal: <span className="font-medium text-white">
            {data.channelInfo?.displayName || 'Não configurado'}
          </span>
          {data.channelInfo?.mode && (
            <span className={cn(
              "ml-1 px-1.5 py-0.5 rounded text-[9px] font-medium",
              data.channelInfo.mode === 'cloud_api' 
                ? "bg-green-500/20 text-green-400" 
                : "bg-blue-500/20 text-blue-400"
            )}>
              {data.channelInfo.mode === 'cloud_api' ? 'API' : 'Web'}
            </span>
          )}
        </span>
      </div>

      {/* Main Content Area */}
      <div 
        ref={contentRef}
        className="p-3 bg-[#2a5a6a]/30"
        onClick={data.onConfigure}
      >
        {/* Message input - Kommo style with icon and clip */}
        <div className="flex items-start gap-2 mb-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#3d7a8a] shrink-0 mt-0.5">
            <MessageCircle className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex-1 relative">
            <div 
              className={cn(
                "w-full px-3 py-2 rounded-lg bg-white/95 dark:bg-white text-sm text-slate-700",
                "min-h-[36px] break-words whitespace-pre-wrap",
                "focus:ring-2 focus:ring-sky-400"
              )}
              style={{
                // Auto-height based on content
                height: message.length > 60 ? 'auto' : undefined,
              }}
            >
              {useTemplate && templateName ? (
                <span className="text-sky-600 font-medium">
                  📋 {templateName}
                </span>
              ) : message ? (
                message
              ) : (
                <span className="text-slate-400 italic">
                  Escreva algo ou escolha um <span className="underline text-sky-500 cursor-pointer">modelo</span>
                </span>
              )}
            </div>
            <button className="absolute top-2 right-2 text-slate-400 hover:text-slate-600">
              <Paperclip className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Buttons Section - Kommo style with drag handles and delete */}
        <div className="space-y-1.5 ml-9">
          {validButtons.map((btn, index) => (
            <div 
              key={index}
              className="flex items-center gap-1 group"
            >
              <GripVertical className="w-3 h-3 text-[#5a8fa8] cursor-grab" />
              <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded bg-[#3d7a8a] border border-dashed border-[#5a9fb8]">
                <span className="text-xs font-medium text-white flex-1">
                  {btn}
                </span>
              </div>
              {/* Delete button */}
              <button 
                className="p-1 text-[#5a8fa8] hover:text-red-400 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  // Delete logic would go here
                }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
              {/* + sinônimo text */}
              <span className="text-[10px] text-[#5a8fa8] whitespace-nowrap">+ sinônimo</span>
            </div>
          ))}
          
          {/* Add button action */}
          <button 
            className="flex items-center gap-1 text-xs text-[#5ab8d8] hover:text-sky-300 transition-colors py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Plus className="w-3 h-3" />
            Botão de ação
          </button>
        </div>
      </div>

      {/* Bottom Output Options - Kommo style with +/- icons */}
      <div className="border-t border-[#2d5a6e] bg-[#1a3a4a] rounded-b-lg">
        <div className="flex items-center justify-end gap-3 px-3 py-1.5 text-[11px] text-[#7eb8d0] border-b border-[#2d5a6e]/50">
          <span>Outra resposta</span>
          <button className="w-4 h-4 rounded-full border border-[#5a8fa8] flex items-center justify-center hover:bg-[#2d5a6e] transition-colors">
            <Minus className="w-2.5 h-2.5 text-[#5a8fa8]" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-3 px-3 py-1.5 text-[11px] text-[#7eb8d0] border-b border-[#2d5a6e]/50">
          <span>Sem resposta</span>
          <button className="w-4 h-4 rounded-full border border-[#5a8fa8] flex items-center justify-center hover:bg-[#2d5a6e] transition-colors">
            <Minus className="w-2.5 h-2.5 text-[#5a8fa8]" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-3 px-3 py-1.5 text-[11px] text-red-400 rounded-b-lg">
          <span>Falha ao enviar a mensagem</span>
          <button className="w-4 h-4 rounded-full border border-red-400/50 flex items-center justify-center hover:bg-red-900/30 transition-colors">
            <Plus className="w-2.5 h-2.5 text-red-400" />
          </button>
        </div>
      </div>

      {/* Input Handle (left) - centered vertically on content */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-[#5a8fa8] !border-2 !border-[#0d1f29] !-left-1.5"
        style={{ top: '50%', transform: 'translateY(-50%)' }}
      />

      {/* Button handles - aligned with each button row */}
      {validButtons.map((_, index) => {
        // Calculate position: header (40px) + message area (60px) + buttons offset
        const topOffset = 110 + (index * 32);
        return (
          <Handle
            key={`btn-${index}`}
            type="source"
            position={Position.Right}
            id={`button-${index}`}
            className="!w-3 !h-3 !bg-[#5ab8d8] !border-2 !border-[#0d1f29] !-right-1.5"
            style={{ top: topOffset }}
          />
        );
      })}

      {/* Special output handles - aligned with bottom options */}
      <Handle
        type="source"
        position={Position.Right}
        id="other_response"
        className="!w-3 !h-3 !bg-[#5a8fa8] !border-2 !border-[#0d1f29] !-right-1.5"
        style={{ bottom: 56, top: 'auto' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="no_response"
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-[#0d1f29] !-right-1.5"
        style={{ bottom: 32, top: 'auto' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="send_failed"
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-[#0d1f29] !-right-1.5"
        style={{ bottom: 8, top: 'auto' }}
      />
    </div>
  );
}

function getNodeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    message: "Enviar m...",
    template: "Template",
    media: "Mídia",
    delay: "Pausar",
    wait_response: "Aguardar",
    condition: "Condição",
    end: "Fim",
  };
  return labels[type] || type;
}

// Get preview text for config
function getConfigPreview(type: string, config: Record<string, unknown>): string {
  switch (type) {
    case "message":
      if (config.use_template && config.template_name) {
        return `Template: ${config.template_name}`;
      }
      return config.message ? String(config.message).slice(0, 30) + "..." : "Clique para configurar";
    case "template":
      return config.template_name ? String(config.template_name) : "Selecionar template";
    case "media":
      if (config.media_url) {
        const typeLabel = { image: "Imagem", video: "Vídeo", audio: "Áudio", document: "Documento" }[config.media_type as string] || "Mídia";
        return `${typeLabel} configurada`;
      }
      return "Clique para configurar";
    case "delay":
      if (config.delay_value && config.delay_unit) {
        const unitLabel = { seconds: "seg", minutes: "min", hours: "h", days: "dias" }[config.delay_unit as string] || "";
        const smartLabel = config.smart_delay ? " (inteligente)" : "";
        return `Cronômetro: ${config.delay_value} ${unitLabel}${smartLabel}`;
      }
      return "Definir tempo";
    case "wait_response":
      if (config.has_timeout && config.timeout) {
        const unitLabel = { minutes: "min", hours: "h", days: "dias" }[config.timeout_unit as string] || "h";
        return `Timeout: ${config.timeout} ${unitLabel}`;
      }
      return config.keywords ? `Keywords: ${String(config.keywords).slice(0, 15)}...` : "Aguardar qualquer";
    case "condition":
      if (config.field && config.operator) {
        const fieldLabel = { last_message: "Msg", contact_name: "Nome", tag: "Tag", stage: "Etapa" }[config.field as string] || config.field;
        return `Se ${fieldLabel} ${config.operator}`;
      }
      return "Definir condição";
    case "end":
      if (config.add_tag) return `Tag: ${config.tag_name || "..."}`;
      if (config.move_stage) return "Mover etapa";
      return "Encerrar fluxo";
    default:
      return "";
  }
}

// Individual node components
export const StartNode = memo(({ data, selected }: NodeProps) => (
  <BaseNode type="start" data={data as BaseNodeData} selected={selected} showTargetHandle={false} />
));

export const MessageNode = memo(({ data, selected }: NodeProps) => (
  <KommoMessageNode data={data as BaseNodeData} selected={selected} />
));

export const TemplateNode = memo(({ data, selected }: NodeProps) => (
  <BaseNode type="template" data={data as BaseNodeData} selected={selected} />
));

export const MediaNode = memo(({ data, selected }: NodeProps) => (
  <BaseNode type="media" data={data as BaseNodeData} selected={selected} />
));

export const DelayNode = memo(({ data, selected }: NodeProps) => (
  <BaseNode type="delay" data={data as BaseNodeData} selected={selected} />
));

export const WaitResponseNode = memo(({ data, selected }: NodeProps) => (
  <BaseNode type="wait_response" data={data as BaseNodeData} selected={selected} />
));

export const ConditionNode = memo(({ data, selected }: NodeProps) => (
  <BaseNode type="condition" data={data as BaseNodeData} selected={selected} showSourceHandle={false} />
));

export const EndNode = memo(({ data, selected }: NodeProps) => (
  <BaseNode type="end" data={data as BaseNodeData} selected={selected} showSourceHandle={false} />
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
  { type: "message", ...nodeStyles.message },
  { type: "template", ...nodeStyles.template },
  { type: "media", ...nodeStyles.media },
  { type: "delay", ...nodeStyles.delay },
  { type: "wait_response", ...nodeStyles.wait_response },
  { type: "condition", ...nodeStyles.condition },
  { type: "end", ...nodeStyles.end },
] as const;
