import { memo, useState, useCallback } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Trash2 } from "lucide-react";

interface MessageNodeData {
  message?: string;
  onUpdate?: (config: Record<string, unknown>) => void;
  onDelete?: () => void;
}

function MessageNode({ data }: NodeProps) {
  const nodeData = data as MessageNodeData;
  const [editing, setEditing] = useState(false);
  const [localMessage, setLocalMessage] = useState(nodeData?.message || "");

  const handleBlur = useCallback(() => {
    setEditing(false);
    nodeData?.onUpdate?.({ message: localMessage });
  }, [localMessage, nodeData]);

  return (
    <Card className="w-[320px] bg-white border shadow-lg rounded-2xl overflow-hidden">
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
          className="bg-slate-100 rounded-2xl rounded-tl-sm p-4 cursor-text min-h-[60px] transition-all hover:bg-slate-200/70"
          onClick={() => setEditing(true)}
        >
          {editing ? (
            <textarea
              autoFocus
              className="w-full bg-transparent border-none outline-none resize-none text-sm"
              placeholder="Digite a mensagem do bot..."
              value={localMessage}
              onChange={(e) => setLocalMessage(e.target.value)}
              onBlur={handleBlur}
              rows={3}
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {localMessage || <span className="text-muted-foreground">Clique para adicionar texto...</span>}
            </p>
          )}
        </div>
      </CardContent>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-blue-400 !border-2 !border-white hover:!scale-125 transition-transform"
      />
    </Card>
  );
}

export default memo(MessageNode);
