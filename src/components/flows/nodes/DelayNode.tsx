import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, Trash2 } from "lucide-react";

interface DelayNodeData {
  delay_seconds?: number;
  onUpdate?: (config: Record<string, unknown>) => void;
  onDelete?: () => void;
}

function DelayNode({ data }: NodeProps) {
  const nodeData = data as DelayNodeData;
  const [delayValue, setDelayValue] = useState(nodeData?.delay_seconds || 5);

  const handleBlur = () => {
    nodeData?.onUpdate?.({ delay_seconds: delayValue });
  };

  return (
    <Card className="w-72 bg-white border shadow-xl rounded-2xl overflow-hidden">
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-slate-400 !border-2 !border-white"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tempo</p>
            <p className="font-semibold">Aguardar</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => nodeData?.onDelete?.()}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <CardContent className="p-4">
        <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl">
          <Clock className="w-5 h-5 text-orange-500" />
          <span className="text-sm">Aguardar</span>
          <Input
            type="number"
            className="w-20 text-center"
            value={delayValue}
            onChange={(e) => setDelayValue(parseInt(e.target.value) || 5)}
            onBlur={handleBlur}
          />
          <span className="text-sm text-muted-foreground">segundos</span>
        </div>
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

export default memo(DelayNode);
