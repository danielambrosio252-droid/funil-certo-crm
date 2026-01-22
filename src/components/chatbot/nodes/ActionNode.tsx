import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Trash2, Plus } from "lucide-react";
import { BlockSelectionMenu } from "../menus/BlockSelectionMenu";
import { NodeType } from "@/hooks/useChatbotFlows";

interface ActionNodeData {
  action_type?: string;
  action_value?: string;
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
  const [showMenu, setShowMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleUpdate = () => {
    nodeData?.onUpdate?.({ action_type: actionType, action_value: actionValue });
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
        <Select value={actionType} onValueChange={(v) => { setActionType(v); setTimeout(handleUpdate, 0); }}>
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

        <Input
          value={actionValue}
          onChange={(e) => setActionValue(e.target.value)}
          onBlur={handleUpdate}
          placeholder={getPlaceholder()}
          className="h-9 text-sm"
        />
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
