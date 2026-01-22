import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, User, Square, Power } from "lucide-react";
import { useChatbotStatus } from "@/hooks/useChatbotFlows";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatBotStatusProps {
  contactId: string | null;
}

export function ChatBotStatus({ contactId }: ChatBotStatusProps) {
  const { 
    execution, 
    isLoading, 
    isBotActive, 
    isHumanTakeover, 
    toggleHumanTakeover, 
    stopExecution 
  } = useChatbotStatus(contactId);

  if (isLoading || !execution) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
      {isBotActive ? (
        <>
          <Badge variant="default" className="bg-emerald-500 gap-1">
            <Bot className="w-3 h-3" />
            Bot ativo
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => toggleHumanTakeover.mutate(true)}
              >
                <User className="w-3 h-3 mr-1" />
                Assumir
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Pausar bot e assumir atendimento
            </TooltipContent>
          </Tooltip>
        </>
      ) : isHumanTakeover ? (
        <>
          <Badge variant="secondary" className="bg-blue-500 text-white gap-1">
            <User className="w-3 h-3" />
            Atendimento humano
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => toggleHumanTakeover.mutate(false)}
              >
                <Power className="w-3 h-3 mr-1" />
                Reativar Bot
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Devolver para o bot
            </TooltipContent>
          </Tooltip>
        </>
      ) : (
        <Badge variant="secondary" className="gap-1">
          <Square className="w-3 h-3" />
          Bot pausado
        </Badge>
      )}

      {execution && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs ml-auto text-destructive hover:text-destructive"
              onClick={() => stopExecution.mutate()}
            >
              <Square className="w-3 h-3 mr-1" />
              Encerrar
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Encerrar fluxo completamente
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
