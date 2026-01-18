# 📱 Servidor WhatsApp - Baileys (Node.js)

Este documento explica como configurar o servidor Node.js externo necessário para o módulo WhatsApp do **Escala Certo Pro**.

## 📋 Pré-requisitos

- Node.js 18+
- NPM ou Yarn
- Hospedagem (Railway, Render, VPS, etc.)

## 🚀 Instalação Rápida

### 1. Clone o projeto base

```bash
mkdir whatsapp-server
cd whatsapp-server
npm init -y
```

### 2. Instale as dependências

```bash
npm install @whiskeysockets/baileys express qrcode pino cors
```

### 3. Crie o arquivo `server.js`

```javascript
const express = require('express');
const cors = require('cors');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');

const app = express();
app.use(cors());
app.use(express.json());

// Configuração
const PORT = process.env.PORT || 3001;
const WEBHOOK_URL = process.env.WEBHOOK_URL; // URL do Escala Certo Pro

// Armazenar sessões por empresa
const sessions = new Map();

// Logger silencioso para produção
const logger = pino({ level: 'silent' });

// Enviar evento para o CRM
async function sendWebhook(companyId, type, data) {
  if (!WEBHOOK_URL) return;
  
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: companyId, type, data })
    });
    console.log(`[${companyId}] Webhook enviado: ${type}`);
  } catch (error) {
    console.error(`[${companyId}] Erro no webhook:`, error.message);
  }
}

// Criar ou reconectar sessão
async function createSession(companyId) {
  if (sessions.has(companyId)) {
    console.log(`[${companyId}] Sessão já existe`);
    return;
  }

  const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${companyId}`);
  
  const socket = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: true,
    browser: ['Escala Certo Pro', 'Chrome', '120.0.0.0']
  });

  sessions.set(companyId, socket);

  // Evento de conexão
  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Gerar QR Code como imagem base64
      const qrImage = await QRCode.toDataURL(qr);
      await sendWebhook(companyId, 'qr_code', { qr_code: qrImage });
      console.log(`[${companyId}] QR Code gerado`);
    }

    if (connection === 'open') {
      const phoneNumber = socket.user?.id?.split(':')[0] || '';
      await sendWebhook(companyId, 'connected', { phone_number: phoneNumber });
      console.log(`[${companyId}] Conectado: ${phoneNumber}`);
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      
      if (shouldReconnect) {
        console.log(`[${companyId}] Reconectando...`);
        sessions.delete(companyId);
        setTimeout(() => createSession(companyId), 5000);
      } else {
        await sendWebhook(companyId, 'disconnected', {});
        sessions.delete(companyId);
        console.log(`[${companyId}] Desconectado (logout)`);
      }
    }
  });

  // Salvar credenciais
  socket.ev.on('creds.update', saveCreds);

  // Receber mensagens
  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      // Ignorar mensagens enviadas por mim
      if (msg.key.fromMe) continue;
      
      // Ignorar status/stories
      if (msg.key.remoteJid === 'status@broadcast') continue;

      const phone = msg.key.remoteJid?.replace('@s.whatsapp.net', '') || '';
      const content = msg.message?.conversation || 
                     msg.message?.extendedTextMessage?.text || 
                     msg.message?.imageMessage?.caption ||
                     '[Mídia]';
      
      const senderName = msg.pushName || '';

      await sendWebhook(companyId, 'message_received', {
        message_id: msg.key.id,
        from: phone,
        content,
        sender_name: senderName,
        message_type: 'text'
      });

      console.log(`[${companyId}] Mensagem de ${phone}: ${content.substring(0, 50)}`);
    }
  });

  // Atualização de status das mensagens
  socket.ev.on('messages.update', async (updates) => {
    for (const update of updates) {
      if (update.update.status) {
        const statusMap = {
          2: 'sent',
          3: 'delivered', 
          4: 'read'
        };
        
        const status = statusMap[update.update.status];
        if (status) {
          await sendWebhook(companyId, 'message_status', {
            message_id: update.key.id,
            status
          });
        }
      }
    }
  });

  return socket;
}

// ==================== ENDPOINTS ====================

// Iniciar conexão
app.post('/connect', async (req, res) => {
  const { company_id } = req.body;
  
  if (!company_id) {
    return res.status(400).json({ error: 'company_id é obrigatório' });
  }

  try {
    await createSession(company_id);
    res.json({ success: true, message: 'Conexão iniciada' });
  } catch (error) {
    console.error('Erro ao conectar:', error);
    res.status(500).json({ error: error.message });
  }
});

// Desconectar
app.post('/disconnect', async (req, res) => {
  const { company_id } = req.body;
  
  const socket = sessions.get(company_id);
  if (socket) {
    await socket.logout();
    sessions.delete(company_id);
  }

  res.json({ success: true, message: 'Desconectado' });
});

// Enviar mensagem
app.post('/send', async (req, res) => {
  const { message_id, phone, content, message_type } = req.body;

  // Encontrar sessão (assumindo single-tenant por enquanto)
  // Em produção, você passaria company_id
  const [companyId, socket] = [...sessions.entries()][0] || [];

  if (!socket) {
    return res.status(400).json({ error: 'Nenhuma sessão ativa' });
  }

  try {
    const jid = `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
    
    const result = await socket.sendMessage(jid, { text: content });
    
    // Notificar que mensagem foi enviada
    await sendWebhook(companyId, 'message_sent', {
      local_id: message_id,
      message_id: result.key.id
    });

    res.json({ success: true, message_id: result.key.id });
  } catch (error) {
    console.error('Erro ao enviar:', error);
    res.status(500).json({ error: error.message });
  }
});

// Status do servidor
app.get('/status', (req, res) => {
  const sessionsInfo = {};
  
  sessions.forEach((socket, companyId) => {
    sessionsInfo[companyId] = {
      connected: !!socket.user,
      phone: socket.user?.id?.split(':')[0] || null
    };
  });

  res.json({
    status: 'online',
    sessions: sessionsInfo,
    total: sessions.size
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor WhatsApp rodando na porta ${PORT}`);
  console.log(`📡 Webhook URL: ${WEBHOOK_URL || 'NÃO CONFIGURADO'}`);
});
```

### 4. Configure as variáveis de ambiente

Crie um arquivo `.env`:

```env
PORT=3001
WEBHOOK_URL=https://ysiszrxwbargoyqrrehr.supabase.co/functions/v1/whatsapp-webhook
```

### 5. Inicie o servidor

```bash
node server.js
```

## 🌐 Deploy no Railway

1. Crie uma conta em [railway.app](https://railway.app)
2. Conecte seu repositório GitHub
3. Adicione a variável `WEBHOOK_URL` nas configurações
4. Deploy automático!

## 🔧 Configuração no Escala Certo Pro

1. Acesse **WhatsApp → Configuração**
2. Cole a URL do seu servidor Railway (ex: `https://seu-app.railway.app`)
3. Clique em **Salvar Configuração**
4. Clique em **Conectar WhatsApp**
5. Escaneie o QR Code

## 📊 Fluxo de Dados

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  WhatsApp App   │ ←→  │  Servidor Node  │ ←→  │  Escala Certo   │
│   (Celular)     │     │   (Baileys)     │     │   Pro (CRM)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ↑                       ↑                       ↑
        │                       │                       │
   Mensagens              QR Code,             Interface de
   Reais                  Eventos              Atendimento
```

## 🔒 Segurança

- Use HTTPS em produção
- Configure firewall para aceitar apenas IPs do Supabase
- Não exponha o servidor na internet sem proteção
- Considere usar autenticação por token

## 📝 Endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/connect` | Iniciar sessão WhatsApp |
| POST | `/disconnect` | Encerrar sessão |
| POST | `/send` | Enviar mensagem |
| GET | `/status` | Status das sessões |
| GET | `/health` | Health check |

## ⚠️ Importante

- O WhatsApp pode banir números que usam automação excessiva
- Respeite os limites de mensagens
- Esta é uma integração não-oficial (WhatsApp Web)
- Para uso comercial em escala, considere a API oficial do Meta
