import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export function useProfileSettings() {
  const { user, profile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Upload de avatar
  const uploadAvatar = useCallback(async (file: File): Promise<string | null> => {
    if (!user) {
      toast.error("Usuário não autenticado");
      return null;
    }

    // Validar arquivo
    if (!file.type.startsWith("image/")) {
      toast.error("O arquivo deve ser uma imagem");
      return null;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 2MB");
      return null;
    }

    setUploading(true);

    try {
      // Gerar nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Primeiro, tentar deletar o avatar existente
      await supabase.storage
        .from('avatars')
        .remove([fileName]);

      // Fazer upload do novo avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error("Erro no upload:", uploadError);
        toast.error("Erro ao fazer upload da imagem");
        return null;
      }

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Adicionar timestamp para evitar cache
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Atualizar perfil com a nova URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', user.id);

      if (updateError) {
        console.error("Erro ao atualizar perfil:", updateError);
        toast.error("Erro ao salvar URL do avatar");
        return null;
      }

      toast.success("Foto atualizada com sucesso!");
      return avatarUrl;
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao fazer upload da imagem");
      return null;
    } finally {
      setUploading(false);
    }
  }, [user]);

  // Salvar dados do perfil
  const saveProfile = useCallback(async (data: ProfileFormData): Promise<boolean> => {
    if (!user) {
      toast.error("Usuário não autenticado");
      return false;
    }

    setSaving(true);

    try {
      const fullName = `${data.firstName} ${data.lastName}`.trim();

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          email: data.email,
          phone: data.phone,
        })
        .eq('user_id', user.id);

      if (error) {
        console.error("Erro ao salvar perfil:", error);
        toast.error("Erro ao salvar alterações");
        return false;
      }

      toast.success("Perfil atualizado com sucesso!");
      return true;
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao salvar alterações");
      return false;
    } finally {
      setSaving(false);
    }
  }, [user]);

  // Obter dados atuais do perfil
  const getProfileData = useCallback((): ProfileFormData => {
    if (!profile) {
      return {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
      };
    }

    const nameParts = (profile.full_name || "").split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    return {
      firstName,
      lastName,
      email: profile.email || "",
      phone: (profile as any).phone || "",
    };
  }, [profile]);

  // Obter URL do avatar
  const getAvatarUrl = useCallback((): string | null => {
    return (profile as any)?.avatar_url || null;
  }, [profile]);

  // Obter iniciais do usuário
  const getInitials = useCallback((): string => {
    if (!profile?.full_name) return "??";
    return profile.full_name
      .split(" ")
      .map(n => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  }, [profile]);

  return {
    uploading,
    saving,
    uploadAvatar,
    saveProfile,
    getProfileData,
    getAvatarUrl,
    getInitials,
  };
}
