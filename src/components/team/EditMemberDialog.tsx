import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, UserCog, Trash2 } from "lucide-react";
import type { TeamMember } from "@/hooks/useTeamManagement";

interface EditMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  isOwner: boolean;
  currentUserId: string;
  onUpdateRole: (memberId: string, role: string) => Promise<boolean>;
  onRemove: (memberId: string) => Promise<boolean>;
}

export function EditMemberDialog({
  open,
  onOpenChange,
  member,
  isOwner,
  currentUserId,
  onUpdateRole,
  onRemove,
}: EditMemberDialogProps) {
  const [role, setRole] = useState(member?.role || "member");
  const [saving, setSaving] = useState(false);
  const [showRemoveAlert, setShowRemoveAlert] = useState(false);

  const isSelf = member?.user_id === currentUserId;
  const isOwnerMember = member?.role === "owner";
  const canEdit = isOwner && !isSelf && !isOwnerMember;

  const handleSave = async () => {
    if (!member || !canEdit) return;
    
    setSaving(true);
    const success = await onUpdateRole(member.id, role);
    setSaving(false);
    
    if (success) {
      onOpenChange(false);
    }
  };

  const handleRemove = async () => {
    if (!member || !canEdit) return;
    
    setSaving(true);
    const success = await onRemove(member.id);
    setSaving(false);
    setShowRemoveAlert(false);
    
    if (success) {
      onOpenChange(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "??";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const getRoleLabel = (r: string) => {
    switch (r) {
      case "owner":
        return "Proprietário";
      case "admin":
        return "Administrador";
      default:
        return "Membro";
    }
  };

  if (!member) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              Editar Membro
            </DialogTitle>
            <DialogDescription>
              Gerencie as permissões deste membro da equipe
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Info do membro */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <Avatar className="w-12 h-12">
                {member.avatar_url && (
                  <AvatarImage src={member.avatar_url} alt={member.full_name || ""} />
                )}
                <AvatarFallback className="bg-primary/10 text-primary">
                  {getInitials(member.full_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{member.full_name || "Sem nome"}</p>
                <p className="text-sm text-muted-foreground">{member.email}</p>
              </div>
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label>Função</Label>
              {canEdit ? (
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Membro</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground p-2 rounded bg-muted">
                  {getRoleLabel(member.role)}
                  {isSelf && " (você)"}
                  {isOwnerMember && " - não pode ser alterado"}
                </p>
              )}
            </div>

            {/* Mensagens de restrição */}
            {!isOwner && (
              <p className="text-sm text-muted-foreground">
                Apenas o proprietário pode editar membros da equipe.
              </p>
            )}
            {isOwner && isSelf && (
              <p className="text-sm text-muted-foreground">
                Você não pode editar seu próprio perfil aqui.
              </p>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {canEdit && (
              <Button
                variant="destructive"
                onClick={() => setShowRemoveAlert(true)}
                className="w-full sm:w-auto"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remover
              </Button>
            )}
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                {canEdit ? "Cancelar" : "Fechar"}
              </Button>
              {canEdit && (
                <Button
                  onClick={handleSave}
                  disabled={saving || role === member.role}
                  className="flex-1 gradient-primary text-primary-foreground"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Salvar"
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showRemoveAlert} onOpenChange={setShowRemoveAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{member.full_name}</strong> da
              equipe? Essa pessoa perderá acesso a todos os recursos da empresa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Remover"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
