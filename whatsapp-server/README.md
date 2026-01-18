# 📱 Servidor WhatsApp - Escala Certo Pro

Servidor Node.js com Baileys para integração WhatsApp Web do Escala Certo Pro.

## 🚀 Características

- ✅ Conexão via QR Code
- ✅ Persistência de sessão (sobrevive a reinícios)
- ✅ Reconexão automática em caso de queda
- ✅ Suporte a multi-tenant (1 WhatsApp por empresa)
- ✅ Envio e recebimento de mensagens de texto
- ✅ Notificações em tempo real via webhook
- ✅ Logs estruturados
- ✅ Pronto para produção com PM2

## 📋 Requisitos

- Ubuntu 20.04+ (ou qualquer Linux com systemd)
- Node.js 18+ (recomendado: 20 LTS)
- 512MB RAM mínimo (1GB recomendado)
- 10GB disco (sessões crescem com o tempo)

## ⚡ Instalação Rápida (VPS)

```bash
# 1. Clone ou copie os arquivos para sua VPS
git clone [seu-repo] whatsapp-server
cd whatsapp-server

# 2. Execute o script de instalação
chmod +x install.sh
./install.sh
```

## 🔧 Instalação Manual

### 1. Instalar Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Instalar PM2

```bash
sudo npm install -g pm2
```

### 3. Configurar projeto

```bash
cd whatsapp-server
npm install
cp .env.example .env
```

### 4. Editar .env

```bash
nano .env
```

```env
PORT=3001
WEBHOOK_URL=https://[seu-projeto].supabase.co/functions/v1/whatsapp-webhook
NODE_ENV=production
```

### 5. Iniciar com PM2

```bash
npm run pm2:start
pm2 startup  # Configurar auto-start
pm2 save     # Salvar configuração
```

## 📡 Endpoints da API

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

### Exemplos

#### Iniciar conexão
```bash
curl -X POST http://localhost:3001/connect \
  -H "Content-Type: application/json" \
  -d '{"company_id": "empresa-123"}'
```

#### Enviar mensagem
```bash
curl -X POST http://localhost:3001/send \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "empresa-123",
    "phone": "5511999999999",
    "content": "Olá! Esta é uma mensagem de teste."
  }'
```

#### Verificar status
```bash
curl http://localhost:3001/status
```

## 📊 Eventos do Webhook

O servidor envia os seguintes eventos para o Escala Certo Pro:

| Evento | Descrição |
|--------|-----------|
| `qr_code` | QR Code gerado para escanear |
| `connected` | Sessão conectada com sucesso |
| `disconnected` | Sessão desconectada |
| `message_received` | Mensagem recebida |
| `message_sent` | Mensagem enviada |
| `message_status` | Atualização de status (sent/delivered/read) |

### Formato do payload

```json
{
  "type": "message_received",
  "company_id": "empresa-123",
  "data": {
    "message_id": "ABC123",
    "from": "5511999999999",
    "content": "Olá!",
    "sender_name": "João",
    "message_type": "text"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🗂️ Estrutura do Projeto

```
whatsapp-server/
├── src/
│   ├── index.js              # Entrada principal
│   ├── managers/
│   │   └── SessionManager.js # Gerenciador de sessões
│   ├── services/
│   │   └── WebhookService.js # Envio de webhooks
│   └── utils/
│       └── logger.js         # Utilitário de logs
├── sessions/                  # Dados das sessões (gitignore)
├── logs/                      # Logs do servidor
├── package.json
├── ecosystem.config.js        # Configuração PM2
├── install.sh                 # Script de instalação
├── .env.example
└── README.md
```

## 🔒 Segurança

### Recomendações para Produção

1. **Firewall**: Libere apenas a porta necessária
   ```bash
   sudo ufw allow 3001/tcp
   sudo ufw enable
   ```

2. **Reverse Proxy (Nginx)**: Use HTTPS
   ```nginx
   server {
       listen 443 ssl;
       server_name whatsapp.seudominio.com;
       
       ssl_certificate /etc/letsencrypt/live/seudominio/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/seudominio/privkey.pem;
       
       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

3. **Webhook Secret**: Configure `WEBHOOK_SECRET` no .env

4. **Backup**: Faça backup regular da pasta `sessions/`

## 🐛 Troubleshooting

### Sessão não conecta

1. Verifique os logs: `pm2 logs escala-whatsapp`
2. Certifique-se de que o WhatsApp está aberto no celular
3. Verifique a conexão com internet

### QR Code não aparece

1. Verifique se o webhook está configurado corretamente
2. Veja se a URL do webhook está acessível
3. Confira os logs do servidor

### Mensagens não chegam

1. Verifique se a sessão está conectada: `curl http://localhost:3001/status`
2. Verifique os logs para erros de webhook
3. Confirme se o número está no formato correto (com DDI)

### Reiniciar após problemas

```bash
# Parar servidor
pm2 stop escala-whatsapp

# Limpar sessão problemática
rm -rf sessions/[company_id]

# Reiniciar
pm2 start escala-whatsapp

# Ver logs
pm2 logs escala-whatsapp
```

## 📝 Comandos PM2 Úteis

```bash
pm2 status                    # Ver status
pm2 logs escala-whatsapp      # Ver logs em tempo real
pm2 restart escala-whatsapp   # Reiniciar
pm2 stop escala-whatsapp      # Parar
pm2 delete escala-whatsapp    # Remover processo
pm2 monit                     # Monitor interativo
```

## ⚠️ Avisos Importantes

- O WhatsApp pode banir números que usam automação excessiva
- Respeite os limites de mensagens do WhatsApp
- Esta é uma integração não-oficial (WhatsApp Web)
- Não envie spam ou mensagens em massa
- Mantenha o servidor atualizado

## 📄 Licença

MIT - Escala Certo Pro
