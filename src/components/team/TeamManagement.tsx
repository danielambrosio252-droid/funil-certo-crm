import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserPlus, Clock, Mail, X, Crown, Shield, User } from "lucide-react";
import { useTeamManagement } from "@/hooks/useTeamManagement";
import { InviteMemberDialog } from "./InviteMemberDialog";
import { EditMemberDialog } from "./EditMemberDialog";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TeamMember } from "@/hooks/useTeamManagement";

export function TeamManagement() {
  const { profile } = useAuth();
  const {
    members,
    invitations,
    loading,
    inviting,
    isOwner,
    isAdmin,
    sendInvitation,
    cancelInvitation,
    updateMemberRole,
    removeMember,
  } = useTeamManagement();

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const getInitials = (name: string | null) => {
    if (!name) return "??";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="w-3 h-3" />;
      case "admin":
        return <Shield className="w-3 h-3" />;
      default:
        return <User className="w-3 h-3" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "owner":
        return "Proprietário";
      case "admin":
        return "Admin";
      default:
        return "Membro";
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "default";
      case "admin":
        return "secondary";
      default:
        return "outline";
    }
  };

  const handleEditMember = (member: TeamMember) => {
    setSelectedMember(member);
    setEditDialogOpen(true);
  };

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Membros da equipe */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Membros da Equipe
            </CardTitle>
            <CardDescription>
              {members.length} {members.length === 1 ? "membro" : "membros"} na equipe
            </CardDescription>
          </div>
          {isAdmin && (
            <Button
              onClick={() => setInviteDialogOpen(true)}
              className="gradient-primary text-primary-foreground"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Convidar Membro
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between py-3 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    {member.avatar_url && (
                      <AvatarImage src={member.avatar_url} alt={member.full_name || ""} />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(member.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">
                        {member.full_name || "Sem nome"}
                      </p>
                      {member.user_id === profile?.user_id && (
                        <span className="text-xs text-muted-foreground">(você)</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={getRoleBadgeVariant(member.role) as any} className="gap-1">
                    {getRoleIcon(member.role)}
                    {getRoleLabel(member.role)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditMember(member)}
                  >
                    Editar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Convites pendentes */}
      {isAdmin && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Convites Pendentes
            </CardTitle>
            <CardDescription>
              Convites aguardando aceitação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between py-3 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{invitation.email}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        Expira em{" "}
                        {formatDistanceToNow(new Date(invitation.expires_at), {
                          locale: ptBR,
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="gap-1">
                      {invitation.role === "admin" ? (
                        <>
                          <Shield className="w-3 h-3" />
                          Admin
                        </>
                      ) : (
                        <>
                          <User className="w-3 h-3" />
                          Membro
                        </>
                      )}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelInvitation(invitation.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <InviteMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onInvite={sendInvitation}
        inviting={inviting}
      />

      <EditMemberDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        member={selectedMember}
        isOwner={isOwner}
        currentUserId={profile?.user_id || ""}
        onUpdateRole={updateMemberRole}
        onRemove={removeMember}
      />
    </motion.div>
  );
}
