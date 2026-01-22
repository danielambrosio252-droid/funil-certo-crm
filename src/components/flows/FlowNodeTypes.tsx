import { memo } from "react";
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
  Trash2,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BaseNodeData {
  label?: string;
  config?: Record<string, unknown>;
  onConfigure?: () => void;
  nodeIndex?: number;
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

// Kommo-style Message Node with inline editing and button handles
function KommoMessageNode({ data, selected }: { data: BaseNodeData; selected?: boolean }) {
  const config = data.config || {};
  const message = config.message as string || "";
  const buttons = (config.buttons as string[]) || [];
  const useTemplate = config.use_template as boolean;
  const templateName = config.template_name as string;
  const nodeIndex = data.nodeIndex;

  const hasButtons = buttons.length > 0 && buttons.some(b => b?.trim());
  const validButtons = buttons.filter(b => b?.trim());

  // Calculate handle positions for buttons
  const getButtonHandleTop = (index: number, total: number) => {
    // Distribute handles evenly in the buttons section
    const baseOffset = 100; // Start after header + message area
    const spacing = 32; // Spacing between button handles
    return baseOffset + (index * spacing);
  };

  return (
    <div
      className={cn(
        "relative min-w-[280px] max-w-[320px] rounded-lg border-2 bg-sky-50 dark:bg-sky-950/30 shadow-xl transition-all cursor-pointer",
        "border-sky-200 dark:border-sky-800",
        "hover:shadow-2xl",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
      onClick={data.onConfigure}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-sky-100 dark:bg-sky-900/50 rounded-t-md border-b border-sky-200 dark:border-sky-800">
        {nodeIndex !== undefined && nodeIndex > 0 && (
          <span className="flex items-center justify-center w-5 h-5 rounded bg-sky-500 text-[10px] font-bold text-white">
            {nodeIndex}
          </span>
        )}
        <span className="text-xs font-medium text-sky-700 dark:text-sky-300">
          Enviar m...
        </span>
      </div>

      {/* Message Input Area - Kommo Style */}
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-card rounded-lg border border-sky-200 dark:border-sky-700 min-h-[40px]">
          <MessageCircle className="w-4 h-4 text-sky-500 shrink-0" />
          <span className="text-sm text-muted-foreground flex-1 truncate">
            {useTemplate && templateName ? (
              <span className="text-sky-600 dark:text-sky-400 font-medium">
                📋 {templateName}
              </span>
            ) : message ? (
              <span className="text-foreground">{message.slice(0, 40)}{message.length > 40 ? "..." : ""}</span>
            ) : (
              <span className="italic">Escreva algo ou escolha um <span className="underline text-sky-500">modelo</span></span>
            )}
          </span>
        </div>

        {/* Buttons Section - Each button is draggable with its own handle */}
        {hasButtons && (
          <div className="space-y-1">
            {validButtons.map((btn, index) => (
              <div 
                key={index}
                className="flex items-center gap-2 px-3 py-1.5 bg-sky-100 dark:bg-sky-900/50 rounded border border-dashed border-sky-300 dark:border-sky-700"
              >
                <GripVertical className="w-3 h-3 text-sky-400" />
                <span className="text-xs font-medium text-sky-700 dark:text-sky-300 flex-1 truncate">
                  {btn}
                </span>
                <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              </div>
            ))}
          </div>
        )}

        {/* Add Button hint */}
        <button className="flex items-center gap-1 text-xs text-sky-500 hover:text-sky-600 transition-colors">
          <Plus className="w-3 h-3" />
          Botão de ação
        </button>
      </div>

      {/* Bottom Output Options - Kommo style */}
      <div className="border-t border-sky-200 dark:border-sky-800 text-[11px]">
        <div className="flex items-center justify-between px-3 py-1.5 text-muted-foreground hover:bg-sky-50 dark:hover:bg-sky-900/30">
          <span>Outra resposta</span>
          <div className="w-2 h-2 rounded-full bg-sky-400" />
        </div>
        <div className="flex items-center justify-between px-3 py-1.5 text-muted-foreground hover:bg-sky-50 dark:hover:bg-sky-900/30 border-t border-sky-100 dark:border-sky-800">
          <span>Sem resposta</span>
          <div className="w-2 h-2 rounded-full bg-amber-400" />
        </div>
        <div className="flex items-center justify-between px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 border-t border-sky-100 dark:border-sky-800 rounded-b-lg">
          <span>Falha ao enviar a mensagem</span>
          <div className="w-2 h-2 rounded-full bg-red-400" />
        </div>
      </div>

      {/* Input Handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-sky-500 !border-2 !border-background !-left-1.5 !top-1/4"
      />

      {/* Main output handle (default) */}
      <Handle
        type="source"
        position={Position.Right}
        id="default"
        className="!w-3 !h-3 !bg-sky-500 !border-2 !border-background !-right-1.5 !top-[60px]"
      />

      {/* Button handles - one for each button */}
      {validButtons.map((_, index) => (
        <Handle
          key={`btn-${index}`}
          type="source"
          position={Position.Right}
          id={`button-${index}`}
          style={{ top: `${100 + (index * 28)}px` }}
          className="!w-2.5 !h-2.5 !bg-sky-400 !border-2 !border-background !-right-1"
        />
      ))}

      {/* Special output handles */}
      <Handle
        type="source"
        position={Position.Right}
        id="other_response"
        className="!w-2.5 !h-2.5 !bg-sky-400 !border-2 !border-background !-right-1"
        style={{ bottom: "60px", top: "auto" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="no_response"
        className="!w-2.5 !h-2.5 !bg-amber-400 !border-2 !border-background !-right-1"
        style={{ bottom: "36px", top: "auto" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="send_failed"
        className="!w-2.5 !h-2.5 !bg-red-400 !border-2 !border-background !-right-1"
        style={{ bottom: "12px", top: "auto" }}
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
