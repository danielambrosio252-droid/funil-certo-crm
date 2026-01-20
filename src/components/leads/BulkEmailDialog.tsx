import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Send, Users } from "lucide-react";
import { toast } from "sonner";
import type { FunnelLead } from "@/hooks/useFunnels";

interface BulkEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: FunnelLead[];
}

export function BulkEmailDialog({ open, onOpenChange, leads }: BulkEmailDialogProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const leadsWithEmail = leads.filter((lead) => lead.email);

  const handleSend = async () => {
    if (!subject.trim()) {
      toast.error("Digite um assunto para o e-mail");
      return;
    }
    if (!message.trim()) {
      toast.error("Digite uma mensagem para o e-mail");
      return;
    }

    setIsSending(true);

    try {
      // For now, just simulate sending - in the future this would call an edge function
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      toast.success(`E-mail enviado para ${leadsWithEmail.length} leads!`);
      setSubject("");
      setMessage("");
      onOpenChange(false);
    } catch (error) {
      toast.error("Erro ao enviar e-mails");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Enviar E-mail em Massa
          </DialogTitle>
          <DialogDescription>
            Envie um e-mail para os leads selecionados
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Recipients Info */}
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">
              <span className="font-medium">{leadsWithEmail.length}</span> de{" "}
              <span className="font-medium">{leads.length}</span> leads possuem
              e-mail
            </span>
          </div>

          {leadsWithEmail.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum lead selecionado possui e-mail cadastrado</p>
            </div>
          ) : (
            <>
              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="email-subject">Assunto *</Label>
                <Input
                  id="email-subject"
                  placeholder="Assunto do e-mail..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <Label htmlFor="email-message">Mensagem *</Label>
                <Textarea
                  id="email-message"
                  placeholder="Digite sua mensagem..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Use {"{{nome}}"} para personalizar com o nome do lead
                </p>
              </div>

              {/* Preview recipients */}
              <div className="space-y-2">
                <Label>Destinatários</Label>
                <div className="max-h-24 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {leadsWithEmail.slice(0, 5).map((lead) => (
                    <div key={lead.id} className="text-sm text-muted-foreground">
                      {lead.name} &lt;{lead.email}&gt;
                    </div>
                  ))}
                  {leadsWithEmail.length > 5 && (
                    <div className="text-sm text-muted-foreground">
                      ... e mais {leadsWithEmail.length - 5} destinatários
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={leadsWithEmail.length === 0 || isSending}
          >
            {isSending ? (
              "Enviando..."
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar para {leadsWithEmail.length} leads
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
