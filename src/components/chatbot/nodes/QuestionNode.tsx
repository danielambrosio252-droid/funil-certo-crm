import { memo, useState, useCallback } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HelpCircle, Trash2, Plus, X } from "lucide-react";
import { BlockSelectionMenu } from "../menus/BlockSelectionMenu";
import { NodeType } from "@/hooks/useChatbotFlows";

interface QuestionNodeData {
  question?: string;
  options?: string[];
  variable?: string;
  onUpdate?: (config: Record<string, unknown>) => void;
  onDelete?: () => void;
  onAddNode?: (nodeType: NodeType, sourceNodeId: string, sourceHandle?: string) => void;
}

function QuestionNode({ id, data }: NodeProps) {
  const nodeData = data as QuestionNodeData;
  const [editing, setEditing] = useState(false);
  const [localQuestion, setLocalQuestion] = useState(nodeData?.question || "");
  const options = nodeData?.options || [];
  const [showMenu, setShowMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredOption, setHoveredOption] = useState<number | null>(null);
  const [showOptionMenu, setShowOptionMenu] = useState<number | null>(null);

  const handleBlur = useCallback(() => {
    setEditing(false);
    nodeData?.onUpdate?.({ 
      question: localQuestion, 
      options,
      variable: nodeData?.variable 
    });
  }, [localQuestion, options, nodeData]);

  const handleAddOption = () => {
    const newOptions = [...options, `Opção ${options.length + 1}`];
    nodeData?.onUpdate?.({ 
      question: localQuestion, 
      options: newOptions,
      variable: nodeData?.variable 
    });
  };

  const handleRemoveOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
    nodeData?.onUpdate?.({ 
      question: localQuestion, 
      options: newOptions,
      variable: nodeData?.variable 
    });
  };

  const handleUpdateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    nodeData?.onUpdate?.({ 
      question: localQuestion, 
      options: newOptions,
      variable: nodeData?.variable 
    });
  };

  const handleSelectBlock = (type: NodeType, handleId?: string) => {
    nodeData?.onAddNode?.(type, id, handleId);
    setShowMenu(false);
    setShowOptionMenu(null);
  };

  return (
    <Card className="w-[350px] bg-white border shadow-lg rounded-2xl overflow-visible">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-slate-400 !border-2 !border-white"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-white" />
          <span className="font-medium text-white text-sm">Pergunta</span>
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
        {/* Question */}
        <div 
          className="bg-purple-50 rounded-xl p-3 cursor-text min-h-[50px]"
          onClick={() => setEditing(true)}
        >
          {editing ? (
            <textarea
              autoFocus
              className="w-full bg-transparent border-none outline-none resize-none text-sm"
              placeholder="Digite sua pergunta..."
              value={localQuestion}
              onChange={(e) => setLocalQuestion(e.target.value)}
              onBlur={handleBlur}
              rows={2}
            />
          ) : (
            <p className="text-sm">
              {localQuestion || <span className="text-muted-foreground">Clique para adicionar pergunta...</span>}
            </p>
          )}
        </div>

        {/* Options with individual handles */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Opções de resposta:</p>
          {options.map((opt, idx) => (
            <div 
              key={idx} 
              className="relative flex items-center gap-2"
              onMouseEnter={() => setHoveredOption(idx)}
              onMouseLeave={() => {
                setHoveredOption(null);
                if (showOptionMenu !== idx) setShowOptionMenu(null);
              }}
            >
              <Input
                value={opt}
                onChange={(e) => handleUpdateOption(idx, e.target.value)}
                className="flex-1 h-9 text-sm pr-16"
                placeholder={`Opção ${idx + 1}`}
              />
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 shrink-0" 
                onClick={() => handleRemoveOption(idx)}
              >
                <X className="w-3 h-3" />
              </Button>
              
              {/* Option-specific output handle with + button */}
              <div 
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[calc(100%+8px)]"
              >
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`option-${idx}`}
                  className="!w-3 !h-3 !bg-purple-400 !border-2 !border-white transition-all"
                  style={{ position: 'relative', transform: 'none' }}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOptionMenu(showOptionMenu === idx ? null : idx);
                  }}
                  className={`
                    absolute top-1/2 -translate-y-1/2 left-2
                    w-5 h-5 rounded-full bg-purple-500 hover:bg-purple-600
                    flex items-center justify-center
                    text-white shadow-lg
                    transition-all duration-200
                    ${(hoveredOption === idx || showOptionMenu === idx) ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}
                    z-10
                  `}
                >
                  <Plus className="w-3 h-3" />
                </button>
                {showOptionMenu === idx && (
                  <div className="absolute top-1/2 -translate-y-1/2 left-9 z-50">
                    <BlockSelectionMenu 
                      onSelect={(type) => handleSelectBlock(type, `option-${idx}`)} 
                      onClose={() => setShowOptionMenu(null)} 
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="w-full border-dashed"
            onClick={handleAddOption}
          >
            <Plus className="w-3 h-3 mr-1" />
            Adicionar opção
          </Button>
        </div>
      </CardContent>

      {/* Default output (free text) - only if no options */}
      {options.length === 0 && (
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
            className="!w-4 !h-4 !bg-purple-400 !border-2 !border-white transition-all"
          />
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className={`
              absolute top-1/2 -translate-y-1/2 left-3
              w-6 h-6 rounded-full bg-purple-500 hover:bg-purple-600
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
                onSelect={(type) => handleSelectBlock(type)} 
                onClose={() => setShowMenu(false)} 
              />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default memo(QuestionNode);
