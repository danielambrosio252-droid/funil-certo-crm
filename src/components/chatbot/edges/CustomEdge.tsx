import { memo, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
  useReactFlow,
} from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NodeType } from "@/hooks/useChatbotFlows";

interface CustomEdgeData {
  onDelete?: () => void;
  onInsertNode?: (nodeType: NodeType, position: { x: number; y: number }) => void;
}

function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { getNodes } = useReactFlow();
  const edgeData = data as CustomEdgeData;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const nodeTypes: { type: NodeType; label: string; color: string }[] = [
    { type: "message", label: "Mensagem", color: "bg-blue-500" },
    { type: "question", label: "Pergunta", color: "bg-purple-500" },
    { type: "condition", label: "Condição", color: "bg-amber-500" },
    { type: "delay", label: "Delay", color: "bg-cyan-500" },
    { type: "action", label: "Ação", color: "bg-violet-500" },
    { type: "transfer", label: "Transferir", color: "bg-rose-500" },
    { type: "end", label: "Fim", color: "bg-slate-700" },
  ];

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: isHovered ? 3 : 2,
          stroke: isHovered ? "#3b82f6" : "#94a3b8",
          transition: "all 0.2s",
        }}
        interactionWidth={20}
      />
      
      {/* Invisible wider path for hover detection */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ cursor: "pointer" }}
      />

      <EdgeLabelRenderer>
        {isHovered && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="flex items-center gap-1 nodrag nopan"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* Delete edge button */}
            <Button
              variant="destructive"
              size="icon"
              className="h-6 w-6 rounded-full shadow-lg"
              onClick={() => edgeData?.onDelete?.()}
            >
              <X className="w-3 h-3" />
            </Button>

            {/* Insert node dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  className="h-6 w-6 rounded-full shadow-lg bg-emerald-500 hover:bg-emerald-600"
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-40">
                {nodeTypes.map((node) => (
                  <DropdownMenuItem
                    key={node.type}
                    onClick={() => {
                      edgeData?.onInsertNode?.(node.type, { x: labelX, y: labelY });
                    }}
                  >
                    <div className={`w-2 h-2 rounded-full ${node.color} mr-2`} />
                    {node.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(CustomEdge);
