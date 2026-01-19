import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  Plus,
  Upload,
  RefreshCw,
  MoreVertical,
  Trash2,
  Mail,
  Search,
  FolderPlus,
  UserPlus,
} from "lucide-react";
import { useEmailContacts, EmailContact } from "@/hooks/useEmailContacts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ContactsManager() {
  const {
    contacts,
    lists,
    funnelLeads,
    contactsLoading,
    subscribedCount,
    createList,
    deleteList,
    createContact,
    deleteContact,
    importFromCSV,
    syncFromFunnelLeads,
    isCreatingList,
    isCreatingContact,
  } = useEmailContacts();

  const [search, setSearch] = useState("");
  const [filterList, setFilterList] = useState<string>("all");
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [addListOpen, setAddListOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);

  // New contact form
  const [newContact, setNewContact] = useState({ email: "", name: "", phone: "", list_id: "" });
  // New list form
  const [newList, setNewList] = useState({ name: "", description: "" });
  // Import/Sync target list
  const [targetListId, setTargetListId] = useState<string>("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch =
      contact.email.toLowerCase().includes(search.toLowerCase()) ||
      (contact.name && contact.name.toLowerCase().includes(search.toLowerCase()));
    const matchesList = filterList === "all" || contact.list_id === filterList || (filterList === "no-list" && !contact.list_id);
    return matchesSearch && matchesList;
  });

  const handleAddContact = () => {
    if (!newContact.email) return;
    createContact({
      email: newContact.email,
      name: newContact.name || undefined,
      phone: newContact.phone || undefined,
      list_id: newContact.list_id || undefined,
    });
    setNewContact({ email: "", name: "", phone: "", list_id: "" });
    setAddContactOpen(false);
  };

  const handleAddList = () => {
    if (!newList.name) return;
    createList({
      name: newList.name,
      description: newList.description || undefined,
    });
    setNewList({ name: "", description: "" });
    setAddListOpen(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      await importFromCSV(content, targetListId || undefined);
      setImportOpen(false);
      setTargetListId("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const handleSync = async () => {
    await syncFromFunnelLeads(targetListId || undefined);
    setSyncOpen(false);
    setTargetListId("");
  };

  const getListName = (listId: string | null) => {
    if (!listId) return null;
    const list = lists.find(l => l.id === listId);
    return list?.name;
  };

  const getSourceLabel = (source: string | null) => {
    switch (source) {
      case "manual": return "Manual";
      case "csv_import": return "CSV";
      case "funnel_sync": return "Funil";
      default: return source || "—";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Contatos</p>
                <p className="text-2xl font-bold">{contacts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-success/10">
                <Mail className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inscritos</p>
                <p className="text-2xl font-bold">{subscribedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-secondary/50">
                <FolderPlus className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Listas</p>
                <p className="text-2xl font-bold">{lists.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setAddContactOpen(true)} className="gap-2">
            <UserPlus className="w-4 h-4" />
            Adicionar Contato
          </Button>
          <Button variant="outline" onClick={() => setAddListOpen(true)} className="gap-2">
            <FolderPlus className="w-4 h-4" />
            Nova Lista
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
            <Upload className="w-4 h-4" />
            Importar CSV
          </Button>
          <Button variant="outline" onClick={() => setSyncOpen(true)} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Sincronizar Leads
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterList} onValueChange={setFilterList}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por lista" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as listas</SelectItem>
            <SelectItem value="no-list">Sem lista</SelectItem>
            {lists.map((list) => (
              <SelectItem key={list.id} value={list.id}>
                {list.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lists Summary */}
      {lists.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {lists.map((list) => {
            const count = contacts.filter(c => c.list_id === list.id).length;
            return (
              <Badge key={list.id} variant="secondary" className="gap-2 py-1.5 px-3">
                {list.name}
                <span className="bg-background/50 px-1.5 py-0.5 rounded text-xs">{count}</span>
                <button
                  onClick={() => deleteList(list.id)}
                  className="ml-1 hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Contacts Table */}
      <Card>
        <CardContent className="p-0">
          {contactsLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {contacts.length === 0
                  ? "Nenhum contato cadastrado ainda"
                  : "Nenhum contato encontrado com os filtros aplicados"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contato</TableHead>
                  <TableHead>Lista</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Adicionado em</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{contact.name || "—"}</p>
                        <p className="text-sm text-muted-foreground">{contact.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {contact.list_id ? (
                        <Badge variant="outline">{getListName(contact.list_id)}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{getSourceLabel(contact.source)}</Badge>
                    </TableCell>
                    <TableCell>
                      {contact.is_subscribed ? (
                        <Badge className="bg-success/10 text-success border-success/20">Inscrito</Badge>
                      ) : (
                        <Badge variant="destructive">Descadastrado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(contact.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => deleteContact(contact.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Contact Dialog */}
      <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Contato</DialogTitle>
            <DialogDescription>
              Adicione um novo contato à sua lista de e-mail marketing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact-email">E-mail *</Label>
              <Input
                id="contact-email"
                type="email"
                placeholder="email@exemplo.com"
                value={newContact.email}
                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-name">Nome</Label>
              <Input
                id="contact-name"
                placeholder="Nome do contato"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Telefone</Label>
              <Input
                id="contact-phone"
                placeholder="(00) 00000-0000"
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-list">Lista (opcional)</Label>
              <Select
                value={newContact.list_id}
                onValueChange={(value) => setNewContact({ ...newContact, list_id: value })}
              >
                <SelectTrigger id="contact-list">
                  <SelectValue placeholder="Selecione uma lista" />
                </SelectTrigger>
                <SelectContent>
                  {lists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddContactOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddContact} disabled={isCreatingContact}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add List Dialog */}
      <Dialog open={addListOpen} onOpenChange={setAddListOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Lista</DialogTitle>
            <DialogDescription>
              Crie uma nova lista para organizar seus contatos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="list-name">Nome da Lista *</Label>
              <Input
                id="list-name"
                placeholder="Ex: Clientes VIP"
                value={newList.name}
                onChange={(e) => setNewList({ ...newList, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="list-description">Descrição (opcional)</Label>
              <Input
                id="list-description"
                placeholder="Descreva o propósito desta lista"
                value={newList.description}
                onChange={(e) => setNewList({ ...newList, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddListOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddList} disabled={isCreatingList}>
              Criar Lista
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Contatos via CSV</DialogTitle>
            <DialogDescription>
              Faça upload de um arquivo CSV com as colunas: email, nome, telefone
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Lista de destino (opcional)</Label>
              <Select value={targetListId} onValueChange={setTargetListId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma lista" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma lista</SelectItem>
                  {lists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Arquivo CSV</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
              />
            </div>
            <div className="p-4 bg-muted rounded-lg text-sm">
              <p className="font-medium mb-2">Formato esperado:</p>
              <code className="text-xs">email,nome,telefone</code>
              <br />
              <code className="text-xs">joao@email.com,João Silva,11999998888</code>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sync from Leads Dialog */}
      <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sincronizar Leads dos Funis</DialogTitle>
            <DialogDescription>
              Importe contatos automaticamente dos leads dos seus funis que possuem e-mail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>{funnelLeads.filter(l => l.email).length}</strong> leads com e-mail disponíveis para sincronização.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Lista de destino (opcional)</Label>
              <Select value={targetListId} onValueChange={setTargetListId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma lista" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma lista</SelectItem>
                  {lists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSyncOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSync} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Sincronizar Agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
