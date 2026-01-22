import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitBranch, Trash2, Plus } from "lucide-react";
import { BlockSelectionMenu } from "../menus/BlockSelectionMenu";
import { NodeType } from "@/hooks/useChatbotFlows";

interface ConditionNodeData {
  variable?: string;
  operator?: string;
  value?: string;
  onUpdate?: (config: Record<string, unknown>) => void;
  onDelete?: () => void;
  onAddNode?: (nodeType: NodeType, sourceNodeId: string, sourceHandle?: string) => void;
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

function ConditionNode({ id, data }: NodeProps) {
  const nodeData = data as ConditionNodeData;
  const [variable, setVariable] = useState(nodeData?.variable || "");
  const [operator, setOperator] = useState(nodeData?.operator || "equals");
  const [value, setValue] = useState(nodeData?.value || "");
  const [showTrueMenu, setShowTrueMenu] = useState(false);
  const [showFalseMenu, setShowFalseMenu] = useState(false);
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);

  const handleUpdate = () => {
    nodeData?.onUpdate?.({ variable, operator, value });
  };

  const handleSelectBlock = (type: NodeType, handleId: string) => {
    nodeData?.onAddNode?.(type, id, handleId);
    setShowTrueMenu(false);
    setShowFalseMenu(false);
  };

  return (
    <Card className="w-[320px] bg-white border shadow-lg rounded-2xl overflow-visible">
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

      {/* True output with + button */}
      <div 
        className="absolute right-0 translate-x-1/2"
        style={{ top: '60%' }}
        onMouseEnter={() => setHoveredHandle('true')}
        onMouseLeave={() => {
          setHoveredHandle(null);
          if (!showTrueMenu) setShowTrueMenu(false);
        }}
      >
        <Handle
          type="source"
          position={Position.Right}
          id="true"
          className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-white transition-all"
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowTrueMenu(!showTrueMenu);
          }}
          className={`
            absolute top-1/2 -translate-y-1/2 left-3
            w-5 h-5 rounded-full bg-emerald-500 hover:bg-emerald-600
            flex items-center justify-center
            text-white shadow-lg
            transition-all duration-200
            ${(hoveredHandle === 'true' || showTrueMenu) ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}
            z-10
          `}
        >
          <Plus className="w-3 h-3" />
        </button>
        {showTrueMenu && (
          <div className="absolute top-1/2 -translate-y-1/2 left-10 z-50">
            <BlockSelectionMenu 
              onSelect={(type) => handleSelectBlock(type, 'true')} 
              onClose={() => setShowTrueMenu(false)} 
            />
          </div>
        )}
      </div>
      
      {/* False output with + button */}
      <div 
        className="absolute right-0 translate-x-1/2"
        style={{ top: '85%' }}
        onMouseEnter={() => setHoveredHandle('false')}
        onMouseLeave={() => {
          setHoveredHandle(null);
          if (!showFalseMenu) setShowFalseMenu(false);
        }}
      >
        <Handle
          type="source"
          position={Position.Right}
          id="false"
          className="!w-4 !h-4 !bg-rose-500 !border-2 !border-white transition-all"
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowFalseMenu(!showFalseMenu);
          }}
          className={`
            absolute top-1/2 -translate-y-1/2 left-3
            w-5 h-5 rounded-full bg-rose-500 hover:bg-rose-600
            flex items-center justify-center
            text-white shadow-lg
            transition-all duration-200
            ${(hoveredHandle === 'false' || showFalseMenu) ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}
            z-10
          `}
        >
          <Plus className="w-3 h-3" />
        </button>
        {showFalseMenu && (
          <div className="absolute top-1/2 -translate-y-1/2 left-10 z-50">
            <BlockSelectionMenu 
              onSelect={(type) => handleSelectBlock(type, 'false')} 
              onClose={() => setShowFalseMenu(false)} 
            />
          </div>
        )}
      </div>
    </Card>
  );
}

export default memo(ConditionNode);
