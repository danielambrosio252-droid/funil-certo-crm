# 📱 Servidor WhatsApp Web - Documentação Completa

## 🎯 Visão Geral

Este documento contém todas as instruções para configurar o módulo WhatsApp do **Escala Certo Pro**.

O sistema é composto por duas partes:

1. **Servidor Node.js/Baileys** (VPS) - Gerencia conexões WhatsApp Web
2. **Backend Escala Certo Pro** (Lovable Cloud) - Armazena dados e fornece interface

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  WhatsApp App   │ ←→  │  Servidor VPS   │ ←→  │  Escala Certo   │
│   (Celular)     │     │   (Baileys)     │     │   Pro (CRM)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         ↑                       ↑                       ↑
         │                       │                       │
    Mensagens              Sessões,              Interface de
    Reais                  Webhooks              Atendimento
```

---

## 📁 Estrutura do Projeto

O servidor WhatsApp está na pasta `whatsapp-server/`:

```
whatsapp-server/
├── src/
│   ├── index.js              # Servidor Express principal
│   ├── managers/
│   │   └── SessionManager.js # Gerenciador de sessões Baileys
│   ├── services/
│   │   └── WebhookService.js # Comunicação com Escala Certo Pro
│   └── utils/
│       └── logger.js         # Sistema de logs
├── sessions/                  # Dados das sessões (persistência)
├── logs/                      # Logs do servidor
├── package.json
├── ecosystem.config.js        # Configuração PM2
├── install.sh                 # Script de instalação automatizada
├── .env.example               # Exemplo de variáveis de ambiente
└── README.md
```

---

## 🚀 Guia de Instalação em VPS

### Requisitos

| Requisito | Mínimo | Recomendado |
|-----------|--------|-------------|
| SO | Ubuntu 20.04 | Ubuntu 22.04 |
| RAM | 512MB | 1GB |
| CPU | 1 vCPU | 2 vCPU |
| Disco | 10GB | 20GB |
| Node.js | 18.x | 20.x LTS |

### Provedores Recomendados

- **Contabo** - Melhor custo-benefício
- **Hetzner** - Alta qualidade europeia
- **DigitalOcean** - Fácil de usar
- **Vultr** - Boa performance
- **Linode** - Confiável

### Instalação Passo a Passo

#### 1. Conectar na VPS

```bash
ssh usuario@seu-ip-vps
```

#### 2. Clonar/Copiar os arquivos

```bash
# Opção 1: Via Git
git clone [seu-repositorio] escala-whatsapp
cd escala-whatsapp/whatsapp-server

# Opção 2: Via SCP (do seu computador)
scp -r whatsapp-server/ usuario@seu-ip-vps:~/escala-whatsapp
```

#### 3. Executar instalação automatizada

```bash
chmod +x install.sh
./install.sh
```

O script irá:
- ✅ Atualizar o sistema
- ✅ Instalar Node.js 20 LTS
- ✅ Instalar PM2
- ✅ Criar diretórios necessários
- ✅ Instalar dependências
- ✅ Configurar variáveis de ambiente
- ✅ Iniciar o servidor
- ✅ Configurar auto-start

#### 4. Verificar se está funcionando

```bash
pm2 status
curl http://localhost:3001/health
```

---

## 🔧 Configuração

### Variáveis de Ambiente (.env)

```env
# Porta do servidor (padrão: 3001)
PORT=3001

# URL do webhook do Escala Certo Pro (OBRIGATÓRIO)
WEBHOOK_URL=https://ysiszrxwbargoyqrrehr.supabase.co/functions/v1/whatsapp-webhook

# Segredo para validar webhooks (opcional)
WEBHOOK_SECRET=seu_segredo_aqui

# Ambiente
NODE_ENV=production

# Tempo de reconexão em ms
RECONNECT_TIMEOUT=5000

# Tentativas de reconexão
MAX_RECONNECT_ATTEMPTS=10

# Diretório de sessões
SESSIONS_DIR=./sessions
```

### Configurar HTTPS (Recomendado)

```bash
# Instalar Nginx
sudo apt install nginx

# Instalar Certbot
sudo apt install certbot python3-certbot-nginx

# Obter certificado SSL
sudo certbot --nginx -d whatsapp.seudominio.com
```

Configuração Nginx:

```nginx
server {
    listen 443 ssl;
    server_name whatsapp.seudominio.com;
    
    ssl_certificate /etc/letsencrypt/live/whatsapp.seudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/whatsapp.seudominio.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 📡 API do Servidor

### Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/connect` | Iniciar sessão WhatsApp |
| `POST` | `/disconnect` | Encerrar sessão |
| `POST` | `/send` | Enviar mensagem |
| `GET` | `/status` | Status de todas as sessões |
| `GET` | `/status/:company_id` | Status de uma sessão |
| `GET` | `/health` | Health check |
| `POST` | `/restart/:company_id` | Reiniciar sessão |
| `DELETE` | `/session/:company_id` | Remover sessão |

### Exemplos de Uso

**Iniciar conexão:**
```bash
curl -X POST http://localhost:3001/connect \
  -H "Content-Type: application/json" \
  -d '{"company_id": "uuid-da-empresa"}'
```

**Enviar mensagem:**
```bash
curl -X POST http://localhost:3001/send \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "uuid-da-empresa",
    "phone": "5511999999999",
    "content": "Olá! Mensagem de teste.",
    "message_id": "local-uuid"
  }'
```

**Verificar status:**
```bash
curl http://localhost:3001/status
```

---

## 📊 Eventos de Webhook

O servidor envia eventos para o Escala Certo Pro:

| Evento | Quando | Dados |
|--------|--------|-------|
| `qr_code` | QR Code gerado | `qr_code` (base64) |
| `connected` | Sessão conectada | `phone_number` |
| `disconnected` | Sessão desconectada | `reason` |
| `message_received` | Mensagem recebida | `from`, `content`, `sender_name`, `message_type` |
| `message_sent` | Mensagem enviada | `local_id`, `message_id` |
| `message_status` | Status atualizado | `message_id`, `status` |

### Formato do Payload

```json
{
  "type": "message_received",
  "company_id": "uuid-da-empresa",
  "data": {
    "message_id": "ABC123XYZ",
    "from": "5511999999999",
    "content": "Olá, preciso de ajuda!",
    "sender_name": "Maria Silva",
    "message_type": "text"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## 🔄 Fluxo de Funcionamento

### Conexão

1. Usuário clica em "Conectar WhatsApp" no CRM
2. CRM chama Edge Function `whatsapp-session` com action `connect`
3. Edge Function notifica servidor VPS via `/connect`
4. Servidor gera QR Code e envia webhook `qr_code`
5. Edge Function atualiza tabela `whatsapp_sessions`
6. CRM exibe QR Code em tempo real
7. Usuário escaneia com WhatsApp
8. Servidor envia webhook `connected`
9. Sessão salva para persistência

### Envio de Mensagem

1. Usuário digita mensagem no CRM
2. CRM chama Edge Function `whatsapp-send`
3. Edge Function cria registro em `whatsapp_messages`
4. Edge Function chama servidor VPS via `/send`
5. Servidor envia via WhatsApp Web
6. Servidor envia webhook `message_sent`
7. Edge Function atualiza status da mensagem

### Recebimento de Mensagem

1. Contato envia mensagem no WhatsApp
2. Servidor recebe via Baileys
3. Servidor envia webhook `message_received`
4. Edge Function cria/atualiza contato
5. Edge Function salva mensagem
6. CRM atualiza via Realtime subscription

---

## 📝 Comandos Úteis

### PM2

```bash
pm2 status                    # Ver status
pm2 logs escala-whatsapp      # Ver logs
pm2 restart escala-whatsapp   # Reiniciar
pm2 stop escala-whatsapp      # Parar
pm2 delete escala-whatsapp    # Remover
pm2 monit                     # Monitor interativo
```

### Manutenção

```bash
# Ver uso de memória
pm2 show escala-whatsapp

# Limpar logs antigos
pm2 flush

# Atualizar servidor
git pull
npm install
pm2 restart escala-whatsapp
```

### Backup de Sessões

```bash
# Criar backup
tar -czvf sessoes-backup-$(date +%Y%m%d).tar.gz sessions/

# Restaurar backup
tar -xzvf sessoes-backup-20240115.tar.gz
```

---

## 🐛 Troubleshooting

### QR Code não aparece

1. Verifique logs: `pm2 logs escala-whatsapp`
2. Confirme webhook URL no .env
3. Teste webhook: `curl -X POST [WEBHOOK_URL] -d '{"type":"test"}'`

### Sessão não reconecta

1. Verifique se há creds.json em `sessions/[company_id]/`
2. Remova a sessão e reconecte: `rm -rf sessions/[company_id]`
3. Reinicie o servidor: `pm2 restart escala-whatsapp`

### Mensagens não chegam

1. Verifique status: `curl http://localhost:3001/status`
2. Confirme que a sessão está `connected`
3. Verifique logs do webhook

### Erro de memória

1. Aumente a RAM da VPS
2. Configure limite no PM2: `max_memory_restart: '500M'`
3. Monitore uso: `pm2 monit`

---

## ⚠️ Avisos Importantes

> **ATENÇÃO**: O WhatsApp pode banir números que:
> - Enviam muitas mensagens em curto período
> - Enviam para números que não têm você salvo
> - São denunciados por spam
> - Usam automação de forma abusiva

### Boas Práticas

- ✅ Responda apenas a contatos que iniciaram conversa
- ✅ Mantenha intervalos entre mensagens
- ✅ Não envie links suspeitos
- ✅ Personalize mensagens
- ❌ Não envie spam ou mensagens em massa
- ❌ Não use para cold outreach agressivo

---

## 📋 Checklist de Validação

Antes de considerar o módulo pronto, verifique:

- [ ] Servidor inicia sem erros
- [ ] QR Code é exibido no CRM
- [ ] Escaneamento conecta a sessão
- [ ] Sessão persiste após reinício do servidor
- [ ] Mensagem enviada pelo CRM chega no celular
- [ ] Mensagem enviada pelo celular aparece no CRM
- [ ] Mensagens são salvas no banco
- [ ] Cada empresa vê apenas seu WhatsApp
- [ ] Reconexão automática funciona
- [ ] Logs são gerados corretamente

---

## 🔐 Tabelas do Banco de Dados

O sistema usa as seguintes tabelas:

### whatsapp_sessions
Armazena sessões ativas de WhatsApp por empresa.

### whatsapp_contacts
Armazena contatos que interagiram via WhatsApp.

### whatsapp_messages
Armazena histórico de mensagens enviadas e recebidas.

Todas as tabelas têm RLS habilitado para isolamento multi-tenant.

---

## 📞 Suporte

Em caso de problemas:

1. Verifique os logs: `pm2 logs escala-whatsapp`
2. Consulte esta documentação
3. Verifique o README na pasta `whatsapp-server/`
