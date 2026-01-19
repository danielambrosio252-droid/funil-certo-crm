import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Eye, 
  Code, 
  Smartphone, 
  Monitor,
  Image,
  Link,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  List,
  Type,
} from "lucide-react";

interface EmailEditorProps {
  template: string;
  subject: string;
  preheader: string;
  onContentChange: (content: EmailContent) => void;
}

export interface EmailContent {
  headline: string;
  bodyText: string;
  ctaText: string;
  ctaUrl: string;
  footerText: string;
  logoUrl: string;
  primaryColor: string;
}

const templateDefaults: Record<string, Partial<EmailContent>> = {
  welcome: {
    headline: "Bem-vindo(a) à nossa família!",
    bodyText: "Estamos muito felizes em ter você conosco. A partir de agora, você terá acesso a conteúdos exclusivos, ofertas especiais e muito mais.\n\nPrepare-se para uma jornada incrível!",
    ctaText: "Conhecer Mais",
    ctaUrl: "https://seusite.com/comecar",
    footerText: "Você está recebendo este e-mail porque se cadastrou em nossa plataforma.",
  },
  promotion: {
    headline: "🎉 Oferta Imperdível!",
    bodyText: "Por tempo limitado, estamos oferecendo condições especiais exclusivas para você.\n\nNão perca esta oportunidade única de economizar!",
    ctaText: "Aproveitar Agora",
    ctaUrl: "https://seusite.com/oferta",
    footerText: "Esta oferta é válida até o final do mês.",
  },
  newsletter: {
    headline: "Novidades da Semana",
    bodyText: "Confira as últimas atualizações e novidades do nosso universo. Selecionamos os melhores conteúdos especialmente para você.\n\n📌 Destaque 1: Lorem ipsum dolor sit amet\n📌 Destaque 2: Consectetur adipiscing elit\n📌 Destaque 3: Sed do eiusmod tempor",
    ctaText: "Ler Mais",
    ctaUrl: "https://seusite.com/blog",
    footerText: "Você está inscrito em nossa newsletter semanal.",
  },
  "follow-up": {
    headline: "Temos uma proposta para você!",
    bodyText: "Notamos que você demonstrou interesse em nossos serviços. Gostaríamos de conversar mais sobre como podemos ajudar você a alcançar seus objetivos.\n\nPodemos agendar uma conversa?",
    ctaText: "Agendar Reunião",
    ctaUrl: "https://seusite.com/agendar",
    footerText: "Se preferir, responda este e-mail diretamente.",
  },
  "abandoned-cart": {
    headline: "Você esqueceu algo no carrinho! 🛒",
    bodyText: "Notamos que você deixou alguns itens no seu carrinho de compras. Não se preocupe, guardamos tudo para você!\n\nFinalize sua compra agora e aproveite frete grátis.",
    ctaText: "Finalizar Compra",
    ctaUrl: "https://seusite.com/carrinho",
    footerText: "Seu carrinho expira em 24 horas.",
  },
  birthday: {
    headline: "🎂 Feliz Aniversário!",
    bodyText: "Hoje é um dia muito especial e queremos celebrar com você!\n\nPreparamos um presente exclusivo: use o cupom ANIVERSARIO para ganhar 20% de desconto em qualquer compra.",
    ctaText: "Resgatar Presente",
    ctaUrl: "https://seusite.com/presente",
    footerText: "Válido por 7 dias a partir da data de aniversário.",
  },
  survey: {
    headline: "Sua opinião é muito importante!",
    bodyText: "Gostaríamos de saber como foi sua experiência conosco. Sua avaliação nos ajuda a melhorar cada vez mais.\n\nA pesquisa leva apenas 2 minutos!",
    ctaText: "Responder Pesquisa",
    ctaUrl: "https://seusite.com/pesquisa",
    footerText: "Como agradecimento, você concorrerá a prêmios exclusivos.",
  },
  "product-launch": {
    headline: "🚀 Lançamento Exclusivo!",
    bodyText: "É com muito orgulho que apresentamos nossa mais nova criação!\n\nDesenvolvido com tecnologia de ponta e pensado especialmente para você. Seja um dos primeiros a experimentar.",
    ctaText: "Conhecer Agora",
    ctaUrl: "https://seusite.com/lancamento",
    footerText: "Condições especiais para os primeiros compradores.",
  },
};

export function EmailEditor({ template, subject, preheader, onContentChange }: EmailEditorProps) {
  const defaults = templateDefaults[template] || templateDefaults.welcome;
  
  const [content, setContent] = useState<EmailContent>({
    headline: defaults.headline || "",
    bodyText: defaults.bodyText || "",
    ctaText: defaults.ctaText || "",
    ctaUrl: defaults.ctaUrl || "",
    footerText: defaults.footerText || "",
    logoUrl: "",
    primaryColor: "#3b82f6",
  });

  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");

  const updateContent = (field: keyof EmailContent, value: string) => {
    const newContent = { ...content, [field]: value };
    setContent(newContent);
    onContentChange(newContent);
  };

  const EmailPreview = () => (
    <div 
      className={`bg-white rounded-lg shadow-lg overflow-hidden transition-all ${
        viewMode === "mobile" ? "max-w-[375px] mx-auto" : "w-full"
      }`}
    >
      {/* Email Header */}
      <div className="bg-muted/30 px-4 py-2 text-xs text-muted-foreground border-b">
        <div className="flex items-center gap-2">
          <span className="font-medium">De:</span>
          <span>sua-empresa@email.com</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">Assunto:</span>
          <span className="text-foreground">{subject || "Sem assunto"}</span>
        </div>
        {preheader && (
          <div className="text-muted-foreground/70 truncate mt-1">
            {preheader}
          </div>
        )}
      </div>

      {/* Email Body */}
      <div className="p-6" style={{ backgroundColor: "#f8fafc" }}>
        <div className="bg-white rounded-lg overflow-hidden shadow-sm max-w-[600px] mx-auto">
          {/* Logo Area */}
          <div 
            className="p-6 text-center"
            style={{ backgroundColor: content.primaryColor }}
          >
            {content.logoUrl ? (
              <img 
                src={content.logoUrl} 
                alt="Logo" 
                className="h-12 mx-auto"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="text-white font-bold text-xl">
                SUA LOGO
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <h1 
              className="text-2xl font-bold text-center"
              style={{ color: content.primaryColor }}
            >
              {content.headline || "Título do E-mail"}
            </h1>
            
            <div className="text-gray-600 whitespace-pre-line leading-relaxed">
              {content.bodyText || "Conteúdo do e-mail..."}
            </div>

            {content.ctaText && (
              <div className="text-center py-4">
                <a
                  href={content.ctaUrl || "#"}
                  className="inline-block px-6 py-3 rounded-lg text-white font-medium transition-opacity hover:opacity-90"
                  style={{ backgroundColor: content.primaryColor }}
                >
                  {content.ctaText}
                </a>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-100 p-4 text-center text-xs text-gray-500">
            <p>{content.footerText || "Texto do rodapé"}</p>
            <p className="mt-2">
              <a href="#" className="underline">Cancelar inscrição</a>
              {" | "}
              <a href="#" className="underline">Preferências</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Tabs defaultValue="edit" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="edit" className="gap-2">
              <Code className="w-4 h-4" />
              Editar
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="w-4 h-4" />
              Pré-visualizar
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-1">
            <Button
              variant={viewMode === "desktop" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("desktop")}
            >
              <Monitor className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "mobile" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("mobile")}
            >
              <Smartphone className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <TabsContent value="edit" className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            {/* Editor Panel */}
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Type className="w-4 h-4 text-primary" />
                    <h3 className="font-medium">Conteúdo</h3>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="headline">Título Principal</Label>
                    <Input
                      id="headline"
                      value={content.headline}
                      onChange={(e) => updateContent("headline", e.target.value)}
                      placeholder="Digite o título do e-mail"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bodyText">Corpo do E-mail</Label>
                    <div className="flex items-center gap-1 mb-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <Bold className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <Italic className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <AlignLeft className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <AlignCenter className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <List className="w-3 h-3" />
                      </Button>
                    </div>
                    <Textarea
                      id="bodyText"
                      value={content.bodyText}
                      onChange={(e) => updateContent("bodyText", e.target.value)}
                      placeholder="Digite o conteúdo do e-mail"
                      rows={6}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Link className="w-4 h-4 text-primary" />
                    <h3 className="font-medium">Botão de Ação (CTA)</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ctaText">Texto do Botão</Label>
                      <Input
                        id="ctaText"
                        value={content.ctaText}
                        onChange={(e) => updateContent("ctaText", e.target.value)}
                        placeholder="Ex: Saiba Mais"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ctaUrl">URL do Botão</Label>
                      <Input
                        id="ctaUrl"
                        value={content.ctaUrl}
                        onChange={(e) => updateContent("ctaUrl", e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Image className="w-4 h-4 text-primary" />
                    <h3 className="font-medium">Personalização</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="logoUrl">URL da Logo</Label>
                      <Input
                        id="logoUrl"
                        value={content.logoUrl}
                        onChange={(e) => updateContent("logoUrl", e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="primaryColor">Cor Principal</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          id="primaryColor"
                          value={content.primaryColor}
                          onChange={(e) => updateContent("primaryColor", e.target.value)}
                          className="w-12 h-9 p-1 cursor-pointer"
                        />
                        <Input
                          value={content.primaryColor}
                          onChange={(e) => updateContent("primaryColor", e.target.value)}
                          placeholder="#3b82f6"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="footerText">Texto do Rodapé</Label>
                    <Input
                      id="footerText"
                      value={content.footerText}
                      onChange={(e) => updateContent("footerText", e.target.value)}
                      placeholder="Texto legal ou informativo"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Variable Tags */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium mb-3">Variáveis Disponíveis</h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    Clique para copiar e use no conteúdo do e-mail:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { tag: "{{nome}}", label: "Nome do contato" },
                      { tag: "{{email}}", label: "E-mail" },
                      { tag: "{{empresa}}", label: "Empresa" },
                      { tag: "{{data}}", label: "Data atual" },
                    ].map((variable) => (
                      <Badge
                        key={variable.tag}
                        variant="secondary"
                        className="cursor-pointer hover:bg-primary/20"
                        onClick={() => {
                          navigator.clipboard.writeText(variable.tag);
                        }}
                      >
                        {variable.tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Live Preview */}
            <div className="sticky top-4">
              <div className="text-sm font-medium mb-2 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Pré-visualização em Tempo Real
              </div>
              <div className="border rounded-lg overflow-hidden bg-muted/20 max-h-[600px] overflow-y-auto">
                <EmailPreview />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <div className="border rounded-lg overflow-hidden bg-muted/20">
            <EmailPreview />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
