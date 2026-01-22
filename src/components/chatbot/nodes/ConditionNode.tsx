import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitBranch, Trash2 } from "lucide-react";

interface ConditionNodeData {
  variable?: string;
  operator?: string;
  value?: string;
  onUpdate?: (config: Record<string, unknown>) => void;
  onDelete?: () => void;
}

const operators = [
  { value: "equals", label: "é igual a" },
  { value: "not_equals", label: "não é igual a" },
  { value: "contains", label: "contém" },
  { value: "not_contains", label: "não contém" },
  { value: "starts_with", label: "começa com" },
  { value: "ends_with", label: "termina com" },
  { value: "is_empty", label: "está vazio" },
  { value: "is_not_empty", label: "não está vazio" },
];

function ConditionNode({ data }: NodeProps) {
  const nodeData = data as ConditionNodeData;
  const [variable, setVariable] = useState(nodeData?.variable || "");
  const [operator, setOperator] = useState(nodeData?.operator || "equals");
  const [value, setValue] = useState(nodeData?.value || "");

  const handleUpdate = () => {
    nodeData?.onUpdate?.({ variable, operator, value });
  };

  return (
    <Card className="w-[320px] bg-white border shadow-lg rounded-2xl overflow-hidden">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-slate-400 !border-2 !border-white"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-white" />
          <span className="font-medium text-white text-sm">Condição</span>
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
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Se a variável</label>
          <Input
            value={variable}
            onChange={(e) => setVariable(e.target.value)}
            onBlur={handleUpdate}
            placeholder="resposta, nome, email..."
            className="h-9 text-sm"
          />
        </div>

        <Select value={operator} onValueChange={(v) => { setOperator(v); handleUpdate(); }}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!["is_empty", "is_not_empty"].includes(operator) && (
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleUpdate}
            placeholder="Valor esperado..."
            className="h-9 text-sm"
          />
        )}

        {/* True/False labels */}
        <div className="flex justify-between text-xs pt-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-emerald-600 font-medium">Verdadeiro</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-rose-600 font-medium">Falso</span>
            <div className="w-2 h-2 rounded-full bg-rose-500" />
          </div>
        </div>
      </CardContent>

      {/* True output */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-white hover:!scale-125 transition-transform"
        style={{ top: '60%' }}
      />
      
      {/* False output */}
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        className="!w-4 !h-4 !bg-rose-500 !border-2 !border-white hover:!scale-125 transition-transform"
        style={{ top: '85%' }}
      />
    </Card>
  );
}

export default memo(ConditionNode);
