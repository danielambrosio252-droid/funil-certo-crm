import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Trash2 } from "lucide-react";

interface DelayNodeData {
  delay_value?: number;
  delay_unit?: string;
  onUpdate?: (config: Record<string, unknown>) => void;
  onDelete?: () => void;
}

function DelayNode({ data }: NodeProps) {
  const nodeData = data as DelayNodeData;
  const [delayValue, setDelayValue] = useState(nodeData?.delay_value || 5);
  const [delayUnit, setDelayUnit] = useState(nodeData?.delay_unit || "seconds");

  const handleUpdate = () => {
    nodeData?.onUpdate?.({ delay_value: delayValue, delay_unit: delayUnit });
  };

  return (
    <Card className="w-[240px] bg-white border shadow-lg rounded-2xl overflow-hidden">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-slate-400 !border-2 !border-white"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-white" />
          <span className="font-medium text-white text-sm">Delay</span>
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
        <p className="text-xs text-muted-foreground mb-2">Aguardar:</p>
        <div className="flex gap-2">
          <Input
            type="number"
            min={1}
            value={delayValue}
            onChange={(e) => setDelayValue(parseInt(e.target.value) || 1)}
            onBlur={handleUpdate}
            className="h-9 text-sm w-20"
          />
          <Select value={delayUnit} onValueChange={(v) => { setDelayUnit(v); setTimeout(handleUpdate, 0); }}>
            <SelectTrigger className="h-9 text-sm flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="seconds">segundos</SelectItem>
              <SelectItem value="minutes">minutos</SelectItem>
              <SelectItem value="hours">horas</SelectItem>
              <SelectItem value="days">dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-cyan-400 !border-2 !border-white hover:!scale-125 transition-transform"
      />
    </Card>
  );
}

export default memo(DelayNode);
