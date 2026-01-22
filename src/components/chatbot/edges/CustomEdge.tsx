import { memo, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
} from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import { BlockSelectionMenu } from "../menus/BlockSelectionMenu";
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
  const [showMenu, setShowMenu] = useState(false);
  const edgeData = data as CustomEdgeData;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.3,
  });

  const handleSelectBlock = (type: NodeType) => {
    edgeData?.onInsertNode?.(type, { x: labelX, y: labelY });
    setShowMenu(false);
    setIsHovered(false);
  };

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: isHovered ? 3 : 2,
          stroke: isHovered ? "#10b981" : "#64748b",
          transition: "all 0.2s",
        }}
        interactionWidth={20}
      />
      
      {/* Arrow marker in the middle */}
      <defs>
        <marker
          id={`arrow-${id}`}
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
        </marker>
      </defs>
      
      {/* Invisible wider path for hover detection */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={24}
        stroke="transparent"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          if (!showMenu) {
            setIsHovered(false);
          }
        }}
        style={{ cursor: "pointer" }}
      />

      <EdgeLabelRenderer>
        {(isHovered || showMenu) && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="flex items-center gap-2 nodrag nopan"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
              if (!showMenu) {
                setIsHovered(false);
              }
            }}
          >
            {/* Delete edge button */}
            <Button
              variant="destructive"
              size="icon"
              className="h-7 w-7 rounded-full shadow-xl border-2 border-white"
              onClick={() => edgeData?.onDelete?.()}
            >
              <X className="w-4 h-4" />
            </Button>

            {/* Insert node button */}
            <Button
              variant="default"
              size="icon"
              className="h-7 w-7 rounded-full shadow-xl bg-emerald-500 hover:bg-emerald-600 border-2 border-white"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
            >
              <Plus className="w-4 h-4" />
            </Button>

            {/* Block selection menu */}
            {showMenu && (
              <div className="absolute left-16 top-1/2 -translate-y-1/2 z-50">
                <BlockSelectionMenu 
                  onSelect={handleSelectBlock}
                  onClose={() => {
                    setShowMenu(false);
                    setIsHovered(false);
                  }}
                />
              </div>
            )}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(CustomEdge);
