import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GitBranch, Shuffle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ConditionNodeData {
  is_randomizer?: boolean;
  conditions?: unknown[];
  onUpdate?: (config: Record<string, unknown>) => void;
  onDelete?: () => void;
}

function ConditionNode({ data }: NodeProps) {
  const nodeData = data as ConditionNodeData;
  const isRandomizer = nodeData?.is_randomizer;

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
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isRandomizer ? 'bg-pink-500' : 'bg-orange-500'}`}>
            {isRandomizer ? <Shuffle className="w-5 h-5 text-white" /> : <GitBranch className="w-5 h-5 text-white" />}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Lógica</p>
            <p className="font-semibold">{isRandomizer ? "Randomizador" : "Condição"}</p>
          </div>
          <Badge className="bg-amber-500 text-xs">PRO</Badge>
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
        <div className={`p-4 rounded-xl text-center ${isRandomizer ? 'bg-pink-50' : 'bg-orange-50'}`}>
          {isRandomizer ? (
            <>
              <Shuffle className="w-6 h-6 mx-auto mb-2 text-pink-500" />
              <p className="text-sm text-pink-700">Divide o tráfego aleatoriamente</p>
            </>
          ) : (
            <>
              <GitBranch className="w-6 h-6 mx-auto mb-2 text-orange-500" />
              <p className="text-sm text-orange-700">Avalia condições e direciona</p>
            </>
          )}
        </div>
      </CardContent>

      {/* Output handles for branches */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-white hover:!scale-125 transition-all"
        style={{ top: '40%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        className="!w-4 !h-4 !bg-red-500 !border-2 !border-white hover:!scale-125 transition-all"
        style={{ top: '60%' }}
      />
    </Card>
  );
}

export default memo(ConditionNode);
