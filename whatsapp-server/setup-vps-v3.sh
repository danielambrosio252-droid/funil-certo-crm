#!/bin/bash
# ===========================================
# WHATSAPP SERVER - SCRIPT DE INSTALAÇÃO V3
# ===========================================
# Este script instala o servidor WhatsApp completo na VPS
# com autenticação por token e todas as funcionalidades
# 
# Uso: ./setup-vps-v3.sh
# ===========================================

set -e

# ===== CONFIGURAÇÕES =====
INSTALL_DIR="/root/whatsapp-server"
PORT="${PORT:-3001}"
NODE_VERSION="20"

# ===== CORES =====
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "\n${GREEN}==>${NC} ${YELLOW}$1${NC}"; }

# ===== VERIFICAÇÕES INICIAIS =====
log_step "Verificando ambiente..."

if [ "$EUID" -ne 0 ]; then
    log_error "Execute como root: sudo ./setup-vps-v3.sh"
    exit 1
fi

if ! command -v apt &> /dev/null; then
    log_error "Este script requer Ubuntu/Debian"
    exit 1
fi

# ===== SOLICITAR CONFIGURAÇÕES =====
log_step "Configuração do servidor"

echo ""
read -p "URL do webhook (ex: https://xxx.supabase.co/functions/v1/whatsapp-webhook): " WEBHOOK_URL

if [ -z "$WEBHOOK_URL" ]; then
    log_error "URL do webhook é obrigatória!"
    exit 1
fi

echo ""
read -p "Token de segurança (mesmo configurado no Lovable Cloud): " SERVER_SECRET

if [ -z "$SERVER_SECRET" ]; then
    log_error "Token de segurança é obrigatório!"
    exit 1
fi

echo ""
log_info "Webhook: $WEBHOOK_URL"
log_info "Token: ${SERVER_SECRET:0:4}****"
echo ""
read -p "Confirmar configuração? (s/n): " CONFIRM

if [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ]; then
    log_error "Cancelado pelo usuário"
    exit 1
fi

# ===== ATUALIZAR SISTEMA =====
log_step "Atualizando sistema..."
apt update -qq
apt install -y -qq curl wget git build-essential > /dev/null 2>&1
log_success "Sistema atualizado"

# ===== INSTALAR NODE.JS =====
log_step "Instalando Node.js $NODE_VERSION..."

if command -v node &> /dev/null; then
    CURRENT_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$CURRENT_VERSION" -ge "$NODE_VERSION" ]; then
        log_success "Node.js v$(node -v) já instalado"
    else
        log_warn "Atualizando Node.js de v$CURRENT_VERSION para v$NODE_VERSION..."
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - > /dev/null 2>&1
        apt install -y -qq nodejs > /dev/null 2>&1
        log_success "Node.js atualizado para $(node -v)"
    fi
else
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - > /dev/null 2>&1
    apt install -y -qq nodejs > /dev/null 2>&1
    log_success "Node.js $(node -v) instalado"
fi

# ===== INSTALAR PM2 =====
log_step "Instalando PM2..."
npm install -g pm2 > /dev/null 2>&1
log_success "PM2 instalado"

# ===== LIMPAR INSTALAÇÃO ANTERIOR =====
log_step "Limpando instalação anterior..."
pm2 delete escala-whatsapp 2>/dev/null || true
pm2 save 2>/dev/null || true
rm -rf "$INSTALL_DIR"
log_success "Limpo"

# ===== CRIAR ESTRUTURA DE DIRETÓRIOS =====
log_step "Criando estrutura de diretórios..."
mkdir -p "$INSTALL_DIR/src/managers"
mkdir -p "$INSTALL_DIR/src/services"
mkdir -p "$INSTALL_DIR/src/utils"
mkdir -p "$INSTALL_DIR/sessions"
mkdir -p "$INSTALL_DIR/logs"
log_success "Diretórios criados"

# ===== CRIAR PACKAGE.JSON =====
log_step "Criando package.json..."
cat > "$INSTALL_DIR/package.json" << 'PACKAGE_EOF'
{
  "name": "whatsapp-server",
  "version": "3.0.0",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "^6.7.17",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "pino": "^8.16.2",
    "pino-pretty": "^10.2.3",
    "qrcode": "^1.5.3"
  }
}
PACKAGE_EOF
log_success "package.json criado"

# ===== CRIAR .ENV =====
log_step "Criando .env..."
cat > "$INSTALL_DIR/.env" << ENV_EOF
PORT=$PORT
WEBHOOK_URL=$WEBHOOK_URL
SERVER_SECRET=$SERVER_SECRET
SESSION_DIR=$INSTALL_DIR/sessions
NODE_ENV=production
ENV_EOF
log_success ".env criado"

# ===== CRIAR ECOSYSTEM PM2 =====
log_step "Criando ecosystem.config.js..."
cat > "$INSTALL_DIR/ecosystem.config.js" << 'ECO_EOF'
export default {
  apps: [{
    name: 'escala-whatsapp',
    script: 'src/index.js',
    cwd: '/root/whatsapp-server',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/root/whatsapp-server/logs/error.log',
    out_file: '/root/whatsapp-server/logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
ECO_EOF
log_success "ecosystem.config.js criado"

# ===== CRIAR LOGGER =====
log_step "Criando utils/logger.js..."
cat > "$INSTALL_DIR/src/utils/logger.js" << 'LOGGER_EOF'
import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
  level: isDev ? 'debug' : 'info',
  transport: isDev ? {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' }
  } : undefined
});

export default logger;
LOGGER_EOF
log_success "logger.js criado"

# ===== CRIAR WEBHOOK SERVICE =====
log_step "Criando services/WebhookService.js..."
cat > "$INSTALL_DIR/src/services/WebhookService.js" << 'WEBHOOK_EOF'
import logger from '../utils/logger.js';

class WebhookService {
  constructor(webhookUrl, webhookSecret = null) {
    this.webhookUrl = webhookUrl;
    this.webhookSecret = webhookSecret;
    this.retryAttempts = 3;
    this.retryDelay = 2000;
    logger.info({ webhookUrl: webhookUrl ? webhookUrl.substring(0, 50) + '...' : 'NOT SET' }, 'WebhookService initialized');
  }

  async send(companyId, eventType, data) {
    if (!this.webhookUrl) {
      logger.warn('Webhook URL not configured, skipping notification');
      return false;
    }

    const payload = {
      type: eventType,
      company_id: companyId,
      data,
      timestamp: new Date().toISOString()
    };

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (this.webhookSecret) {
          headers['X-Webhook-Secret'] = this.webhookSecret;
        }

        const response = await fetch(this.webhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          logger.info({ eventType, companyId, attempt }, 'Webhook sent successfully');
          return true;
        }

        const errorText = await response.text();
        logger.warn({ eventType, companyId, attempt, status: response.status, error: errorText }, 'Webhook failed');

      } catch (error) {
        logger.error({ eventType, companyId, attempt, error: error.message }, 'Webhook error');
      }

      if (attempt < this.retryAttempts) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      }
    }

    logger.error({ eventType, companyId }, 'Webhook failed after all retries');
    return false;
  }
}

export default WebhookService;
WEBHOOK_EOF
log_success "WebhookService.js criado"

# ===== CRIAR SESSION MANAGER (COMPLETO) =====
log_step "Criando managers/SessionManager.js..."
cat > "$INSTALL_DIR/src/managers/SessionManager.js" << 'SESSION_EOF'
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger.js';

/**
 * ===================================================
 * SESSION MANAGER V3 - COMPLETO E FUNCIONAL
 * ===================================================
 * Gerencia múltiplas sessões WhatsApp com:
 * - QR Code em memória (qrStore)
 * - Estados determinísticos
 * - Timeout automático de QR
 * - Reconexão automática
 */
class SessionManager {
  constructor(webhookService, sessionDir) {
    this.sessions = new Map();
    this.qrStore = new Map();
    this.pendingConnections = new Map();
    this.errorStore = new Map();
    this.webhookService = webhookService;
    this.sessionDir = sessionDir || process.env.SESSION_DIR || './sessions';
    
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }
    
    logger.info({ sessionDir: this.sessionDir }, 'SessionManager V3 initialized');
  }

  /**
   * Normaliza telefone para formato E.164 (só dígitos)
   */
  normalizePhone(input) {
    if (!input || typeof input !== 'string') return '';
    
    let phone = input
      .replace(/@s\.whatsapp\.net$/i, '')
      .replace(/@c\.us$/i, '')
      .replace(/@lid$/i, '')
      .replace(/@g\.us$/i, '')
      .split(':')[0]
      .replace(/\D/g, '');
    
    if (phone.length > 15) return '';
    if (phone.length >= 10 && phone.length <= 11) phone = '55' + phone;
    if (phone.startsWith('55') && phone.length === 12) {
      phone = phone.substring(0, 4) + '9' + phone.substring(4);
    }
    
    return phone;
  }

  /**
   * Retorna o status da sessão de forma determinística
   */
  getSessionStatus(companyId) {
    // 1. Verificar se há erro registrado
    if (this.errorStore.has(companyId)) {
      const error = this.errorStore.get(companyId);
      return { status: 'ERROR', reason: error.reason, timestamp: error.timestamp };
    }

    // 2. Verificar se há QR pendente
    if (this.qrStore.has(companyId)) {
      const qrData = this.qrStore.get(companyId);
      return { status: 'QR', qr: qrData.qr, timestamp: qrData.timestamp };
    }

    // 3. Verificar se está conectando
    if (this.pendingConnections.has(companyId)) {
      const pending = this.pendingConnections.get(companyId);
      const ageMs = Date.now() - pending.timestamp;
      return { status: 'CONNECTING', pending_age_ms: ageMs };
    }

    // 4. Verificar se está conectado
    const session = this.sessions.get(companyId);
    if (session?.socket?.user) {
      const phoneNumber = session.socket.user.id.split(':')[0];
      return { status: 'CONNECTED', phone_number: phoneNumber };
    }

    // 5. Verificar se tem pasta de sessão (pode reconectar)
    const sessionPath = path.join(this.sessionDir, companyId);
    if (fs.existsSync(sessionPath)) {
      return { status: 'DISCONNECTED', has_credentials: true };
    }

    return { status: 'DISCONNECTED', has_credentials: false };
  }

  /**
   * Retorna o QR code em memória (fonte de verdade)
   */
  getQrCode(companyId) {
    const status = this.getSessionStatus(companyId);
    return status;
  }

  /**
   * Inicia ou reconecta uma sessão
   */
  async connect(companyId, forceReset = false) {
    logger.info({ companyId, forceReset }, 'Connect requested');
    
    // Limpar estados anteriores
    this.errorStore.delete(companyId);
    this.qrStore.delete(companyId);
    
    // Marcar como pendente
    this.pendingConnections.set(companyId, { timestamp: Date.now() });

    // Se forceReset, remover credenciais
    if (forceReset) {
      await this.deleteSession(companyId);
    }

    // Desconectar sessão existente se houver
    const existingSession = this.sessions.get(companyId);
    if (existingSession?.socket) {
      try {
        existingSession.socket.end();
      } catch (e) {
        logger.warn({ companyId, error: e.message }, 'Error closing existing socket');
      }
      this.sessions.delete(companyId);
    }

    try {
      const sessionPath = path.join(this.sessionDir, companyId);
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      const { version } = await fetchLatestBaileysVersion();

      logger.info({ companyId, version }, 'Creating socket');

      const socket = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: logger.child({ companyId }),
        browser: ['Escala', 'Chrome', '120.0.0'],
        connectTimeoutMs: 60000,
        qrTimeout: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
      });

      this.sessions.set(companyId, { socket, saveCreds, state });
      this.setupEventHandlers(companyId, socket, saveCreds);

      return { success: true, message: 'Connecting...' };

    } catch (error) {
      logger.error({ companyId, error: error.message }, 'Failed to create session');
      this.pendingConnections.delete(companyId);
      this.errorStore.set(companyId, { reason: error.message, timestamp: Date.now() });
      return { success: false, error: error.message };
    }
  }

  /**
   * Configura handlers de eventos do Baileys
   */
  setupEventHandlers(companyId, socket, saveCreds) {
    // Timeout para QR (40 segundos)
    const qrTimeout = setTimeout(() => {
      if (this.pendingConnections.has(companyId) && !this.qrStore.has(companyId)) {
        logger.warn({ companyId }, 'QR timeout - no QR received');
        this.pendingConnections.delete(companyId);
        this.errorStore.set(companyId, { reason: 'qr_timeout', timestamp: Date.now() });
        this.webhookService?.send(companyId, 'disconnected', { reason: 'qr_timeout' });
      }
    }, 40000);

    // Evento de atualização de conexão
    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      logger.info({ companyId, connection, hasQr: !!qr }, 'Connection update');

      // QR Code recebido
      if (qr) {
        clearTimeout(qrTimeout);
        this.pendingConnections.delete(companyId);
        
        try {
          const qrBase64 = await QRCode.toDataURL(qr, { margin: 2, width: 256 });
          this.qrStore.set(companyId, { qr: qrBase64, timestamp: Date.now() });
          
          logger.info({ companyId }, 'QR code generated and stored');
          await this.webhookService?.send(companyId, 'qr_code', { qr_code: qrBase64 });
          
        } catch (error) {
          logger.error({ companyId, error: error.message }, 'Failed to generate QR');
        }
      }

      // Conexão estabelecida
      if (connection === 'open') {
        clearTimeout(qrTimeout);
        this.pendingConnections.delete(companyId);
        this.qrStore.delete(companyId);
        this.errorStore.delete(companyId);
        
        const phoneNumber = socket.user?.id?.split(':')[0] || '';
        logger.info({ companyId, phoneNumber }, 'Connected!');
        
        await this.webhookService?.send(companyId, 'connected', { 
          phone_number: phoneNumber,
          connected_at: new Date().toISOString()
        });
      }

      // Conexão fechada
      if (connection === 'close') {
        clearTimeout(qrTimeout);
        this.pendingConnections.delete(companyId);
        this.qrStore.delete(companyId);
        
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        logger.warn({ companyId, statusCode, shouldReconnect }, 'Connection closed');
        
        if (statusCode === DisconnectReason.loggedOut) {
          // Usuário fez logout - limpar tudo
          await this.deleteSession(companyId);
          this.errorStore.set(companyId, { reason: 'logged_out', timestamp: Date.now() });
          await this.webhookService?.send(companyId, 'disconnected', { reason: 'logged_out' });
        } else if (shouldReconnect) {
          // Tentar reconectar
          logger.info({ companyId }, 'Attempting reconnection...');
          setTimeout(() => this.connect(companyId, false), 3000);
        } else {
          this.errorStore.set(companyId, { reason: `disconnect_${statusCode}`, timestamp: Date.now() });
          await this.webhookService?.send(companyId, 'disconnected', { reason: `status_${statusCode}` });
        }
      }
    });

    // Salvar credenciais quando atualizadas
    socket.ev.on('creds.update', saveCreds);

    // Mensagens recebidas
    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        // Ignorar mensagens enviadas por mim
        if (msg.key.fromMe) continue;
        // Ignorar grupos por enquanto
        if (msg.key.remoteJid?.endsWith('@g.us')) continue;
        // Ignorar status/broadcast
        if (msg.key.remoteJid === 'status@broadcast') continue;

        const rawJid = msg.key.remoteJid || '';
        const phone = this.normalizePhone(rawJid);
        
        if (!phone) {
          logger.warn({ companyId, rawJid }, 'Could not normalize phone, skipping message');
          continue;
        }

        // Extrair conteúdo da mensagem
        let content = '';
        let messageType = 'text';
        let mediaUrl = null;

        if (msg.message?.conversation) {
          content = msg.message.conversation;
        } else if (msg.message?.extendedTextMessage?.text) {
          content = msg.message.extendedTextMessage.text;
        } else if (msg.message?.imageMessage) {
          messageType = 'image';
          content = msg.message.imageMessage.caption || '[Imagem]';
        } else if (msg.message?.videoMessage) {
          messageType = 'video';
          content = msg.message.videoMessage.caption || '[Vídeo]';
        } else if (msg.message?.audioMessage) {
          messageType = 'audio';
          content = '[Áudio]';
        } else if (msg.message?.documentMessage) {
          messageType = 'document';
          content = msg.message.documentMessage.fileName || '[Documento]';
        } else if (msg.message?.stickerMessage) {
          messageType = 'sticker';
          content = '[Figurinha]';
        } else {
          content = '[Mensagem não suportada]';
        }

        const senderName = msg.pushName || '';

        logger.info({ companyId, phone, messageType, hasContent: !!content }, 'Message received');

        await this.webhookService?.send(companyId, 'message_received', {
          from: phone,
          raw_jid: rawJid,
          content,
          message_type: messageType,
          message_id: msg.key.id,
          sender_name: senderName,
          media_url: mediaUrl,
          timestamp: msg.messageTimestamp
        });
      }
    });

    // Atualização de status de mensagem
    socket.ev.on('messages.update', async (updates) => {
      for (const update of updates) {
        if (update.update.status) {
          const statusMap = {
            2: 'sent',
            3: 'delivered',
            4: 'read'
          };
          const status = statusMap[update.update.status] || 'unknown';
          
          await this.webhookService?.send(companyId, 'message_status', {
            message_id: update.key.id,
            status
          });
        }
      }
    });

    // Presença (digitando)
    socket.ev.on('presence.update', async ({ id, presences }) => {
      const phone = this.normalizePhone(id);
      if (!phone) return;

      for (const [jid, presence] of Object.entries(presences)) {
        await this.webhookService?.send(companyId, 'presence_update', {
          phone,
          presence: presence.lastKnownPresence
        });
      }
    });
  }

  /**
   * Envia uma mensagem
   */
  async sendMessage(companyId, phone, message, messageId = null) {
    const session = this.sessions.get(companyId);
    
    if (!session?.socket) {
      throw new Error('Session not connected');
    }

    // Formatar JID corretamente
    const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
    
    logger.info({ companyId, phone, jid, messageId }, 'Sending message');

    try {
      const result = await session.socket.sendMessage(jid, { text: message });
      
      logger.info({ companyId, phone, waMessageId: result.key.id }, 'Message sent');

      // Notificar webhook
      if (messageId) {
        await this.webhookService?.send(companyId, 'message_sent', {
          local_id: messageId,
          message_id: result.key.id
        });
      }

      return { success: true, message_id: result.key.id };

    } catch (error) {
      logger.error({ companyId, phone, error: error.message }, 'Failed to send message');
      throw error;
    }
  }

  /**
   * Desconecta uma sessão (mantém credenciais)
   */
  async disconnect(companyId) {
    logger.info({ companyId }, 'Disconnecting session');
    
    const session = this.sessions.get(companyId);
    if (session?.socket) {
      try {
        await session.socket.logout();
      } catch (e) {
        logger.warn({ companyId, error: e.message }, 'Error during logout');
      }
      session.socket.end();
    }
    
    this.sessions.delete(companyId);
    this.qrStore.delete(companyId);
    this.pendingConnections.delete(companyId);
    this.errorStore.delete(companyId);
    
    await this.webhookService?.send(companyId, 'disconnected', { reason: 'manual' });
    
    return { success: true };
  }

  /**
   * Remove sessão completamente (apaga credenciais)
   */
  async deleteSession(companyId) {
    logger.info({ companyId }, 'Deleting session completely');
    
    await this.disconnect(companyId);
    
    const sessionPath = path.join(this.sessionDir, companyId);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      logger.info({ companyId, sessionPath }, 'Session files deleted');
    }
    
    return { success: true };
  }

  /**
   * Reinicia sessão (mantém credenciais)
   */
  async restart(companyId) {
    logger.info({ companyId }, 'Restarting session');
    
    const session = this.sessions.get(companyId);
    if (session?.socket) {
      session.socket.end();
      this.sessions.delete(companyId);
    }
    
    this.qrStore.delete(companyId);
    this.pendingConnections.delete(companyId);
    this.errorStore.delete(companyId);
    
    // Reconectar após 1 segundo
    await new Promise(resolve => setTimeout(resolve, 1000));
    return await this.connect(companyId, false);
  }

  /**
   * Restaura todas as sessões salvas
   */
  async restoreAllSessions() {
    logger.info('Restoring all saved sessions...');
    
    if (!fs.existsSync(this.sessionDir)) {
      logger.info('No sessions directory found');
      return;
    }

    const sessionFolders = fs.readdirSync(this.sessionDir).filter(f => {
      const fullPath = path.join(this.sessionDir, f);
      return fs.statSync(fullPath).isDirectory();
    });

    logger.info({ count: sessionFolders.length }, 'Found saved sessions');

    for (const companyId of sessionFolders) {
      try {
        logger.info({ companyId }, 'Restoring session');
        await this.connect(companyId, false);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Delay entre reconexões
      } catch (error) {
        logger.error({ companyId, error: error.message }, 'Failed to restore session');
      }
    }
  }

  /**
   * Retorna todas as sessões ativas
   */
  getAllSessions() {
    const result = {};
    for (const [companyId] of this.sessions) {
      result[companyId] = this.getSessionStatus(companyId);
    }
    return result;
  }
}

export default SessionManager;
SESSION_EOF
log_success "SessionManager.js criado"

# ===== CRIAR INDEX.JS PRINCIPAL =====
log_step "Criando src/index.js..."
cat > "$INSTALL_DIR/src/index.js" << 'INDEX_EOF'
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import logger from './utils/logger.js';
import WebhookService from './services/WebhookService.js';
import SessionManager from './managers/SessionManager.js';

// ===== CONFIGURAÇÕES =====
const PORT = process.env.PORT || 3001;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const SERVER_SECRET = process.env.SERVER_SECRET;
const SESSION_DIR = process.env.SESSION_DIR || './sessions';

// ===== INICIALIZAÇÃO =====
const app = express();
app.use(cors());
app.use(express.json());

const webhookService = new WebhookService(WEBHOOK_URL, SERVER_SECRET);
const sessionManager = new SessionManager(webhookService, SESSION_DIR);

// ===== MIDDLEWARE DE LOG =====
app.use((req, res, next) => {
  logger.info({ method: req.method, url: req.url }, 'Request');
  next();
});

// ===== MIDDLEWARE DE AUTENTICAÇÃO =====
const validateToken = (req, res, next) => {
  if (!SERVER_SECRET) {
    return next(); // Sem secret configurado, permitir tudo
  }
  
  const token = req.headers['x-server-token'];
  
  if (!token || token !== SERVER_SECRET) {
    logger.warn({ ip: req.ip }, 'Unauthorized request');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
};

// ===== ROTAS PÚBLICAS =====

// Health check (sem autenticação)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '3.0.0'
  });
});

// ===== ROTAS PROTEGIDAS =====

// Conectar sessão
app.post('/connect', validateToken, async (req, res) => {
  try {
    const { company_id, force_reset } = req.body;
    
    if (!company_id) {
      return res.status(400).json({ error: 'company_id is required' });
    }
    
    logger.info({ company_id, force_reset }, 'Connect request');
    const result = await sessionManager.connect(company_id, force_reset || false);
    
    res.json(result);
    
  } catch (error) {
    logger.error({ error: error.message }, 'Connect error');
    res.status(500).json({ error: error.message });
  }
});

// Obter QR Code / Status (endpoint para polling)
app.get('/api/whatsapp/qr', validateToken, (req, res) => {
  try {
    const companyId = req.query.company_id;
    
    if (!companyId) {
      return res.status(400).json({ error: 'company_id is required' });
    }
    
    const status = sessionManager.getQrCode(companyId);
    logger.info({ companyId, status: status.status }, 'QR/Status request');
    
    res.json(status);
    
  } catch (error) {
    logger.error({ error: error.message }, 'QR error');
    res.status(500).json({ status: 'ERROR', reason: error.message });
  }
});

// Desconectar sessão
app.post('/disconnect', validateToken, async (req, res) => {
  try {
    const { company_id } = req.body;
    
    if (!company_id) {
      return res.status(400).json({ error: 'company_id is required' });
    }
    
    logger.info({ company_id }, 'Disconnect request');
    const result = await sessionManager.disconnect(company_id);
    
    res.json(result);
    
  } catch (error) {
    logger.error({ error: error.message }, 'Disconnect error');
    res.status(500).json({ error: error.message });
  }
});

// Reiniciar sessão
app.post('/restart/:company_id', validateToken, async (req, res) => {
  try {
    const { company_id } = req.params;
    
    logger.info({ company_id }, 'Restart request');
    const result = await sessionManager.restart(company_id);
    
    res.json(result);
    
  } catch (error) {
    logger.error({ error: error.message }, 'Restart error');
    res.status(500).json({ error: error.message });
  }
});

// Remover sessão completamente
app.delete('/session/:company_id', validateToken, async (req, res) => {
  try {
    const { company_id } = req.params;
    
    logger.info({ company_id }, 'Delete session request');
    const result = await sessionManager.deleteSession(company_id);
    
    res.json(result);
    
  } catch (error) {
    logger.error({ error: error.message }, 'Delete session error');
    res.status(500).json({ error: error.message });
  }
});

// Enviar mensagem
app.post('/send', validateToken, async (req, res) => {
  try {
    const { company_id, phone, message, message_id, message_type } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({ error: 'phone and message are required' });
    }
    
    // Pegar company_id do body ou usar default
    const targetCompanyId = company_id || 'default';
    
    logger.info({ company_id: targetCompanyId, phone, message_id }, 'Send message request');
    
    const result = await sessionManager.sendMessage(targetCompanyId, phone, message, message_id);
    
    res.json(result);
    
  } catch (error) {
    logger.error({ error: error.message }, 'Send message error');
    res.status(500).json({ error: error.message });
  }
});

// Status de todas as sessões
app.get('/status', validateToken, (req, res) => {
  const sessions = sessionManager.getAllSessions();
  res.json({ sessions });
});

// Status de uma sessão específica
app.get('/status/:company_id', validateToken, (req, res) => {
  const { company_id } = req.params;
  const status = sessionManager.getSessionStatus(company_id);
  res.json(status);
});

// ===== INICIAR SERVIDOR =====
app.listen(PORT, async () => {
  logger.info({ port: PORT, webhook: WEBHOOK_URL ? 'configured' : 'NOT configured' }, 'Server started');
  
  // Restaurar sessões salvas
  await sessionManager.restoreAllSessions();
});

// ===== GRACEFUL SHUTDOWN =====
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error({ error: error.message, stack: error.stack }, 'Uncaught exception');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason }, 'Unhandled rejection');
});
INDEX_EOF
log_success "index.js criado"

# ===== INSTALAR DEPENDÊNCIAS =====
log_step "Instalando dependências (pode demorar)..."
cd "$INSTALL_DIR"
npm install --production 2>&1 | tail -5
log_success "Dependências instaladas"

# ===== CONFIGURAR FIREWALL =====
log_step "Configurando firewall..."
if command -v ufw &> /dev/null; then
    ufw allow $PORT/tcp > /dev/null 2>&1 || true
    log_success "Porta $PORT liberada no firewall"
else
    log_warn "ufw não encontrado, configure o firewall manualmente"
fi

# ===== CONFIGURAR PM2 =====
log_step "Configurando PM2..."
cd "$INSTALL_DIR"
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup systemd -u root --hp /root > /dev/null 2>&1 || true
log_success "PM2 configurado"

# ===== VERIFICAR STATUS =====
log_step "Verificando servidor..."
sleep 3

if pm2 pid escala-whatsapp > /dev/null 2>&1; then
    log_success "Servidor está rodando!"
else
    log_error "Servidor não iniciou. Verifique os logs: pm2 logs"
    exit 1
fi

# Testar endpoint
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/health)
if [ "$HTTP_STATUS" = "200" ]; then
    log_success "Health check OK"
else
    log_warn "Health check retornou: $HTTP_STATUS"
fi

# ===== RESUMO FINAL =====
echo ""
echo "========================================"
echo -e "${GREEN}✓ INSTALAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
echo "========================================"
echo ""
echo -e "Servidor:      ${BLUE}http://$(curl -s ifconfig.me 2>/dev/null || echo 'SEU-IP'):$PORT${NC}"
echo -e "Diretório:     ${BLUE}$INSTALL_DIR${NC}"
echo -e "Webhook:       ${BLUE}${WEBHOOK_URL:0:50}...${NC}"
echo -e "Token:         ${BLUE}${SERVER_SECRET:0:4}****${NC}"
echo ""
echo "Comandos úteis:"
echo "  pm2 status          - Ver status do servidor"
echo "  pm2 logs            - Ver logs em tempo real"
echo "  pm2 restart all     - Reiniciar servidor"
echo ""
echo -e "${YELLOW}PRÓXIMO PASSO:${NC}"
echo "Configure no Lovable Cloud (Settings → Secrets):"
echo "  - WHATSAPP_SERVER_URL: http://$(curl -s ifconfig.me 2>/dev/null || echo 'SEU-IP'):$PORT"
echo "  - WHATSAPP_SERVER_SECRET: $SERVER_SECRET"
echo ""
echo "========================================"
echo ""

# Mostrar logs
pm2 logs --lines 20
