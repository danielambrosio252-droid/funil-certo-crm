#!/bin/bash

# =====================================================
# ESCALA CERTO PRO - WHATSAPP SERVER
# Script de Instalação Completo para VPS
# =====================================================
#
# USO:
#   curl -sSL [URL] | bash
#   ou
#   bash setup-vps.sh
#
# REQUISITOS:
#   - Ubuntu 20.04+
#   - Acesso root ou sudo
#   - Conexão com internet
#
# =====================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configurações
INSTALL_DIR="$HOME/whatsapp-server"
PORT="${PORT:-3001}"

echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║     🚀 ESCALA CERTO PRO - WHATSAPP SERVER                 ║"
echo "║                                                            ║"
echo "║     Instalação Automática para VPS                        ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

log_info() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "${BLUE}[→]${NC} $1"; }

# =====================================================
# 1. VERIFICAÇÕES INICIAIS
# =====================================================
log_step "Verificando sistema..."

if [ "$EUID" -eq 0 ]; then
  log_warn "Executando como root. Recomendado usar usuário normal com sudo."
fi

# Verificar se é Ubuntu/Debian
if ! command -v apt &> /dev/null; then
  log_error "Este script requer Ubuntu/Debian (apt)"
  exit 1
fi

log_info "Sistema compatível detectado"

# =====================================================
# 2. ATUALIZAR SISTEMA E INSTALAR DEPENDÊNCIAS
# =====================================================
log_step "Atualizando sistema..."
sudo apt update -y
sudo apt upgrade -y

log_step "Instalando dependências do sistema..."
sudo apt install -y curl wget git build-essential

# =====================================================
# 3. INSTALAR NODE.JS 20 LTS
# =====================================================
log_step "Verificando Node.js..."

if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VERSION" -ge 18 ]; then
    log_info "Node.js $(node -v) já instalado"
  else
    log_warn "Node.js muito antigo, atualizando..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
  fi
else
  log_step "Instalando Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
  log_info "Node.js $(node -v) instalado"
fi

# =====================================================
# 4. INSTALAR PM2
# =====================================================
log_step "Verificando PM2..."

if command -v pm2 &> /dev/null; then
  log_info "PM2 já instalado"
else
  log_step "Instalando PM2..."
  sudo npm install -g pm2
  log_info "PM2 instalado"
fi

# =====================================================
# 5. CRIAR ESTRUTURA DE DIRETÓRIOS
# =====================================================
log_step "Criando estrutura de diretórios..."

mkdir -p "$INSTALL_DIR"/{src/managers,src/services,src/utils,sessions,logs}
cd "$INSTALL_DIR"

log_info "Diretórios criados em $INSTALL_DIR"

# =====================================================
# 6. CRIAR ARQUIVOS DO PROJETO
# =====================================================
log_step "Criando arquivos do projeto..."

# package.json
cat > package.json << 'PACKAGE_EOF'
{
  "name": "escala-certo-whatsapp-server",
  "version": "1.0.0",
  "description": "Servidor WhatsApp Web para Escala Certo Pro usando Baileys",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "pm2:start": "pm2 start ecosystem.config.js",
    "pm2:stop": "pm2 stop escala-whatsapp",
    "pm2:restart": "pm2 restart escala-whatsapp",
    "pm2:logs": "pm2 logs escala-whatsapp"
  },
  "keywords": ["whatsapp", "baileys", "escala-certo"],
  "author": "Escala Certo Pro",
  "license": "MIT",
  "dependencies": {
    "@whiskeysockets/baileys": "^6.7.16",
    "cors": "^2.8.5",
    "dotenv": "^16.5.0",
    "express": "^4.21.2",
    "pino": "^9.6.0",
    "qrcode-terminal": "^0.12.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
PACKAGE_EOF

# ecosystem.config.js (PM2)
cat > ecosystem.config.js << 'PM2_EOF'
module.exports = {
  apps: [
    {
      name: 'escala-whatsapp',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: 'logs/error.log',
      out_file: 'logs/output.log',
      log_file: 'logs/combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
PM2_EOF

# .env
cat > .env << ENV_EOF
PORT=3001
WEBHOOK_URL=https://ysiszrxwbargoyqrrehr.supabase.co/functions/v1/whatsapp-webhook
NODE_ENV=production
SESSIONS_DIR=./sessions
ENV_EOF

# src/utils/logger.js
cat > src/utils/logger.js << 'LOGGER_EOF'
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  }
});

// Fallback se pino-pretty não estiver disponível
const simpleLogger = {
  info: (...args) => console.log('[INFO]', new Date().toISOString(), ...args),
  warn: (...args) => console.warn('[WARN]', new Date().toISOString(), ...args),
  error: (...args) => console.error('[ERROR]', new Date().toISOString(), ...args),
  debug: (...args) => console.log('[DEBUG]', new Date().toISOString(), ...args),
  child: () => simpleLogger
};

module.exports = process.env.NODE_ENV === 'production' ? simpleLogger : (logger || simpleLogger);
LOGGER_EOF

# src/services/WebhookService.js
cat > src/services/WebhookService.js << 'WEBHOOK_EOF'
const logger = require('../utils/logger');

class WebhookService {
  constructor(webhookUrl, webhookSecret = null) {
    this.webhookUrl = webhookUrl;
    this.webhookSecret = webhookSecret;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }

  async send(companyId, eventType, data) {
    if (!this.webhookUrl) {
      logger.warn('Webhook URL não configurada');
      return false;
    }

    const payload = {
      company_id: companyId,
      event: eventType,
      data: data,
      timestamp: new Date().toISOString()
    };

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const headers = {
          'Content-Type': 'application/json'
        };

        if (this.webhookSecret) {
          headers['X-Webhook-Secret'] = this.webhookSecret;
        }

        const response = await fetch(this.webhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          logger.info(`Webhook enviado: ${eventType} para empresa ${companyId}`);
          return true;
        }

        logger.warn(`Webhook falhou (tentativa ${attempt}): ${response.status}`);
      } catch (error) {
        logger.error(`Erro no webhook (tentativa ${attempt}):`, error.message);
      }

      if (attempt < this.retryAttempts) {
        await new Promise(r => setTimeout(r, this.retryDelay * attempt));
      }
    }

    return false;
  }
}

module.exports = WebhookService;
WEBHOOK_EOF

# src/managers/SessionManager.js
cat > src/managers/SessionManager.js << 'SESSION_EOF'
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

class SessionManager {
  constructor(webhookService) {
    this.sessions = new Map();
    this.sessionStatus = new Map();
    this.reconnectAttempts = new Map();
    this.webhookService = webhookService;
    this.sessionsDir = process.env.SESSIONS_DIR || './sessions';
    this.maxReconnectAttempts = 10;
    
    // Criar diretório de sessões
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  async createSession(companyId) {
    logger.info(`Criando sessão para empresa: ${companyId}`);
    
    // Verificar se já existe sessão ativa
    if (this.sessions.has(companyId)) {
      const status = this.sessionStatus.get(companyId);
      if (status === 'connected') {
        logger.warn(`Sessão já conectada para empresa: ${companyId}`);
        return { status: 'already_connected' };
      }
      // Desconectar sessão anterior
      await this.disconnectSession(companyId);
    }

    this.sessionStatus.set(companyId, 'connecting');
    this.reconnectAttempts.set(companyId, 0);

    try {
      const sessionPath = path.join(this.sessionsDir, companyId);
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      const { version } = await fetchLatestBaileysVersion();

      const socket = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: logger.child({ company: companyId }),
        browser: ['Escala Certo Pro', 'Chrome', '120.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        retryRequestDelayMs: 500
      });

      this.sessions.set(companyId, socket);
      this._setupEventHandlers(companyId, socket, saveCreds);

      return { status: 'connecting', message: 'Aguardando QR Code...' };
    } catch (error) {
      logger.error(`Erro ao criar sessão ${companyId}:`, error);
      this.sessionStatus.set(companyId, 'error');
      throw error;
    }
  }

  _setupEventHandlers(companyId, socket, saveCreds) {
    // Evento de atualização de conexão
    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // QR Code gerado
      if (qr) {
        logger.info(`QR Code gerado para empresa: ${companyId}`);
        this.sessionStatus.set(companyId, 'qr_code');
        
        // Exibir QR no terminal
        console.log('\n');
        console.log('═'.repeat(50));
        console.log(`  📱 QR CODE - Empresa: ${companyId}`);
        console.log('═'.repeat(50));
        qrcode.generate(qr, { small: true });
        console.log('═'.repeat(50));
        console.log('  Escaneie com seu WhatsApp');
        console.log('═'.repeat(50));
        console.log('\n');

        // Enviar QR para webhook
        await this.webhookService.send(companyId, 'qr_code', { qr_code: qr });
      }

      // Conexão estabelecida
      if (connection === 'open') {
        logger.info(`WhatsApp conectado para empresa: ${companyId}`);
        this.sessionStatus.set(companyId, 'connected');
        this.reconnectAttempts.set(companyId, 0);

        const user = socket.user;
        await this.webhookService.send(companyId, 'connected', {
          phone_number: user?.id?.split(':')[0] || user?.id,
          name: user?.name || 'WhatsApp'
        });
      }

      // Conexão fechada
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = DisconnectReason[Object.keys(DisconnectReason).find(
          k => DisconnectReason[k] === statusCode
        )] || statusCode;

        logger.warn(`Conexão fechada para ${companyId}: ${reason}`);

        // Logout manual - limpar sessão
        if (statusCode === DisconnectReason.loggedOut) {
          logger.info(`Logout detectado para empresa: ${companyId}`);
          this.sessionStatus.set(companyId, 'disconnected');
          await this._clearSessionFiles(companyId);
          await this.webhookService.send(companyId, 'disconnected', { reason: 'logged_out' });
          return;
        }

        // Tentar reconectar
        const attempts = this.reconnectAttempts.get(companyId) || 0;
        if (attempts < this.maxReconnectAttempts) {
          this.reconnectAttempts.set(companyId, attempts + 1);
          logger.info(`Reconectando ${companyId} (tentativa ${attempts + 1}/${this.maxReconnectAttempts})...`);
          
          this.sessionStatus.set(companyId, 'reconnecting');
          await this.webhookService.send(companyId, 'reconnecting', { attempt: attempts + 1 });
          
          setTimeout(() => this.createSession(companyId), 5000);
        } else {
          logger.error(`Máximo de tentativas atingido para ${companyId}`);
          this.sessionStatus.set(companyId, 'disconnected');
          await this.webhookService.send(companyId, 'disconnected', { reason: 'max_retries' });
        }
      }
    });

    // Salvar credenciais
    socket.ev.on('creds.update', saveCreds);

    // Mensagens recebidas
    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        // Ignorar mensagens próprias e de status
        if (msg.key.fromMe || msg.key.remoteJid === 'status@broadcast') continue;

        const contact = msg.key.remoteJid;
        const isGroup = contact.endsWith('@g.us');
        const phone = isGroup ? contact : contact.split('@')[0];
        
        // Extrair conteúdo da mensagem
        let content = '';
        let messageType = 'text';
        
        if (msg.message?.conversation) {
          content = msg.message.conversation;
        } else if (msg.message?.extendedTextMessage?.text) {
          content = msg.message.extendedTextMessage.text;
        } else if (msg.message?.imageMessage) {
          content = msg.message.imageMessage.caption || '[Imagem]';
          messageType = 'image';
        } else if (msg.message?.videoMessage) {
          content = msg.message.videoMessage.caption || '[Vídeo]';
          messageType = 'video';
        } else if (msg.message?.audioMessage) {
          content = '[Áudio]';
          messageType = 'audio';
        } else if (msg.message?.documentMessage) {
          content = msg.message.documentMessage.fileName || '[Documento]';
          messageType = 'document';
        } else if (msg.message?.stickerMessage) {
          content = '[Sticker]';
          messageType = 'sticker';
        } else {
          content = '[Mensagem não suportada]';
          messageType = 'unknown';
        }

        logger.info(`Mensagem recebida de ${phone}: ${content.substring(0, 50)}...`);

        await this.webhookService.send(companyId, 'message_received', {
          message_id: msg.key.id,
          phone: phone,
          is_group: isGroup,
          content: content,
          message_type: messageType,
          timestamp: msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000).toISOString() : new Date().toISOString(),
          push_name: msg.pushName || null
        });
      }
    });

    // Atualização de status de mensagem
    socket.ev.on('messages.update', async (updates) => {
      for (const update of updates) {
        if (update.update?.status) {
          const statusMap = {
            0: 'error',
            1: 'pending',
            2: 'sent',
            3: 'delivered',
            4: 'read'
          };
          
          await this.webhookService.send(companyId, 'message_status', {
            message_id: update.key.id,
            status: statusMap[update.update.status] || 'unknown',
            remote_jid: update.key.remoteJid
          });
        }
      }
    });
  }

  async _clearSessionFiles(companyId) {
    const sessionPath = path.join(this.sessionsDir, companyId);
    try {
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        logger.info(`Arquivos de sessão removidos: ${companyId}`);
      }
    } catch (error) {
      logger.error(`Erro ao limpar sessão ${companyId}:`, error);
    }
  }

  async sendMessage(companyId, phone, content, messageType = 'text') {
    const socket = this.sessions.get(companyId);
    
    if (!socket) {
      throw new Error('Sessão não encontrada');
    }

    if (this.sessionStatus.get(companyId) !== 'connected') {
      throw new Error('Sessão não conectada');
    }

    // Formatar número
    const jid = this._formatJid(phone);
    
    try {
      let message;
      
      switch (messageType) {
        case 'text':
        default:
          message = { text: content };
          break;
      }

      const result = await socket.sendMessage(jid, message);
      
      logger.info(`Mensagem enviada para ${phone}: ${content.substring(0, 50)}...`);
      
      await this.webhookService.send(companyId, 'message_sent', {
        message_id: result.key.id,
        phone: phone,
        content: content,
        message_type: messageType,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        message_id: result.key.id
      };
    } catch (error) {
      logger.error(`Erro ao enviar mensagem para ${phone}:`, error);
      throw error;
    }
  }

  _formatJid(phone) {
    // Remover caracteres não numéricos
    let cleaned = phone.replace(/\D/g, '');
    
    // Adicionar código do país se necessário (Brasil)
    if (cleaned.length === 11 && cleaned.startsWith('9')) {
      cleaned = '55' + cleaned;
    } else if (cleaned.length === 10 || cleaned.length === 11) {
      cleaned = '55' + cleaned;
    }
    
    return `${cleaned}@s.whatsapp.net`;
  }

  async disconnectSession(companyId) {
    const socket = this.sessions.get(companyId);
    
    if (socket) {
      try {
        await socket.logout();
      } catch (error) {
        logger.warn(`Erro ao fazer logout ${companyId}:`, error.message);
      }
      
      try {
        socket.end();
      } catch (error) {
        logger.warn(`Erro ao encerrar socket ${companyId}:`, error.message);
      }
      
      this.sessions.delete(companyId);
    }
    
    this.sessionStatus.set(companyId, 'disconnected');
    await this._clearSessionFiles(companyId);
    
    logger.info(`Sessão desconectada: ${companyId}`);
    return { success: true };
  }

  async restoreAllSessions() {
    logger.info('Restaurando sessões existentes...');
    
    try {
      const dirs = fs.readdirSync(this.sessionsDir);
      
      for (const companyId of dirs) {
        const sessionPath = path.join(this.sessionsDir, companyId);
        if (fs.statSync(sessionPath).isDirectory()) {
          // Verificar se tem arquivos de credenciais
          const credsPath = path.join(sessionPath, 'creds.json');
          if (fs.existsSync(credsPath)) {
            logger.info(`Restaurando sessão: ${companyId}`);
            await this.createSession(companyId);
            // Esperar um pouco entre restaurações
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }
    } catch (error) {
      logger.error('Erro ao restaurar sessões:', error);
    }
  }

  getSessionStatus(companyId) {
    return {
      company_id: companyId,
      status: this.sessionStatus.get(companyId) || 'not_found',
      connected: this.sessionStatus.get(companyId) === 'connected'
    };
  }

  getAllSessionsStatus() {
    const statuses = [];
    for (const [companyId, status] of this.sessionStatus) {
      statuses.push({
        company_id: companyId,
        status: status,
        connected: status === 'connected'
      });
    }
    return statuses;
  }

  async disconnectAllSessions() {
    for (const companyId of this.sessions.keys()) {
      await this.disconnectSession(companyId);
    }
  }
}

module.exports = SessionManager;
SESSION_EOF

# src/index.js
cat > src/index.js << 'INDEX_EOF'
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const SessionManager = require('./managers/SessionManager');
const WebhookService = require('./services/WebhookService');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serviços
const webhookService = new WebhookService(
  process.env.WEBHOOK_URL,
  process.env.WEBHOOK_SECRET
);
const sessionManager = new SessionManager(webhookService);

// ==================== ROTAS ====================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Conectar WhatsApp
app.post('/connect', async (req, res) => {
  try {
    const { company_id } = req.body;
    
    if (!company_id) {
      return res.status(400).json({ error: 'company_id é obrigatório' });
    }

    const result = await sessionManager.createSession(company_id);
    res.json(result);
  } catch (error) {
    logger.error('Erro ao conectar:', error);
    res.status(500).json({ error: error.message });
  }
});

// Desconectar WhatsApp
app.post('/disconnect', async (req, res) => {
  try {
    const { company_id } = req.body;
    
    if (!company_id) {
      return res.status(400).json({ error: 'company_id é obrigatório' });
    }

    const result = await sessionManager.disconnectSession(company_id);
    res.json(result);
  } catch (error) {
    logger.error('Erro ao desconectar:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enviar mensagem
app.post('/send', async (req, res) => {
  try {
    const { company_id, phone, message, message_type = 'text' } = req.body;
    
    if (!company_id || !phone || !message) {
      return res.status(400).json({ 
        error: 'company_id, phone e message são obrigatórios' 
      });
    }

    const result = await sessionManager.sendMessage(
      company_id, 
      phone, 
      message, 
      message_type
    );
    
    res.json(result);
  } catch (error) {
    logger.error('Erro ao enviar mensagem:', error);
    res.status(500).json({ error: error.message });
  }
});

// Status da sessão
app.get('/status', (req, res) => {
  const { company_id } = req.query;
  
  if (company_id) {
    res.json(sessionManager.getSessionStatus(company_id));
  } else {
    res.json(sessionManager.getAllSessionsStatus());
  }
});

// ==================== INICIALIZAÇÃO ====================

app.listen(PORT, '0.0.0.0', async () => {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║     🟢 ESCALA CERTO PRO - WHATSAPP SERVER                 ║');
  console.log('║                                                            ║');
  console.log(`║     Servidor rodando na porta: ${PORT}                        ║`);
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  logger.info(`Servidor iniciado em http://0.0.0.0:${PORT}`);
  logger.info(`Webhook URL: ${process.env.WEBHOOK_URL || 'NÃO CONFIGURADO'}`);
  
  // Restaurar sessões existentes
  await sessionManager.restoreAllSessions();
  
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('  📱 Para conectar um WhatsApp, faça uma requisição POST:');
  console.log(`  curl -X POST http://localhost:${PORT}/connect \\`);
  console.log('       -H "Content-Type: application/json" \\');
  console.log('       -d \'{"company_id": "sua-empresa-id"}\'');
  console.log('═'.repeat(60));
  console.log('\n');
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', reason);
});

// Graceful shutdown
const shutdown = async () => {
  logger.info('Encerrando servidor...');
  await sessionManager.disconnectAllSessions();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
INDEX_EOF

# .gitignore
cat > .gitignore << 'GITIGNORE_EOF'
node_modules/
sessions/
logs/
.env
*.log
.DS_Store
GITIGNORE_EOF

log_info "Arquivos criados com sucesso"

# =====================================================
# 7. INSTALAR DEPENDÊNCIAS
# =====================================================
log_step "Instalando dependências do Node.js..."
npm install

# Instalar pino-pretty para logs bonitos
npm install pino-pretty --save-optional 2>/dev/null || true

log_info "Dependências instaladas"

# =====================================================
# 8. PARAR PROCESSO ANTERIOR (SE EXISTIR)
# =====================================================
log_step "Verificando processos anteriores..."

pm2 stop escala-whatsapp 2>/dev/null || true
pm2 delete escala-whatsapp 2>/dev/null || true

log_info "Processos anteriores limpos"

# =====================================================
# 9. CONFIGURAR FIREWALL
# =====================================================
if command -v ufw &> /dev/null; then
  log_step "Configurando firewall..."
  sudo ufw allow $PORT/tcp 2>/dev/null || true
  log_info "Porta $PORT liberada"
fi

# =====================================================
# 10. CONFIGURAR PM2 STARTUP
# =====================================================
log_step "Configurando PM2 para iniciar com o sistema..."

# Configurar startup (pode requerer senha)
pm2 startup 2>/dev/null || true

log_info "PM2 configurado"

# =====================================================
# 11. INICIAR SERVIDOR
# =====================================================
log_step "Iniciando servidor WhatsApp..."

pm2 start ecosystem.config.js --env production
pm2 save

log_info "Servidor iniciado com PM2"

# =====================================================
# FINALIZAÇÃO
# =====================================================
echo ""
echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo -e "║     ${GREEN}✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!${CYAN}                  ║"
echo "║                                                            ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║                                                            ║"
echo "║  📍 Diretório: $INSTALL_DIR"
echo "║  🌐 Servidor: http://$(hostname -I | awk '{print $1}'):$PORT"
echo "║  📁 Sessões: $INSTALL_DIR/sessions"
echo "║  📝 Logs: $INSTALL_DIR/logs"
echo "║                                                            ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║                                                            ║"
echo "║  📱 PARA CONECTAR SEU WHATSAPP:                           ║"
echo "║                                                            ║"
echo "║  curl -X POST http://localhost:$PORT/connect \\"
echo "║       -H 'Content-Type: application/json' \\"
echo "║       -d '{\"company_id\": \"minha-empresa\"}'"
echo "║                                                            ║"
echo "║  O QR Code aparecerá no terminal!                         ║"
echo "║                                                            ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║                                                            ║"
echo "║  🛠️  COMANDOS ÚTEIS:                                       ║"
echo "║                                                            ║"
echo "║  pm2 logs escala-whatsapp   - Ver logs em tempo real      ║"
echo "║  pm2 restart escala-whatsapp - Reiniciar servidor         ║"
echo "║  pm2 status                  - Ver status                  ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Mostrar logs em tempo real
log_info "Mostrando logs do servidor (Ctrl+C para sair)..."
echo ""
sleep 2
pm2 logs escala-whatsapp --lines 50
