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
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BaseNodeData {
  label?: string;
  config?: Record<string, unknown>;
  onConfigure?: () => void;
}

const nodeStyles = {
  start: {
    icon: Play,
    color: "bg-emerald-500",
    borderColor: "border-emerald-400",
    label: "Início",
  },
  message: {
    icon: MessageCircle,
    color: "bg-blue-500",
    borderColor: "border-blue-400",
    label: "Mensagem",
  },
  template: {
    icon: FileText,
    color: "bg-purple-500",
    borderColor: "border-purple-400",
    label: "Template Meta",
  },
  media: {
    icon: Image,
    color: "bg-orange-500",
    borderColor: "border-orange-400",
    label: "Mídia",
  },
  delay: {
    icon: Clock,
    color: "bg-amber-500",
    borderColor: "border-amber-400",
    label: "Aguardar",
  },
  wait_response: {
    icon: Pause,
    color: "bg-pink-500",
    borderColor: "border-pink-400",
    label: "Aguardar Resposta",
  },
  condition: {
    icon: GitBranch,
    color: "bg-indigo-500",
    borderColor: "border-indigo-400",
    label: "Condição",
  },
  end: {
    icon: CheckCircle,
    color: "bg-gray-500",
    borderColor: "border-gray-400",
    label: "Fim",
  },
};

// Base node wrapper component
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

  return (
    <div
      className={cn(
        "px-4 py-3 min-w-[180px] rounded-xl border-2 bg-card shadow-lg transition-all cursor-pointer",
        style.borderColor,
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
      onClick={data.onConfigure}
    >
      {showTargetHandle && type !== "start" && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
        />
      )}
      
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg", style.color)}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{label}</p>
          {data.config && Object.keys(data.config).length > 0 && (
            <p className="text-xs text-muted-foreground truncate">
              {getConfigPreview(type, data.config)}
            </p>
          )}
        </div>
      </div>

      {showSourceHandle && type !== "end" && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
        />
      )}

      {/* Condition node has multiple outputs */}
      {type === "condition" && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background !left-[30%]"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            className="!w-3 !h-3 !bg-red-500 !border-2 !border-background !left-[70%]"
          />
        </>
      )}
    </div>
  );
}

// Get preview text for config
function getConfigPreview(type: string, config: Record<string, unknown>): string {
  switch (type) {
    case "message":
      return config.message ? String(config.message).slice(0, 30) + "..." : "Clique para configurar";
    case "template":
      return config.template_name ? String(config.template_name) : "Selecionar template";
    case "media":
      return config.media_type ? String(config.media_type) : "Selecionar mídia";
    case "delay":
      if (config.delay_value && config.delay_unit) {
        return `${config.delay_value} ${config.delay_unit}`;
      }
      return "Definir tempo";
    case "wait_response":
      return config.timeout ? `Timeout: ${config.timeout}h` : "Sem timeout";
    case "condition":
      return config.field ? `Se ${config.field} ${config.operator}...` : "Definir condição";
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
