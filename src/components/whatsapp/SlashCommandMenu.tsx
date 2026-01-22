import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Bot, Loader2, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useWhatsAppTemplates, WhatsAppTemplate } from "@/hooks/useWhatsAppTemplates";
import { useWhatsAppFlows, WhatsAppFlow } from "@/hooks/useWhatsAppFlows";

interface SlashCommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: WhatsAppTemplate) => void;
  onSelectFlow: (flow: WhatsAppFlow) => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
}

type MenuItem = 
  | { type: "template"; data: WhatsAppTemplate }
  | { type: "flow"; data: WhatsAppFlow };

export function SlashCommandMenu({
  isOpen,
  onClose,
  onSelectTemplate,
  onSelectFlow,
  inputRef,
}: SlashCommandMenuProps) {
  const { templates, loading: loadingTemplates, fetchTemplates } = useWhatsAppTemplates();
  const { flows, loadingFlows } = useWhatsAppFlows();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch approved templates when menu opens
  useEffect(() => {
    if (isOpen) {
      fetchTemplates("APPROVED");
      setSearchQuery("");
      setSelectedIndex(0);
      // Focus search input after a short delay
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, fetchTemplates]);

  // Filter active flows
  const activeFlows = flows.filter(f => f.is_active);

  // Combine templates and flows into a single list
  const allItems: MenuItem[] = [
    ...templates.map(t => ({ type: "template" as const, data: t })),
    ...activeFlows.map(f => ({ type: "flow" as const, data: f })),
  ];

  // Filter by search query
  const filteredItems = allItems.filter(item => {
    const name = item.type === "template" ? item.data.name : item.data.name;
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            handleSelect(filteredItems[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          inputRef.current?.focus();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, filteredItems, onClose, inputRef]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  const handleSelect = (item: MenuItem) => {
    if (item.type === "template") {
      onSelectTemplate(item.data);
    } else {
      onSelectFlow(item.data);
    }
    onClose();
  };

  const getTemplatePreview = (template: WhatsAppTemplate) => {
    const bodyComponent = template.components.find(c => c.type === "BODY");
    return bodyComponent?.text?.substring(0, 80) || "Sem conteúdo";
  };

  const isLoading = loadingTemplates || loadingFlows;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-full left-0 right-0 mb-2 bg-popover border border-border rounded-xl shadow-xl overflow-hidden z-50"
        >
          {/* Header */}
          <div className="p-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-foreground">Atalhos rápidos</span>
              <Badge variant="secondary" className="text-xs">
                / para abrir
              </Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Buscar templates ou fluxos..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                className="pl-9 h-9 bg-background"
              />
            </div>
          </div>

          {/* Content */}
          <ScrollArea className="max-h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                {searchQuery ? "Nenhum resultado encontrado" : "Nenhum template ou fluxo disponível"}
              </div>
            ) : (
              <div className="p-1">
                {/* Templates Section */}
                {filteredItems.some(i => i.type === "template") && (
                  <>
                    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Templates Aprovados
                    </div>
                    {filteredItems
                      .filter(i => i.type === "template")
                      .map((item, index) => {
                        const globalIndex = filteredItems.indexOf(item);
                        const template = item.data as WhatsAppTemplate;
                        return (
                          <button
                            key={`template-${template.name}`}
                            onClick={() => handleSelect(item)}
                            className={cn(
                              "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors",
                              globalIndex === selectedIndex
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted/50"
                            )}
                          >
                            <div className="shrink-0 w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                              <FileText className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">
                                  {template.name}
                                </span>
                                <Badge variant="outline" className="text-xs shrink-0">
                                  {template.language}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {getTemplatePreview(template)}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                  </>
                )}

                {/* Flows Section */}
                {filteredItems.some(i => i.type === "flow") && (
                  <>
                    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1">
                      Fluxos Ativos
                    </div>
                    {filteredItems
                      .filter(i => i.type === "flow")
                      .map((item) => {
                        const globalIndex = filteredItems.indexOf(item);
                        const flow = item.data as WhatsAppFlow;
                        return (
                          <button
                            key={`flow-${flow.id}`}
                            onClick={() => handleSelect(item)}
                            className={cn(
                              "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors",
                              globalIndex === selectedIndex
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted/50"
                            )}
                          >
                            <div className="shrink-0 w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                              <Bot className="w-4 h-4 text-blue-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">
                                  {flow.name}
                                </span>
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  {flow.trigger_type === "keyword" ? "Palavra-chave" :
                                   flow.trigger_type === "new_lead" ? "Novo Lead" :
                                   flow.trigger_type === "schedule" ? "Agendado" : "Mudança de etapa"}
                                </Badge>
                              </div>
                              {flow.description && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {flow.description}
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                  </>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Footer hint */}
          <div className="px-3 py-2 border-t border-border bg-muted/30 flex items-center gap-4 text-xs text-muted-foreground">
            <span>
              <kbd className="px-1.5 py-0.5 bg-background rounded border text-[10px]">↑↓</kbd> navegar
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-background rounded border text-[10px]">Enter</kbd> selecionar
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-background rounded border text-[10px]">Esc</kbd> fechar
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
