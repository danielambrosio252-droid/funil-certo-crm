import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserCheck, Trash2 } from "lucide-react";

interface TransferNodeData {
  message?: string;
  onUpdate?: (config: Record<string, unknown>) => void;
  onDelete?: () => void;
}

function TransferNode({ data }: NodeProps) {
  const nodeData = data as TransferNodeData;
  const [message, setMessage] = useState(nodeData?.message || "Transferindo para atendente humano...");

  const handleUpdate = () => {
    nodeData?.onUpdate?.({ message });
  };

  return (
    <Card className="w-[280px] bg-white border shadow-lg rounded-2xl overflow-hidden">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-slate-400 !border-2 !border-white"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-rose-500 to-pink-500">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-white" />
          <span className="font-medium text-white text-sm">Transferir</span>
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
        <p className="text-xs text-muted-foreground">Mensagem ao transferir:</p>
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onBlur={handleUpdate}
          placeholder="Mensagem de transferência..."
          className="h-9 text-sm"
        />
        <p className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2">
          ⚠️ O bot será pausado e um humano assumirá o chat.
        </p>
      </CardContent>

      {/* No output - transfer ends the bot flow */}
    </Card>
  );
}

export default memo(TransferNode);
