import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Zap, Trash2, Plus, Loader2 } from "lucide-react";
import { BlockSelectionMenu } from "../menus/BlockSelectionMenu";
import { NodeType } from "@/hooks/useChatbotFlows";
import { useFunnels, useFunnelStages } from "@/hooks/useFunnels";

interface ActionNodeData {
  action_type?: string;
  action_value?: string;
  funnel_id?: string;
  stage_id?: string;
  onUpdate?: (config: Record<string, unknown>) => void;
  onDelete?: () => void;
  onAddNode?: (nodeType: NodeType, sourceNodeId: string) => void;
}

const actionTypes = [
  { value: "add_tag", label: "Adicionar tag" },
  { value: "remove_tag", label: "Remover tag" },
  { value: "set_variable", label: "Definir variável" },
  { value: "move_stage", label: "Mover para etapa" },
  { value: "notify_team", label: "Notificar equipe" },
];

function ActionNode({ id, data }: NodeProps) {
  const nodeData = data as ActionNodeData;
  const [actionType, setActionType] = useState(nodeData?.action_type || "add_tag");
  const [actionValue, setActionValue] = useState(nodeData?.action_value || "");
  const [selectedFunnelId, setSelectedFunnelId] = useState(nodeData?.funnel_id || "");
  const [selectedStageId, setSelectedStageId] = useState(nodeData?.stage_id || "");
  const [showMenu, setShowMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Fetch funnels and stages
  const { funnels, loadingFunnels } = useFunnels();
  const { stages, loadingStages } = useFunnelStages(selectedFunnelId || null);

  // Sync state from nodeData when it changes
  useEffect(() => {
    if (nodeData?.action_type) setActionType(nodeData.action_type);
    if (nodeData?.action_value) setActionValue(nodeData.action_value);
    if (nodeData?.funnel_id) setSelectedFunnelId(nodeData.funnel_id);
    if (nodeData?.stage_id) setSelectedStageId(nodeData.stage_id);
  }, [nodeData?.action_type, nodeData?.action_value, nodeData?.funnel_id, nodeData?.stage_id]);

  const handleUpdate = () => {
    nodeData?.onUpdate?.({ 
      action_type: actionType, 
      action_value: actionValue,
      funnel_id: selectedFunnelId,
      stage_id: selectedStageId,
    });
  };

  const handleFunnelChange = (funnelId: string) => {
    setSelectedFunnelId(funnelId);
    setSelectedStageId(""); // Reset stage when funnel changes
    nodeData?.onUpdate?.({ 
      action_type: actionType, 
      action_value: actionValue,
      funnel_id: funnelId,
      stage_id: "",
    });
  };

  const handleStageChange = (stageId: string) => {
    setSelectedStageId(stageId);
    const stage = stages.find(s => s.id === stageId);
    nodeData?.onUpdate?.({ 
      action_type: actionType, 
      action_value: stage?.name || "",
      funnel_id: selectedFunnelId,
      stage_id: stageId,
    });
  };

  const handleSelectBlock = (type: NodeType) => {
    nodeData?.onAddNode?.(type, id);
    setShowMenu(false);
  };

  const getPlaceholder = () => {
    switch (actionType) {
      case "add_tag":
      case "remove_tag":
        return "Nome da tag...";
      case "set_variable":
        return "variavel=valor";
      case "move_stage":
        return "Nome da etapa...";
      case "notify_team":
        return "Mensagem da notificação...";
      default:
        return "Valor...";
    }
  };

  const renderMoveStageConfig = () => (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Funil</Label>
        {loadingFunnels ? (
          <div className="flex items-center gap-2 h-9 px-3 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando...
          </div>
        ) : (
          <Select value={selectedFunnelId} onValueChange={handleFunnelChange}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Selecione o funil" />
            </SelectTrigger>
            <SelectContent>
              {funnels.map((funnel) => (
                <SelectItem key={funnel.id} value={funnel.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: funnel.color || "#6366f1" }}
                    />
                    {funnel.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {selectedFunnelId && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Etapa</Label>
          {loadingStages ? (
            <div className="flex items-center gap-2 h-9 px-3 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando...
            </div>
          ) : stages.length === 0 ? (
            <div className="h-9 px-3 py-2 text-sm text-muted-foreground border rounded-md">
              Nenhuma etapa encontrada
            </div>
          ) : (
            <Select value={selectedStageId} onValueChange={handleStageChange}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecione a etapa" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: stage.color || "#6366f1" }}
                      />
                      {stage.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  );

  const renderDefaultInput = () => (
    <Input
      value={actionValue}
      onChange={(e) => setActionValue(e.target.value)}
      onBlur={handleUpdate}
      placeholder={getPlaceholder()}
      className="h-9 text-sm"
    />
  );

  return (
    <Card className="w-[280px] bg-white border shadow-lg rounded-2xl overflow-visible">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-slate-400 !border-2 !border-white"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-500 to-violet-600">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-white" />
          <span className="font-medium text-white text-sm">Ação</span>
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

      <CardContent className="p-4 space-y-3">
        <Select 
          value={actionType} 
          onValueChange={(v) => { 
            setActionType(v); 
            // Reset values when changing action type
            setActionValue("");
            setSelectedFunnelId("");
            setSelectedStageId("");
            setTimeout(() => {
              nodeData?.onUpdate?.({ 
                action_type: v, 
                action_value: "",
                funnel_id: "",
                stage_id: "",
              });
            }, 0);
          }}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {actionTypes.map((action) => (
              <SelectItem key={action.value} value={action.value}>
                {action.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {actionType === "move_stage" ? renderMoveStageConfig() : renderDefaultInput()}
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
          className="!w-4 !h-4 !bg-violet-400 !border-2 !border-white transition-all"
        />
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className={`
            absolute top-1/2 -translate-y-1/2 left-3
            w-6 h-6 rounded-full bg-violet-500 hover:bg-violet-600
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

export default memo(ActionNode);
