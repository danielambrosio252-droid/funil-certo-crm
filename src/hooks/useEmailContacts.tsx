import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface EmailContact {
  id: string;
  company_id: string;
  list_id: string | null;
  email: string;
  name: string | null;
  phone: string | null;
  tags: string[] | null;
  source: string | null;
  lead_id: string | null;
  is_subscribed: boolean;
  unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailList {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export function useEmailContacts() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const companyId = profile?.company_id;

  // Fetch contacts
  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["email-contacts", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("email_contacts")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EmailContact[];
    },
    enabled: !!companyId,
  });

  // Fetch lists
  const { data: lists = [], isLoading: listsLoading } = useQuery({
    queryKey: ["email-lists", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("email_lists")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EmailList[];
    },
    enabled: !!companyId,
  });

  // Fetch funnel leads for sync
  const { data: funnelLeads = [] } = useQuery({
    queryKey: ["funnel-leads-for-sync", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("funnel_leads")
        .select("id, name, email, phone, tags")
        .eq("company_id", companyId)
        .not("email", "is", null);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Create list mutation
  const createList = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      if (!companyId) throw new Error("Company not found");
      const { data: newList, error } = await supabase
        .from("email_lists")
        .insert({ ...data, company_id: companyId })
        .select()
        .single();
      if (error) throw error;
      return newList;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-lists"] });
      toast.success("Lista criada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar lista: " + error.message);
    },
  });

  // Delete list mutation
  const deleteList = useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase
        .from("email_lists")
        .delete()
        .eq("id", listId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-lists"] });
      toast.success("Lista removida com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao remover lista: " + error.message);
    },
  });

  // Create contact mutation
  const createContact = useMutation({
    mutationFn: async (data: { email: string; name?: string; phone?: string; list_id?: string; tags?: string[] }) => {
      if (!companyId) throw new Error("Company not found");
      const { data: newContact, error } = await supabase
        .from("email_contacts")
        .insert({ ...data, company_id: companyId, source: "manual" })
        .select()
        .single();
      if (error) throw error;
      return newContact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-contacts"] });
      toast.success("Contato adicionado com sucesso!");
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast.error("Este e-mail já está cadastrado");
      } else {
        toast.error("Erro ao adicionar contato: " + error.message);
      }
    },
  });

  // Delete contact mutation
  const deleteContact = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase
        .from("email_contacts")
        .delete()
        .eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-contacts"] });
      toast.success("Contato removido com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao remover contato: " + error.message);
    },
  });

  // Import contacts from CSV
  const importFromCSV = async (csvContent: string, listId?: string) => {
    if (!companyId) throw new Error("Company not found");

    const lines = csvContent.split("\n").filter(line => line.trim());
    if (lines.length < 2) {
      toast.error("Arquivo CSV vazio ou inválido");
      return { success: 0, errors: 0 };
    }

    const headers = lines[0].toLowerCase().split(",").map(h => h.trim());
    const emailIndex = headers.findIndex(h => h === "email" || h === "e-mail");
    const nameIndex = headers.findIndex(h => h === "name" || h === "nome");
    const phoneIndex = headers.findIndex(h => h === "phone" || h === "telefone" || h === "celular");

    if (emailIndex === -1) {
      toast.error("Coluna 'email' não encontrada no CSV");
      return { success: 0, errors: 0 };
    }

    let success = 0;
    let errors = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim().replace(/^["']|["']$/g, ""));
      const email = values[emailIndex];
      
      if (!email || !email.includes("@")) {
        errors++;
        continue;
      }

      try {
        await supabase
          .from("email_contacts")
          .upsert({
            company_id: companyId,
            email,
            name: nameIndex !== -1 ? values[nameIndex] || null : null,
            phone: phoneIndex !== -1 ? values[phoneIndex] || null : null,
            list_id: listId || null,
            source: "csv_import",
          }, { onConflict: "company_id,email" });
        success++;
      } catch {
        errors++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["email-contacts"] });
    toast.success(`Importação concluída: ${success} contatos importados${errors > 0 ? `, ${errors} erros` : ""}`);
    return { success, errors };
  };

  // Sync contacts from funnel leads
  const syncFromFunnelLeads = async (listId?: string) => {
    if (!companyId) throw new Error("Company not found");

    const leadsWithEmail = funnelLeads.filter(lead => lead.email);
    let success = 0;
    let errors = 0;

    for (const lead of leadsWithEmail) {
      try {
        await supabase
          .from("email_contacts")
          .upsert({
            company_id: companyId,
            email: lead.email!,
            name: lead.name,
            phone: lead.phone,
            tags: lead.tags,
            lead_id: lead.id,
            list_id: listId || null,
            source: "funnel_sync",
          }, { onConflict: "company_id,email" });
        success++;
      } catch {
        errors++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["email-contacts"] });
    toast.success(`Sincronização concluída: ${success} contatos sincronizados${errors > 0 ? `, ${errors} erros` : ""}`);
    return { success, errors };
  };

  const subscribedCount = contacts.filter(c => c.is_subscribed).length;

  return {
    contacts,
    lists,
    funnelLeads,
    contactsLoading,
    listsLoading,
    subscribedCount,
    createList: createList.mutate,
    deleteList: deleteList.mutate,
    createContact: createContact.mutate,
    deleteContact: deleteContact.mutate,
    importFromCSV,
    syncFromFunnelLeads,
    isCreatingList: createList.isPending,
    isCreatingContact: createContact.isPending,
  };
}
