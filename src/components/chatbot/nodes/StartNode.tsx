import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card } from "@/components/ui/card";
import { MessageCircle, Plus } from "lucide-react";
import { BlockSelectionMenu } from "../menus/BlockSelectionMenu";
import { NodeType } from "@/hooks/useChatbotFlows";

interface StartNodeData {
  label?: string;
  hasConnections?: boolean;
  onAddNode?: (nodeType: NodeType, sourceNodeId: string) => void;
}

function StartNode({ id, data }: NodeProps) {
  const nodeData = data as StartNodeData;
  const [showMenu, setShowMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const isHighlighted = !nodeData.hasConnections;

  const handleSelectBlock = (type: NodeType) => {
    nodeData.onAddNode?.(type, id);
    setShowMenu(false);
  };

  return (
    <Card className="w-[280px] bg-gradient-to-br from-emerald-500 to-emerald-600 border-0 shadow-xl rounded-2xl overflow-visible">
      <div className="flex items-center gap-3 p-4">
        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
          <MessageCircle className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-white text-base">Início</p>
          <p className="text-sm text-white/80">Quando o contato iniciar conversa</p>
        </div>
      </div>
      
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
          className={`
            !w-5 !h-5 !border-2 !border-white !bg-emerald-400
            transition-all duration-200
            ${isHighlighted ? '!shadow-lg !shadow-emerald-300/50' : ''}
          `}
        />
        
        {/* Plus button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className={`
            absolute top-1/2 -translate-y-1/2 left-4
            w-7 h-7 rounded-full bg-white
            flex items-center justify-center
            text-emerald-600 shadow-lg
            transition-all duration-200
            hover:scale-110 hover:bg-emerald-50
            ${(isHovered || showMenu || isHighlighted) ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}
            ${isHighlighted ? 'animate-pulse' : ''}
            z-10
          `}
        >
          <Plus className="w-5 h-5" strokeWidth={3} />
        </button>

        {/* Block selection menu */}
        {showMenu && (
          <div className="absolute top-1/2 -translate-y-1/2 left-14 z-50">
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

export default memo(StartNode);
