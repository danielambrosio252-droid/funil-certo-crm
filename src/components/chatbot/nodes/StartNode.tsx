import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card } from "@/components/ui/card";
import { Play } from "lucide-react";

interface StartNodeData {
  label?: string;
}

function StartNode({ data }: NodeProps) {
  const nodeData = data as StartNodeData;

  return (
    <Card className="w-[200px] bg-gradient-to-br from-emerald-500 to-emerald-600 border-0 shadow-lg rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          <Play className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-white">Início</p>
          <p className="text-xs text-white/70">Ponto de partida</p>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-white !border-2 !border-emerald-400 hover:!scale-125 transition-transform"
      />
    </Card>
  );
}

export default memo(StartNode);
