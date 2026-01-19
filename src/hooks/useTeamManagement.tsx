import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface TeamMember {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  avatar_url: string | null;
  created_at: string;
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
}

export function useTeamManagement() {
  const { profile, company } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);

  const isOwner = profile?.role === "owner";
  const isAdmin = profile?.role === "admin" || isOwner;

  // Buscar membros da equipe
  const fetchMembers = useCallback(async () => {
    if (!company?.id) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, role, avatar_url, created_at")
        .eq("company_id", company.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error("Erro ao buscar membros:", error);
    }
  }, [company?.id]);

  // Buscar convites pendentes
  const fetchInvitations = useCallback(async () => {
    if (!company?.id || !isAdmin) return;

    try {
      const { data, error } = await supabase
        .from("team_invitations")
        .select("id, email, role, status, created_at, expires_at")
        .eq("company_id", company.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error("Erro ao buscar convites:", error);
    }
  }, [company?.id, isAdmin]);

  // Carregar dados iniciais
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchMembers(), fetchInvitations()]);
      setLoading(false);
    };
    loadData();
  }, [fetchMembers, fetchInvitations]);

  // Enviar convite
  const sendInvitation = async (email: string, role: string) => {
    if (!company?.id || !profile?.user_id) {
      toast.error("Erro: empresa ou usuário não encontrado");
      return false;
    }

    // Verificar se já existe membro com esse email
    const existingMember = members.find(
      (m) => m.email?.toLowerCase() === email.toLowerCase()
    );
    if (existingMember) {
      toast.error("Este email já é membro da equipe");
      return false;
    }

    // Verificar se já existe convite pendente
    const existingInvite = invitations.find(
      (i) => i.email.toLowerCase() === email.toLowerCase()
    );
    if (existingInvite) {
      toast.error("Já existe um convite pendente para este email");
      return false;
    }

    setInviting(true);
    try {
      const { error } = await supabase.from("team_invitations").insert({
        company_id: company.id,
        email: email.toLowerCase(),
        role,
        invited_by: profile.user_id,
      });

      if (error) throw error;

      toast.success(`Convite enviado para ${email}`);
      await fetchInvitations();
      return true;
    } catch (error: any) {
      console.error("Erro ao enviar convite:", error);
      toast.error(error.message || "Erro ao enviar convite");
      return false;
    } finally {
      setInviting(false);
    }
  };

  // Cancelar convite
  const cancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from("team_invitations")
        .update({ status: "cancelled" })
        .eq("id", invitationId);

      if (error) throw error;

      toast.success("Convite cancelado");
      await fetchInvitations();
      return true;
    } catch (error: any) {
      console.error("Erro ao cancelar convite:", error);
      toast.error("Erro ao cancelar convite");
      return false;
    }
  };

  // Atualizar role de membro
  const updateMemberRole = async (memberId: string, newRole: string) => {
    if (!isOwner) {
      toast.error("Apenas o proprietário pode alterar roles");
      return false;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) throw error;

      toast.success("Role atualizado com sucesso");
      await fetchMembers();
      return true;
    } catch (error: any) {
      console.error("Erro ao atualizar role:", error);
      toast.error("Erro ao atualizar role");
      return false;
    }
  };

  // Remover membro
  const removeMember = async (memberId: string) => {
    if (!isOwner) {
      toast.error("Apenas o proprietário pode remover membros");
      return false;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ company_id: null, role: "member" })
        .eq("id", memberId);

      if (error) throw error;

      toast.success("Membro removido da equipe");
      await fetchMembers();
      return true;
    } catch (error: any) {
      console.error("Erro ao remover membro:", error);
      toast.error("Erro ao remover membro");
      return false;
    }
  };

  return {
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
    refetch: () => Promise.all([fetchMembers(), fetchInvitations()]),
  };
}
