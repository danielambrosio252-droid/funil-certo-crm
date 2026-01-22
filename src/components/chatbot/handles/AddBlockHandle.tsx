import { memo, useState } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { Plus } from "lucide-react";
import { BlockSelectionMenu } from "../menus/BlockSelectionMenu";
import { NodeType } from "@/hooks/useChatbotFlows";

interface AddBlockHandleProps {
  nodeId: string;
  handleId?: string;
  position?: Position;
  isHighlighted?: boolean;
  onAddNode: (nodeType: NodeType, sourceNodeId: string, sourceHandle?: string) => void;
}

function AddBlockHandle({ 
  nodeId, 
  handleId, 
  position = Position.Right,
  isHighlighted = false,
  onAddNode 
}: AddBlockHandleProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleSelectBlock = (type: NodeType) => {
    onAddNode(type, nodeId, handleId);
    setShowMenu(false);
  };

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (!showMenu) setShowMenu(false);
      }}
    >
      <Handle
        type="source"
        position={position}
        id={handleId}
        className={`
          !w-5 !h-5 !border-2 !border-white !bg-emerald-500
          hover:!scale-125 transition-all duration-200
          ${isHighlighted ? 'animate-pulse !bg-emerald-400 !shadow-lg !shadow-emerald-500/50' : ''}
        `}
      />
      
      {/* Plus button overlay */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className={`
          absolute top-1/2 -translate-y-1/2
          ${position === Position.Right ? 'left-1' : 'right-1'}
          w-6 h-6 rounded-full bg-emerald-500 hover:bg-emerald-600
          flex items-center justify-center
          text-white shadow-lg
          transition-all duration-200
          ${(isHovered || showMenu || isHighlighted) ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}
          ${isHighlighted ? 'animate-bounce' : ''}
          z-10
        `}
      >
        <Plus className="w-4 h-4" />
      </button>

      {/* Block selection menu */}
      {showMenu && (
        <div 
          className={`
            absolute top-1/2 -translate-y-1/2 z-50
            ${position === Position.Right ? 'left-10' : 'right-10'}
          `}
        >
          <BlockSelectionMenu 
            onSelect={handleSelectBlock} 
            onClose={() => setShowMenu(false)} 
          />
        </div>
      )}
    </div>
  );
}

export default memo(AddBlockHandle);
