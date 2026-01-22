import { memo, useState, useCallback } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Trash2, Plus } from "lucide-react";
import { BlockSelectionMenu } from "../menus/BlockSelectionMenu";
import { NodeType } from "@/hooks/useChatbotFlows";

interface MessageNodeData {
  message?: string;
  onUpdate?: (config: Record<string, unknown>) => void;
  onDelete?: () => void;
  onAddNode?: (nodeType: NodeType, sourceNodeId: string) => void;
}

function MessageNode({ id, data }: NodeProps) {
  const nodeData = data as MessageNodeData;
  const [editing, setEditing] = useState(false);
  const [localMessage, setLocalMessage] = useState(nodeData?.message || "");
  const [showMenu, setShowMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleBlur = useCallback(() => {
    setEditing(false);
    nodeData?.onUpdate?.({ message: localMessage });
  }, [localMessage, nodeData]);

  const handleSelectBlock = (type: NodeType) => {
    nodeData?.onAddNode?.(type, id);
    setShowMenu(false);
  };

  return (
    <Card className="w-[320px] bg-white border shadow-lg rounded-2xl overflow-visible">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-slate-400 !border-2 !border-white"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-white" />
          <span className="font-medium text-white text-sm">Mensagem</span>
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
        <div 
          className="bg-slate-200 rounded-2xl rounded-tl-sm p-4 cursor-text min-h-[60px] transition-all hover:bg-slate-300/80"
          onClick={() => setEditing(true)}
        >
          {editing ? (
            <textarea
              autoFocus
              className="w-full bg-transparent border-none outline-none resize-none text-sm font-medium text-slate-800"
              placeholder="Digite a mensagem do bot..."
              value={localMessage}
              onChange={(e) => setLocalMessage(e.target.value)}
              onBlur={handleBlur}
              rows={3}
            />
          ) : (
            <p className="text-sm font-medium text-slate-800 whitespace-pre-wrap">
              {localMessage || <span className="text-slate-500">Clique para adicionar texto...</span>}
            </p>
          )}
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
          className="!w-4 !h-4 !bg-blue-400 !border-2 !border-white transition-all"
        />
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className={`
            absolute top-1/2 -translate-y-1/2 left-3
            w-6 h-6 rounded-full bg-blue-500 hover:bg-blue-600
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

export default memo(MessageNode);
