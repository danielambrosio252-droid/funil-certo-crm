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
    borderColor: "border-emerald-400",
    badgeColor: "bg-emerald-500",
    label: "Iniciar robô",
  },
  message: {
    icon: MessageCircle,
    bgColor: "bg-sky-500",
    borderColor: "border-sky-400",
    badgeColor: "bg-sky-500",
    label: "Enviar mensagem",
  },
  template: {
    icon: FileText,
    bgColor: "bg-violet-500",
    borderColor: "border-violet-400",
    badgeColor: "bg-violet-500",
    label: "Template Meta",
  },
  media: {
    icon: Image,
    bgColor: "bg-orange-500",
    borderColor: "border-orange-400",
    badgeColor: "bg-orange-500",
    label: "Enviar mídia",
  },
  delay: {
    icon: Clock,
    bgColor: "bg-amber-500",
    borderColor: "border-amber-400",
    badgeColor: "bg-amber-500",
    label: "Pausar",
  },
  wait_response: {
    icon: Pause,
    bgColor: "bg-pink-500",
    borderColor: "border-pink-400",
    badgeColor: "bg-pink-500",
    label: "Aguardar resposta",
  },
  condition: {
    icon: GitBranch,
    bgColor: "bg-indigo-500",
    borderColor: "border-indigo-400",
    badgeColor: "bg-indigo-500",
    label: "Condição",
  },
  end: {
    icon: CheckCircle,
    bgColor: "bg-slate-500",
    borderColor: "border-slate-400",
    badgeColor: "bg-slate-500",
    label: "Fim",
  },
};

// Base node wrapper component - VERTICAL flow professional design
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
        "relative w-[280px] rounded-xl border-2 bg-slate-800/95 backdrop-blur-sm shadow-2xl transition-all cursor-pointer",
        "hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] hover:scale-[1.01]",
        style.borderColor,
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-slate-900 scale-[1.01]"
      )}
      onClick={data.onConfigure}
    >
      {/* Top header with color accent */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-t-[10px]",
        style.bgColor
      )}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm shrink-0">
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {nodeIndex !== undefined && nodeIndex > 0 && (
              <span className="flex items-center justify-center w-5 h-5 rounded-md bg-white/25 text-[11px] font-bold text-white">
                {nodeIndex}
              </span>
            )}
            <span className="text-sm font-semibold text-white truncate">
              {type === "start" ? "Início" : getNodeTypeLabel(type)}
            </span>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="p-4">
        <p className="text-sm font-medium text-slate-200 mb-1">{label}</p>
        {data.config && Object.keys(data.config).length > 0 && (
          <p className="text-xs text-slate-400 truncate">
            {getConfigPreview(type, data.config)}
          </p>
        )}
        {(!data.config || Object.keys(data.config).length === 0) && type !== "start" && (
          <p className="text-xs text-slate-500 italic">
            Clique para configurar
          </p>
        )}
      </div>

      {/* Handles - positioned for VERTICAL flow (Top/Bottom) */}
      {showTargetHandle && type !== "start" && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-slate-400 !border-2 !border-slate-900 !-top-1.5"
        />
      )}

      {showSourceHandle && type !== "end" && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-slate-400 !border-2 !border-slate-900 !-bottom-1.5"
        />
      )}

      {/* Condition node has multiple outputs - vertical branching */}
      {type === "condition" && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-slate-900 !-bottom-1.5 !left-[30%]"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            className="!w-3 !h-3 !bg-red-500 !border-2 !border-slate-900 !-bottom-1.5 !left-[70%]"
          />
        </>
      )}
    </div>
  );
}

function getNodeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    message: "Mensagem",
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
      return config.message ? String(config.message).slice(0, 40) + "..." : "";
    case "template":
      return config.template_name ? String(config.template_name) : "";
    case "media":
      if (config.media_url) {
        const typeLabel = { image: "Imagem", video: "Vídeo", audio: "Áudio", document: "Documento" }[config.media_type as string] || "Mídia";
        return `${typeLabel} configurada`;
      }
      return "";
    case "delay":
      if (config.delay_value && config.delay_unit) {
        const unitLabel = { seconds: "seg", minutes: "min", hours: "h", days: "dias" }[config.delay_unit as string] || "";
        const smartLabel = config.smart_delay ? " (inteligente)" : "";
        return `Cronômetro: ${config.delay_value} ${unitLabel}${smartLabel}`;
      }
      return "";
    case "wait_response":
      if (config.has_timeout && config.timeout) {
        const unitLabel = { minutes: "min", hours: "h", days: "dias" }[config.timeout_unit as string] || "h";
        return `Timeout: ${config.timeout} ${unitLabel}`;
      }
      return config.keywords ? `Keywords: ${String(config.keywords).slice(0, 20)}...` : "";
    case "condition":
      if (config.field && config.operator) {
        const fieldLabel = { last_message: "Msg", contact_name: "Nome", tag: "Tag", stage: "Etapa" }[config.field as string] || config.field;
        return `Se ${fieldLabel} ${config.operator}`;
      }
      return "";
    case "end":
      if (config.add_tag) return `Tag: ${config.tag_name || "..."}`;
      if (config.move_stage) return "Mover etapa";
      return "";
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
