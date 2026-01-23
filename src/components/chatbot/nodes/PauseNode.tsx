import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pause, Trash2, Plus, MessageSquare } from "lucide-react";
import { BlockSelectionMenu } from "../menus/BlockSelectionMenu";
import { NodeType } from "@/hooks/useChatbotFlows";

interface PauseNodeData {
  onUpdate?: (config: Record<string, unknown>) => void;
  onDelete?: () => void;
  onAddNode?: (nodeType: NodeType, sourceNodeId: string) => void;
}

function PauseNode({ id, data }: NodeProps) {
  const nodeData = data as PauseNodeData;
  const [showMenu, setShowMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleSelectBlock = (type: NodeType) => {
    nodeData?.onAddNode?.(type, id);
    setShowMenu(false);
  };

  return (
    <Card className="w-[260px] bg-white border shadow-lg rounded-2xl overflow-visible">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-slate-400 !border-2 !border-white"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600">
        <div className="flex items-center gap-2">
          <Pause className="w-4 h-4 text-white" />
          <span className="font-medium text-white text-sm">Pausa</span>
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

      <CardContent className="p-4">
        <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
            <MessageSquare className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">Aguardar mensagem</p>
            <p className="text-xs text-slate-500">
              O fluxo continuará quando o contato enviar uma mensagem
            </p>
          </div>
        </div>
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
          className="!w-4 !h-4 !bg-orange-400 !border-2 !border-white transition-all"
        />
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className={`
            absolute top-1/2 -translate-y-1/2 left-3
            w-6 h-6 rounded-full bg-orange-500 hover:bg-orange-600
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

export default memo(PauseNode);
