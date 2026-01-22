import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle, ExternalLink, MessageSquare } from "lucide-react";

interface WhatsAppChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  contactName?: string;
}

export function WhatsAppChoiceDialog({
  open,
  onOpenChange,
  phone,
  contactName,
}: WhatsAppChoiceDialogProps) {
  const navigate = useNavigate();
  const cleanPhone = phone.replace(/\D/g, "");

  const handleOpenInSystem = () => {
    // Navigate to WhatsApp page with the phone number as query param
    navigate(`/whatsapp?phone=${cleanPhone}&name=${encodeURIComponent(contactName || "")}`);
    onOpenChange(false);
  };

  const handleOpenWhatsAppWeb = () => {
    window.open(`https://wa.me/${cleanPhone}`, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-success" />
            WhatsApp
          </DialogTitle>
          <DialogDescription>
            Como você deseja conversar com {contactName || cleanPhone}?
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-4">
          <Button
            onClick={handleOpenInSystem}
            className="w-full justify-start gap-3 h-14"
            variant="default"
          >
            <MessageSquare className="w-5 h-5" />
            <div className="text-left">
              <div className="font-medium">Abrir no Chat do Sistema</div>
              <div className="text-xs opacity-80">Conversar dentro da plataforma</div>
            </div>
          </Button>

          <Button
            onClick={handleOpenWhatsAppWeb}
            variant="outline"
            className="w-full justify-start gap-3 h-14"
          >
            <ExternalLink className="w-5 h-5" />
            <div className="text-left">
              <div className="font-medium">Abrir no WhatsApp Web</div>
              <div className="text-xs text-muted-foreground">Abre em uma nova aba</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper hook to manage the dialog state
export function useWhatsAppChoice() {
  const [isOpen, setIsOpen] = useState(false);
  const [targetPhone, setTargetPhone] = useState("");
  const [targetName, setTargetName] = useState("");

  const openDialog = (phone: string, name?: string) => {
    setTargetPhone(phone);
    setTargetName(name || "");
    setIsOpen(true);
  };

  return {
    isOpen,
    setIsOpen,
    targetPhone,
    targetName,
    openDialog,
  };
}
