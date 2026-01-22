import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flag, Trash2 } from "lucide-react";

interface EndNodeData {
  onDelete?: () => void;
}

function EndNode({ data }: NodeProps) {
  const nodeData = data as EndNodeData;

  return (
    <Card className="w-[180px] bg-gradient-to-br from-slate-700 to-slate-800 border-0 shadow-lg rounded-2xl overflow-hidden">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-slate-400 !border-2 !border-white"
      />
      
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <Flag className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-white">Fim</p>
            <p className="text-xs text-white/60">Encerrar fluxo</p>
          </div>
        </div>
        {nodeData?.onDelete && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-white/50 hover:text-white hover:bg-white/10"
            onClick={() => nodeData?.onDelete?.()}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>
    </Card>
  );
}

export default memo(EndNode);
