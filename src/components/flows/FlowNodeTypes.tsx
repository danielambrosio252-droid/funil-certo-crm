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

// Base node wrapper component - Kommo-style professional design
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

      {/* Handles - positioned for horizontal flow */}
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
  <BaseNode type="message" data={data as BaseNodeData} selected={selected} />
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

// Export node info for toolbar (Kommo style menu)
export const availableNodeTypes = [
  { type: "message", ...nodeStyles.message },
  { type: "template", ...nodeStyles.template },
  { type: "media", ...nodeStyles.media },
  { type: "delay", ...nodeStyles.delay },
  { type: "wait_response", ...nodeStyles.wait_response },
  { type: "condition", ...nodeStyles.condition },
  { type: "end", ...nodeStyles.end },
] as const;
