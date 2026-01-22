import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, UserPlus, MessageSquare, Calendar, GitBranch } from "lucide-react";
import { TriggerType } from "@/hooks/useWhatsAppFlows";

interface TriggerNodeData {
  trigger_type?: TriggerType;
  config?: Record<string, unknown>;
  onEdit?: () => void;
}

const triggerIcons: Record<TriggerType, React.ElementType> = {
  new_lead: UserPlus,
  keyword: MessageSquare,
  schedule: Calendar,
  stage_change: GitBranch,
};

const triggerColors: Record<TriggerType, string> = {
  new_lead: "bg-emerald-500",
  keyword: "bg-blue-500",
  schedule: "bg-purple-500",
  stage_change: "bg-orange-500",
};

const triggerLabels: Record<TriggerType, string> = {
  new_lead: "Novo Lead",
  keyword: "Palavra-chave",
  schedule: "Agendamento",
  stage_change: "Mudança de Etapa",
};

function TriggerNode({ data }: NodeProps) {
  const nodeData = data as TriggerNodeData;
  const triggerType = nodeData?.trigger_type;
  const Icon = triggerType ? triggerIcons[triggerType] : Zap;
  const color = triggerType ? triggerColors[triggerType] : "bg-amber-500";
  const label = triggerType ? triggerLabels[triggerType] : "Gatilho";

  return (
    <Card className="w-72 bg-white border-2 border-slate-200 shadow-xl rounded-xl cursor-pointer hover:border-primary transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground font-medium">Quando...</p>
            <p className="font-semibold text-slate-800">{label}</p>
          </div>
          <Zap className="w-4 h-4 text-amber-500" />
        </div>
        
        {triggerType === "keyword" && nodeData.config?.keywords && (
          <div className="mt-3 text-xs text-muted-foreground bg-slate-50 rounded-lg p-2">
            Palavras: {((nodeData.config.keywords as string[]) || []).slice(0, 3).join(", ")}
            {((nodeData.config.keywords as string[]) || []).length > 3 && "..."}
          </div>
        )}
      </CardContent>
      
      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-slate-400 !border-2 !border-white hover:!bg-primary hover:!scale-125 transition-all"
      />
    </Card>
  );
}

export default memo(TriggerNode);
