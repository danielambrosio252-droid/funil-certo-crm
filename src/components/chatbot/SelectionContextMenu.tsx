import { Button } from "@/components/ui/button";
import { Copy, Move, Trash2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SelectionContextMenuProps {
  selectedCount: number;
  position: { x: number; y: number };
  onCopy: () => void;
  onMove: () => void;
  onDelete: () => void;
  onCancel: () => void;
  isMoving?: boolean;
}

export function SelectionContextMenu({
  selectedCount,
  position,
  onCopy,
  onMove,
  onDelete,
  onCancel,
  isMoving,
}: SelectionContextMenuProps) {
  if (selectedCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        className="fixed z-50 bg-white rounded-xl shadow-2xl border border-slate-200 p-2"
        style={{
          left: position.x,
          top: position.y,
          transform: "translate(-50%, -100%)",
        }}
      >
        <div className="flex items-center gap-1">
          <div className="px-3 py-1.5 text-sm font-medium text-slate-700 border-r border-slate-200 mr-1">
            {selectedCount} {selectedCount === 1 ? "bloco" : "blocos"}
          </div>

          {isMoving ? (
            <div className="flex items-center gap-2 px-2 text-sm text-amber-600 font-medium">
              <Move className="w-4 h-4 animate-pulse" />
              Clique no canvas para mover
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="h-7 w-7 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCopy}
                className="gap-1.5 h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                <Copy className="w-4 h-4" />
                Copiar
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={onMove}
                className="gap-1.5 h-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              >
                <Move className="w-4 h-4" />
                Mover
              </Button>

              <div className="w-px h-6 bg-slate-200 mx-1" />

              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="gap-1.5 h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="h-7 w-7 p-0 ml-1"
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
