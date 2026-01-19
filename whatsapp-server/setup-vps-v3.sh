#!/bin/bash
# ===========================================
# WHATSAPP SERVER - SCRIPT DE INSTALAÇÃO V3
# ===========================================
# Este script instala o servidor WhatsApp completo na VPS
# com autenticação por token e todas as funcionalidades
# 
# IMPORTANTE: Gera código CommonJS (require/module.exports)
# para compatibilidade com o repositório do projeto
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
read -p "Token de segurança (mesmo configurado no Lovable Cloud): " SECURITY_TOKEN

if [ -z "$SECURITY_TOKEN" ]; then
    log_error "Token de segurança é obrigatório!"
    exit 1
fi

echo ""
log_info "Webhook: $WEBHOOK_URL"
log_info "Token: ${SECURITY_TOKEN:0:4}****"
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

# Backup de sessões existentes se houver
if [ -d "$INSTALL_DIR/sessions" ]; then
    BACKUP_NAME="sessions-backup-$(date +%Y%m%d_%H%M%S).tar.gz"
    log_info "Fazendo backup das sessões existentes: $BACKUP_NAME"
    tar -czf "/root/$BACKUP_NAME" -C "$INSTALL_DIR" sessions 2>/dev/null || true
fi

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

# ===== CRIAR PACKAGE.JSON (CommonJS - SEM type:module) =====
log_step "Criando package.json..."
cat > "$INSTALL_DIR/package.json" << 'PACKAGE_EOF'
{
  "name": "whatsapp-server",
  "version": "3.0.0",
  "description": "Servidor WhatsApp Web para Escala Certo Pro",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "^6.7.17",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "pino": "^8.16.2",
    "qrcode": "^1.5.3"
  },
  "devDependencies": {
    "pino-pretty": "^10.2.3"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
PACKAGE_EOF
log_success "package.json criado (CommonJS)"

# ===== CRIAR .ENV (com todas as variantes de nomes) =====
log_step "Criando .env..."
cat > "$INSTALL_DIR/.env" << ENV_EOF
# Porta do servidor
PORT=$PORT

# Webhook para onde enviar eventos (Lovable Cloud Edge Function)
WEBHOOK_URL=$WEBHOOK_URL

# Segredo para autenticar webhooks enviados (VPS -> Lovable Cloud)
WEBHOOK_SECRET=$SECURITY_TOKEN

# Segredo para autenticar chamadas recebidas (Lovable Cloud -> VPS)
WHATSAPP_SERVER_SECRET=$SECURITY_TOKEN

# Fallbacks (retrocompatibilidade)
SERVER_SECRET=$SECURITY_TOKEN

# Diretório onde ficam as sessões
SESSIONS_DIR=$INSTALL_DIR/sessions

# Ambiente
NODE_ENV=production

# Nível de log (debug, info, warn, error)
LOG_LEVEL=info
ENV_EOF
log_success ".env criado com todas as variáveis"

# ===== CRIAR ECOSYSTEM PM2 (CommonJS - module.exports) =====
log_step "Criando ecosystem.config.js..."
cat > "$INSTALL_DIR/ecosystem.config.js" << 'ECO_EOF'
module.exports = {
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
log_success "ecosystem.config.js criado (CommonJS)"

# ===== CRIAR PHONE NORMALIZER =====
log_step "Criando utils/phoneNormalizer.js..."
cat > "$INSTALL_DIR/src/utils/phoneNormalizer.js" << 'PHONE_EOF'
/**
 * =====================================================
 * NORMALIZADOR DE TELEFONE
 * =====================================================
 * 
 * Utilitário para normalizar números de telefone
 * para o formato esperado pelo WhatsApp
 */

/**
 * Verifica se é um LID (identificador interno do WhatsApp)
 * LIDs não são números de telefone reais
 */
function isLid(input) {
  if (!input || typeof input !== 'string') return false;
  return input.includes('@lid') || /^\d+:\d+@/.test(input);
}

/**
 * Normaliza número de telefone para formato E.164
 * Remove caracteres especiais, adiciona código do país se necessário
 */
function normalizePhone(input) {
  if (!input || typeof input !== 'string') return '';
  
  // Ignorar LIDs
  if (isLid(input)) return '';
  
  // Remover sufixos do WhatsApp
  let phone = input
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/@c\.us$/i, '')
    .replace(/@g\.us$/i, '')
    .split(':')[0]
    .replace(/\D/g, '');
  
  // Validar tamanho
  if (phone.length > 15 || phone.length < 8) return '';
  
  // Adicionar código do Brasil se necessário
  if (phone.length >= 10 && phone.length <= 11) {
    phone = '55' + phone;
  }
  
  // Adicionar 9 para celulares brasileiros (SP, RJ, etc.)
  if (phone.startsWith('55') && phone.length === 12) {
    const ddd = phone.substring(2, 4);
    // DDDs de SP, RJ, etc. que precisam do 9
    if (['11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '24', '27', '28'].includes(ddd)) {
      phone = phone.substring(0, 4) + '9' + phone.substring(4);
    }
  }
  
  return phone;
}

/**
 * Converte telefone para JID do WhatsApp
 */
function phoneToJid(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return phone + '@s.whatsapp.net';
  return normalized + '@s.whatsapp.net';
}

module.exports = {
  isLid,
  normalizePhone,
  phoneToJid
};
PHONE_EOF
log_success "phoneNormalizer.js criado"

# ===== CRIAR LOGGER (CommonJS + Baileys compatível) =====
log_step "Criando utils/logger.js..."
/**
 * =====================================================
 * UTILITÁRIO DE LOGS - COMPATÍVEL COM BAILEYS
 * =====================================================
 * 
 * Dois loggers distintos:
 * - appLogger: usado pelo servidor (info, warn, error, debug)
 * - baileysLogger: usado APENAS pelo Baileys (trace, child, fatal)
 * 
 * REQUISITOS OBRIGATÓRIOS do baileysLogger:
 * - trace(), child(), fatal() devem existir
 * - child() DEVE retornar ele mesmo (flat)
 * - NÃO depende de contexto (companyId, etc)
 * - NÃO usa pino-pretty
 */

const pino = require('pino');

let baseLogger;
try {
  baseLogger = pino({ level: process.env.LOG_LEVEL || 'info' });
} catch {
  baseLogger = console;
}

// Logger para o app/servidor
const appLogger = {
  info: (...a) => baseLogger.info?.(...a) ?? console.log(...a),
  warn: (...a) => baseLogger.warn?.(...a) ?? console.warn(...a),
  error: (...a) => baseLogger.error?.(...a) ?? console.error(...a),
  debug: (...a) => baseLogger.debug?.(...a) ?? console.debug(...a),
};

// Logger para Baileys - FLAT, sem child dinâmico
const baileysLogger = {
  level: 'silent',
  info: () => {},
  debug: () => {},
  trace: () => {},
  warn: (...a) => appLogger.warn(...a),
  error: (...a) => appLogger.error(...a),
  fatal: (...a) => appLogger.error(...a),
  child: () => baileysLogger,
};

module.exports = { appLogger, baileysLogger };
LOGGER_EOF
log_success "logger.js criado (CommonJS + Baileys compatível)"

# ===== CRIAR WEBHOOK SERVICE (CommonJS) =====
log_step "Criando services/WebhookService.js..."
/**
 * =====================================================
 * SERVIÇO DE WEBHOOK
 * =====================================================
 * 
 * Responsável por enviar eventos para o Escala Certo Pro
 * via webhook HTTP.
 */

const { appLogger } = require('../utils/logger');

class WebhookService {
  constructor(webhookUrl, webhookSecret = null) {
    this.webhookUrl = webhookUrl;
    this.webhookSecret = webhookSecret;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }

  /**
   * Envia um evento para o webhook
   */
  async send(companyId, eventType, data) {
    if (!this.webhookUrl) {
      appLogger.warn(`[${companyId}] Webhook URL não configurado, evento ignorado: ${eventType}`);
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
        const headers = {
          'Content-Type': 'application/json'
        };

        // Adicionar secret se configurado
        if (this.webhookSecret) {
          headers['X-Webhook-Secret'] = this.webhookSecret;
        }

        const response = await fetch(this.webhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000) // 10s timeout
        });

        if (response.ok) {
          appLogger.debug(`[${companyId}] Webhook enviado: ${eventType}`);
          return true;
        }

        const errorText = await response.text();
        appLogger.warn(`[${companyId}] Webhook falhou (${response.status}): ${errorText}`);

        if (response.status >= 400 && response.status < 500) {
          // Erro do cliente, não tentar novamente
          return false;
        }
      } catch (error) {
        appLogger.error(`[${companyId}] Erro no webhook (tentativa ${attempt}):`, error.message);
      }

      // Aguardar antes de tentar novamente
      if (attempt < this.retryAttempts) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      }
    }

    appLogger.error(`[${companyId}] Webhook falhou após ${this.retryAttempts} tentativas: ${eventType}`);
    return false;
  }

  /**
   * Verifica se o webhook está acessível
   */
  async healthCheck() {
    if (!this.webhookUrl) {
      return { status: 'not_configured' };
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'OPTIONS',
        signal: AbortSignal.timeout(5000)
      });

      return {
        status: 'ok',
        statusCode: response.status
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
}

module.exports = { WebhookService };
WEBHOOK_EOF
log_success "WebhookService.js criado (CommonJS)"

# ===== CRIAR SESSION MANAGER (CommonJS + baileysLogger) =====
log_step "Criando managers/SessionManager.js..."
cat > "$INSTALL_DIR/src/managers/SessionManager.js" << 'SESSION_EOF'
/**
 * =====================================================
 * GERENCIADOR DE SESSÕES WHATSAPP - VERSÃO DEFINITIVA
 * =====================================================
 * 
 * Responsável por criar, gerenciar e manter sessões
 * WhatsApp Web usando a biblioteca Baileys.
 */

const { 
  makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { appLogger, baileysLogger } = require('../utils/logger');
const { normalizePhone, isLid, phoneToJid } = require('../utils/phoneNormalizer');

const RECONNECT_TIMEOUT = parseInt(process.env.RECONNECT_TIMEOUT) || 5000;
const MAX_RECONNECT_ATTEMPTS = parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 10;
const QR_TIMEOUT_MS = 30000;
const PENDING_MAX_AGE_MS = 60000;

class SessionManager {
  constructor(sessionsDir, webhookService) {
    this.sessionsDir = sessionsDir;
    this.webhookService = webhookService;
    this.sessions = new Map();
    this.sessionMeta = new Map();
    this.reconnectAttempts = new Map();
    this.qrStore = new Map();
    this.pendingConnections = new Map();
    this.errorStore = new Map();
  }

  _cleanupCompanyState(companyId) {
    this.pendingConnections.delete(companyId);
    this.qrStore.delete(companyId);
    this.errorStore.delete(companyId);
    appLogger.info(`[${companyId}] 🧹 Estado limpo`);
  }

  _setError(companyId, reason) {
    this.errorStore.set(companyId, { reason, timestamp: new Date() });
    this._cleanupCompanyState(companyId);
    this.errorStore.set(companyId, { reason, timestamp: new Date() });
    appLogger.warn(`[${companyId}] ❌ Erro registrado: ${reason}`);
  }

  async createSession(companyId) {
    appLogger.info(`[${companyId}] 🚀 Iniciando createSession...`);
    
    this._cleanupCompanyState(companyId);

    if (this.sessions.has(companyId)) {
      const existingSocket = this.sessions.get(companyId);
      if (existingSocket?.user) {
        appLogger.info(`[${companyId}] ✅ Sessão já existe e está conectada`);
        return { status: 'already_connected', phone_number: existingSocket.user.id?.split(':')[0] };
      }
      appLogger.info(`[${companyId}] 🗑️ Removendo sessão existente não conectada`);
      try {
        existingSocket?.end?.();
      } catch (e) {
        appLogger.warn(`[${companyId}] Erro ao encerrar socket existente:`, e.message);
      }
      this.sessions.delete(companyId);
      this.sessionMeta.delete(companyId);
    }

    const now = Date.now();
    this.pendingConnections.set(companyId, now);
    appLogger.info(`[${companyId}] ⏳ Marcado como pending: ${now}`);

    const qrTimeoutId = setTimeout(() => {
      const pendingTime = this.pendingConnections.get(companyId);
      const hasQr = this.qrStore.has(companyId);
      const socket = this.sessions.get(companyId);
      const isConnected = !!socket?.user;

      if (pendingTime === now && !hasQr && !isConnected) {
        appLogger.error(`[${companyId}] ⏰ TIMEOUT: QR não gerado em ${QR_TIMEOUT_MS/1000}s`);
        this._setError(companyId, 'qr_timeout');

        this.webhookService.send(companyId, 'error', {
          reason: 'qr_timeout',
          message: 'QR Code não foi gerado no tempo esperado'
        }).catch(e => appLogger.error(`[${companyId}] Erro ao enviar webhook de timeout:`, e));

        if (socket && !isConnected) {
          try {
            socket.end?.();
          } catch (e) {
            appLogger.warn(`[${companyId}] Erro ao encerrar socket no timeout:`, e.message);
          }
          this.sessions.delete(companyId);
          this.sessionMeta.delete(companyId);
        }
      }
    }, QR_TIMEOUT_MS);

    const sessionPath = path.join(this.sessionsDir, companyId);

    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      const { version } = await fetchLatestBaileysVersion();

      // IMPORTANTE: Usar baileysLogger para Baileys (FLAT, sem .child())
      const socket = makeWASocket({
        version,
        logger: baileysLogger,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, baileysLogger)
        },
        browser: ['Escala Certo Pro', 'Chrome', '120.0.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        emitOwnEvents: true,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
        getMessage: async () => undefined
      });

      this.sessions.set(companyId, socket);
      this.sessionMeta.set(companyId, {
        createdAt: new Date(),
        connected: false,
        phoneNumber: null,
        reconnecting: false,
        qrTimeoutId
      });
      this.reconnectAttempts.set(companyId, 0);

      this._setupEventHandlers(companyId, socket, saveCreds, qrTimeoutId);

      return { status: 'connecting' };
    } catch (error) {
      clearTimeout(qrTimeoutId);
      this._setError(companyId, 'create_session_error');
      appLogger.error(`[${companyId}] 💥 Erro ao criar sessão:`, error);
      throw error;
    }
  }

  _setupEventHandlers(companyId, socket, saveCreds, qrTimeoutId) {
    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrImage = await QRCode.toDataURL(qr, {
            errorCorrectionLevel: 'M',
            margin: 3,
            width: 256
          });

          if (qrTimeoutId) {
            clearTimeout(qrTimeoutId);
          }

          this.qrStore.set(companyId, { qr: qrImage, createdAt: new Date() });
          this.errorStore.delete(companyId);

          appLogger.info(`[${companyId}] 📱 QR Code gerado com sucesso`);

          await this.webhookService.send(companyId, 'qr_code', {
            qr_code: qrImage
          });

          const meta = this.sessionMeta.get(companyId);
          if (meta) {
            meta.lastQrCode = new Date();
          }
        } catch (error) {
          logger.error(`[${companyId}] Erro ao gerar QR Code:`, error);
          this._setError(companyId, 'qr_generation_error');
        }
      }

      if (connection === 'open') {
        const phoneNumber = socket.user?.id?.split(':')[0] || '';

        if (qrTimeoutId) {
          clearTimeout(qrTimeoutId);
        }

        this.qrStore.delete(companyId);
        this.pendingConnections.delete(companyId);
        this.errorStore.delete(companyId);

        logger.info(`[${companyId}] ✅ CONECTADO: ${phoneNumber}`);

        const meta = this.sessionMeta.get(companyId);
        if (meta) {
          meta.connected = true;
          meta.phoneNumber = phoneNumber;
          meta.lastConnectedAt = new Date();
          meta.reconnecting = false;
        }

        this.reconnectAttempts.set(companyId, 0);

        await this.webhookService.send(companyId, 'connected', {
          phone_number: phoneNumber
        });
      }

      if (connection === 'close') {
        const meta = this.sessionMeta.get(companyId);
        if (meta) {
          meta.connected = false;
        }

        if (qrTimeoutId) {
          clearTimeout(qrTimeoutId);
        }

        this.qrStore.delete(companyId);
        this.pendingConnections.delete(companyId);

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = DisconnectReason[statusCode] || statusCode;

        logger.warn(`[${companyId}] ❌ Desconectado: ${reason} (${statusCode})`);

        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
          const attempts = this.reconnectAttempts.get(companyId) || 0;

          if (attempts < MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts.set(companyId, attempts + 1);

            if (meta) {
              meta.reconnecting = true;
            }

            logger.info(`[${companyId}] 🔄 Reconectando... (tentativa ${attempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);

            this.sessions.delete(companyId);

            setTimeout(() => {
              this.createSession(companyId).catch(err => {
                logger.error(`[${companyId}] Erro na reconexão:`, err);
                this._setError(companyId, 'reconnect_failed');
              });
            }, RECONNECT_TIMEOUT);
          } else {
            logger.error(`[${companyId}] Máximo de tentativas de reconexão atingido`);
            this._setError(companyId, 'max_reconnect_attempts');

            await this.webhookService.send(companyId, 'disconnected', {
              reason: 'max_reconnect_attempts'
            });

            this.sessions.delete(companyId);
          }
        } else {
          logger.info(`[${companyId}] 🚪 LOGOUT: Limpando sessão completamente`);

          this._setError(companyId, 'logged_out');

          await this.webhookService.send(companyId, 'disconnected', {
            reason: 'logged_out'
          });

          this.sessions.delete(companyId);
          this.sessionMeta.delete(companyId);
          this.reconnectAttempts.delete(companyId);

          try {
            await this._removeSessionFiles(companyId);
            logger.info(`[${companyId}] 🗑️ Arquivos de sessão removidos após logout`);
          } catch (e) {
            logger.error(`[${companyId}] Erro ao remover arquivos após logout:`, e);
          }
        }
      }
    });

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        try {
          await this._processIncomingMessage(companyId, msg);
        } catch (error) {
          logger.error(`[${companyId}] Erro ao processar mensagem:`, error);
        }
      }
    });

    socket.ev.on('messages.update', async (updates) => {
      for (const update of updates) {
        try {
          await this._processMessageUpdate(companyId, update);
        } catch (error) {
          logger.error(`[${companyId}] Erro ao processar atualização:`, error);
        }
      }
    });

    socket.ev.on('presence.update', async ({ id, presences }) => {
      try {
        const normalizedChatPhone = normalizePhone(id);
        
        for (const [participantJid, presence] of Object.entries(presences)) {
          const normalizedParticipantPhone = normalizePhone(participantJid);
          const isTyping = presence.lastKnownPresence === 'composing';
          const isRecording = presence.lastKnownPresence === 'recording';
          
          if ((isTyping || isRecording) && normalizedParticipantPhone) {
            await this.webhookService.send(companyId, 'presence_update', {
              phone: normalizedParticipantPhone,
              chat_jid: id,
              presence: presence.lastKnownPresence,
            });
          }
        }
      } catch (error) {
        logger.error(`[${companyId}] Erro ao processar presença:`, error);
      }
    });
  }

  async _processIncomingMessage(companyId, msg) {
    if (msg.key.fromMe) return;
    if (msg.key.remoteJid === 'status@broadcast') return;
    if (msg.key.remoteJid?.endsWith('@g.us')) return;

    const rawJid = msg.key.remoteJid || '';
    const normalizedPhone = normalizePhone(rawJid);
    
    if (!normalizedPhone && isLid(rawJid)) {
      logger.warn(`[${companyId}] ⚠️ Ignorando mensagem de LID sem número real: ${rawJid}`);
      return;
    }
    
    const phone = normalizedPhone || rawJid.replace(/@.*$/, '');
    const senderName = msg.pushName || '';
    
    let content = '';
    let messageType = 'text';
    let mediaUrl = undefined;

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
    } else if (msg.message?.locationMessage) {
      content = '[Localização]';
      messageType = 'location';
    } else if (msg.message?.contactMessage) {
      content = msg.message.contactMessage.displayName || '[Contato]';
      messageType = 'contact';
    } else {
      content = '[Mensagem não suportada]';
    }

    logger.info(`[${companyId}] 📩 Mensagem de ${phone}: ${content.substring(0, 50)}...`);

    await this.webhookService.send(companyId, 'message_received', {
      message_id: msg.key.id,
      from: phone,
      raw_jid: rawJid,
      content,
      sender_name: senderName,
      message_type: messageType,
      media_url: mediaUrl,
      timestamp: msg.messageTimestamp
    });
  }

  async _processMessageUpdate(companyId, update) {
    if (!update.update.status) return;

    const statusMap = {
      1: 'pending',
      2: 'sent',
      3: 'delivered',
      4: 'read'
    };

    const status = statusMap[update.update.status];
    if (!status) return;

    appLogger.info(`[${companyId}] 📊 Status atualizado: ${update.key.id} -> ${status}`);

    await this.webhookService.send(companyId, 'message_status', {
      message_id: update.key.id,
      status
    });
  }

  async sendMessage(companyId, phone, content, messageType, localMessageId) {
    const socket = this.sessions.get(companyId);
    
    if (!socket) {
      throw new Error('Sessão não encontrada');
    }

    if (!socket.user) {
      throw new Error('WhatsApp não conectado');
    }

    const jid = phoneToJid(phone);

    try {
      let result;

      if (messageType === 'text' || !messageType) {
        result = await socket.sendMessage(jid, { text: content });
      } else {
        result = await socket.sendMessage(jid, { text: content });
      }

      appLogger.info(`[${companyId}] 📤 Mensagem enviada para ${phone}: ${result.key.id}`);

      if (localMessageId) {
        await this.webhookService.send(companyId, 'message_sent', {
          local_id: localMessageId,
          message_id: result.key.id
        });
      }

      return {
        messageId: localMessageId,
        whatsappMessageId: result.key.id
      };
    } catch (error) {
      appLogger.error(`[${companyId}] Erro ao enviar mensagem:`, error);
      throw error;
    }
  }

  async disconnectSession(companyId) {
    this._cleanupCompanyState(companyId);
    
    const socket = this.sessions.get(companyId);
    
    if (socket) {
      try {
        await socket.logout();
      } catch (error) {
        appLogger.warn(`[${companyId}] Erro ao fazer logout:`, error);
      }
      
      this.sessions.delete(companyId);
    }

    const meta = this.sessionMeta.get(companyId);
    if (meta) {
      meta.connected = false;
    }
  }

  async restartSession(companyId) {
    appLogger.info(`[${companyId}] 🔄 Reiniciando sessão...`);
    
    this._cleanupCompanyState(companyId);
    
    const socket = this.sessions.get(companyId);
    if (socket) {
      try {
        socket.end?.();
      } catch (e) {
        appLogger.warn(`[${companyId}] Erro ao encerrar socket:`, e.message);
      }
      this.sessions.delete(companyId);
    }
    
    this.sessionMeta.delete(companyId);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return await this.createSession(companyId);
  }

  async removeSession(companyId) {
    appLogger.info(`[${companyId}] 🗑️ Removendo sessão completamente...`);
    
    this._cleanupCompanyState(companyId);
    
    const socket = this.sessions.get(companyId);
    if (socket) {
      try {
        socket.end?.();
      } catch (e) {
        appLogger.warn(`[${companyId}] Erro ao encerrar socket:`, e.message);
      }
    }
    
    this.sessions.delete(companyId);
    this.sessionMeta.delete(companyId);
    this.reconnectAttempts.delete(companyId);
    
    await this._removeSessionFiles(companyId);
    
    return { status: 'removed' };
  }

  async _removeSessionFiles(companyId) {
    const sessionPath = path.join(this.sessionsDir, companyId);
    
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      appLogger.info(`[${companyId}] Arquivos de sessão removidos`);
    }
  }

  async restoreAllSessions() {
    if (!fs.existsSync(this.sessionsDir)) return;

    const sessionDirs = fs.readdirSync(this.sessionsDir);
    
    appLogger.info(`Restaurando ${sessionDirs.length} sessão(ões)...`);

    for (const companyId of sessionDirs) {
      const sessionPath = path.join(this.sessionsDir, companyId);
      
      if (fs.statSync(sessionPath).isDirectory()) {
        const credsFile = path.join(sessionPath, 'creds.json');
        
        if (fs.existsSync(credsFile)) {
          try {
            appLogger.info(`[${companyId}] Restaurando sessão...`);
            await this.createSession(companyId);
          } catch (error) {
            appLogger.error(`[${companyId}] Erro ao restaurar:`, error);
          }
        }
      }
    }
  }

  async disconnectAllSessions() {
    const companyIds = Array.from(this.sessions.keys());
    
    for (const companyId of companyIds) {
      try {
        this._cleanupCompanyState(companyId);
        const socket = this.sessions.get(companyId);
        if (socket) {
          socket.end();
        }
        this.sessions.delete(companyId);
      } catch (error) {
        logger.warn(`[${companyId}] Erro ao desconectar:`, error);
      }
    }
  }

  getQrCode(companyId) {
    const entry = this.qrStore.get(companyId);
    return entry?.qr || null;
  }

  getActiveSessions() {
    const active = [];
    
    for (const [companyId, socket] of this.sessions.entries()) {
      if (socket?.user) {
        active.push(companyId);
      }
    }
    
    return active;
  }

  getSessionStatus(companyId) {
    const socket = this.sessions.get(companyId);
    const meta = this.sessionMeta.get(companyId) || {};
    const pendingTime = this.pendingConnections.get(companyId);
    const error = this.errorStore.get(companyId);
    const qr = this.qrStore.get(companyId);
    
    if (socket?.user) {
      return {
        status: 'connected',
        exists: true,
        connecting: false,
        connected: true,
        phoneNumber: socket.user.id?.split(':')[0] || meta.phoneNumber || null,
        reconnecting: false,
        createdAt: meta.createdAt || null,
        lastConnectedAt: meta.lastConnectedAt || null
      };
    }
    
    if (qr) {
      return {
        status: 'qr',
        exists: true,
        connecting: false,
        connected: false,
        hasQr: true,
        phoneNumber: null,
        reconnecting: false,
        createdAt: meta.createdAt || null
      };
    }
    
    if (error) {
      const errorAge = Date.now() - error.timestamp.getTime();
      if (errorAge > 300000) {
        this.errorStore.delete(companyId);
      } else {
        return {
          status: 'error',
          exists: false,
          connecting: false,
          connected: false,
          error_reason: error.reason,
          phoneNumber: null,
          reconnecting: false
        };
      }
    }
    
    if (pendingTime) {
      const pendingAge = Date.now() - pendingTime;
      
      if (pendingAge < PENDING_MAX_AGE_MS) {
        return {
          status: 'connecting',
          exists: true,
          connecting: true,
          connected: false,
          pending_age_ms: pendingAge,
          phoneNumber: null,
          reconnecting: meta.reconnecting || false,
          createdAt: meta.createdAt || null
        };
      } else {
        this.pendingConnections.delete(companyId);
        this._setError(companyId, 'connection_stale');
        return {
          status: 'error',
          exists: false,
          connecting: false,
          connected: false,
          error_reason: 'connection_stale',
          phoneNumber: null,
          reconnecting: false
        };
      }
    }
    
    return {
      status: 'disconnected',
      exists: false,
      connecting: false,
      connected: false,
      phoneNumber: null,
      reconnecting: false
    };
  }

  getAllSessionsStatus() {
    const result = {};
    
    const allCompanyIds = new Set([
      ...this.sessions.keys(),
      ...this.pendingConnections.keys(),
      ...this.qrStore.keys(),
      ...this.errorStore.keys()
    ]);
    
    for (const companyId of allCompanyIds) {
      result[companyId] = this.getSessionStatus(companyId);
    }
    
    return result;
  }
}

module.exports = { SessionManager };
SESSION_EOF
log_success "SessionManager.js criado (CommonJS + baileysLogger)"

# ===== CRIAR INDEX.JS (CommonJS) =====
log_step "Criando src/index.js..."
cat > "$INSTALL_DIR/src/index.js" << 'INDEX_EOF'
/**
 * =====================================================
 * SERVIDOR WHATSAPP WEB - ESCALA CERTO PRO
 * =====================================================
 * 
 * Servidor Node.js com Baileys para gerenciamento de
 * sessões WhatsApp Web com suporte a multi-tenant.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const { SessionManager } = require('./managers/SessionManager');
const { WebhookService } = require('./services/WebhookService');
const { appLogger } = require('./utils/logger');

// =====================================================
// CONFIGURAÇÃO (com fallback para nomes antigos)
// =====================================================

const PORT = process.env.PORT || 3001;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// Aceitar múltiplas variantes de nomes (retrocompatibilidade)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET 
  || process.env.WHATSAPP_WEBHOOK_SECRET 
  || process.env.SERVER_SECRET;

const SERVER_SECRET = process.env.WHATSAPP_SERVER_SECRET 
  || process.env.SERVER_SECRET;

const SESSIONS_DIR = process.env.SESSIONS_DIR 
  || process.env.SESSION_DIR 
  || './sessions';

// Criar diretórios necessários
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

if (!fs.existsSync('./logs')) {
  fs.mkdirSync('./logs', { recursive: true });
}

// =====================================================
// INICIALIZAÇÃO
// =====================================================

const app = express();
app.use(cors());
app.use(express.json());

// Serviços
const webhookService = new WebhookService(WEBHOOK_URL, WEBHOOK_SECRET);
const sessionManager = new SessionManager(SESSIONS_DIR, webhookService);

// =====================================================
// MIDDLEWARE DE LOGS
// =====================================================

app.use((req, res, next) => {
  appLogger.info(`${req.method} ${req.path}`, { 
    ip: req.ip,
    body: req.method === 'POST' ? req.body : undefined 
  });
  next();
});

// =====================================================
// MIDDLEWARE DE AUTENTICAÇÃO (opcional)
// =====================================================

const validateServerToken = (req, res, next) => {
  // Se não há secret configurado, pular validação
  if (!SERVER_SECRET) {
    return next();
  }
  
  const token = req.headers['x-server-token'] || req.query.token;
  
  if (token !== SERVER_SECRET) {
    appLogger.warn(`Tentativa de acesso não autorizado: ${req.path}`);
    return res.status(401).json({ 
      success: false, 
      error: 'Token inválido' 
    });
  }
  
  next();
};

// =====================================================
// ENDPOINTS
// =====================================================

/**
 * POST /connect
 * Inicia uma nova sessão WhatsApp para a empresa
 * FORÇA reset da sessão anterior
 */
app.post('/connect', validateServerToken, async (req, res) => {
  const { company_id, force_reset } = req.body;

  if (!company_id) {
    return res.status(400).json({ 
      success: false, 
      error: 'company_id é obrigatório' 
    });
  }

  try {
    appLogger.info(`[${company_id}] POST /connect - force_reset: ${force_reset}`);
    
    // Se force_reset, remover sessão completamente antes
    if (force_reset) {
      await sessionManager.removeSession(company_id);
    }
    
    const result = await sessionManager.createSession(company_id);
    
    res.json({ 
      success: true, 
      message: 'Conexão iniciada. Aguarde o QR Code.',
      status: result.status,
      phone_number: result.phone_number || null
    });
  } catch (error) {
    appLogger.error(`[${company_id}] Erro ao conectar:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/whatsapp/qr
 * ENDPOINT DETERMINÍSTICO para polling
 * 
 * Retorna status EXPLÍCITO:
 * - CONNECTING: Sessão iniciando, aguarde
 * - QR: QR Code disponível (inclui qr base64)
 * - CONNECTED: Já conectado (inclui phone_number)
 * - ERROR: Erro ocorreu (inclui reason)
 * - DISCONNECTED: Sem sessão ativa
 * 
 * NUNCA retorna WAITING infinito!
 */
app.get('/api/whatsapp/qr', (req, res) => {
  const companyId = req.query.company_id || req.query.companyId;

  if (!companyId) {
    return res.status(400).json({
      status: 'ERROR',
      error: 'company_id é obrigatório'
    });
  }

  // Usar o novo método determinístico
  const sessionStatus = sessionManager.getSessionStatus(companyId);
  const qr = sessionManager.getQrCode(companyId);

  appLogger.info(`[${companyId}] GET /api/whatsapp/qr - status: ${sessionStatus.status}, hasQR: ${!!qr}`);

  // 1. CONNECTED
  if (sessionStatus.connected || sessionStatus.status === 'connected') {
    return res.json({
      status: 'CONNECTED',
      phone_number: sessionStatus.phoneNumber
    });
  }

  // 2. QR disponível
  if (qr || sessionStatus.status === 'qr') {
    return res.json({
      status: 'QR',
      qr: qr || null
    });
  }

  // 3. ERROR
  if (sessionStatus.status === 'error') {
    return res.json({
      status: 'ERROR',
      reason: sessionStatus.error_reason || 'unknown'
    });
  }

  // 4. CONNECTING (com idade)
  if (sessionStatus.status === 'connecting' || sessionStatus.connecting) {
    return res.json({
      status: 'CONNECTING',
      pending_age_ms: sessionStatus.pending_age_ms || 0
    });
  }

  // 5. DISCONNECTED
  return res.json({ 
    status: 'DISCONNECTED' 
  });
});

/**
 * POST /disconnect
 * Desconecta uma sessão WhatsApp
 */
app.post('/disconnect', validateServerToken, async (req, res) => {
  const { company_id } = req.body;

  if (!company_id) {
    return res.status(400).json({ 
      success: false, 
      error: 'company_id é obrigatório' 
    });
  }

  try {
    appLogger.info(`[${company_id}] Desconectando...`);
    
    await sessionManager.disconnectSession(company_id);
    
    res.json({ 
      success: true, 
      message: 'Sessão desconectada com sucesso' 
    });
  } catch (error) {
    appLogger.error(`[${company_id}] Erro ao desconectar:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /send
 * Envia uma mensagem de texto
 */
app.post('/send', validateServerToken, async (req, res) => {
  const { company_id, message_id, phone, content, message_type = 'text' } = req.body;

  if (!phone || !content) {
    return res.status(400).json({ 
      success: false, 
      error: 'phone e content são obrigatórios' 
    });
  }

  try {
    let targetCompanyId = company_id;
    
    if (!targetCompanyId) {
      const activeSessions = sessionManager.getActiveSessions();
      if (activeSessions.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Nenhuma sessão ativa encontrada' 
        });
      }
      targetCompanyId = activeSessions[0];
    }

    appLogger.info(`[${targetCompanyId}] Enviando mensagem para ${phone}`);

    const result = await sessionManager.sendMessage(
      targetCompanyId,
      phone,
      content,
      message_type,
      message_id
    );

    res.json({ 
      success: true, 
      message_id: result.messageId,
      whatsapp_message_id: result.whatsappMessageId
    });
  } catch (error) {
    appLogger.error(`Erro ao enviar mensagem:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /status
 * Retorna o status de todas as sessões
 */
app.get('/status', (req, res) => {
  const sessions = sessionManager.getAllSessionsStatus();

  res.json({
    status: 'online',
    webhook_url: WEBHOOK_URL,
    sessions,
    total_sessions: Object.keys(sessions).length,
    active_sessions: Object.values(sessions).filter(s => s.connected).length
  });
});

/**
 * GET /status/:company_id
 * Retorna o status de uma sessão específica
 */
app.get('/status/:company_id', (req, res) => {
  const { company_id } = req.params;
  
  const session = sessionManager.getSessionStatus(company_id);
  
  res.json({
    success: true,
    session
  });
});

/**
 * GET /health
 * Health check para load balancers e monitoramento
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

/**
 * POST /restart/:company_id
 * Reinicia uma sessão específica (mantém credenciais)
 */
app.post('/restart/:company_id', validateServerToken, async (req, res) => {
  const { company_id } = req.params;

  try {
    appLogger.info(`[${company_id}] Reiniciando sessão...`);
    
    const result = await sessionManager.restartSession(company_id);
    
    res.json({ 
      success: true, 
      message: 'Sessão reiniciada',
      status: result.status
    });
  } catch (error) {
    appLogger.error(`[${company_id}] Erro ao reiniciar:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * DELETE /session/:company_id
 * Remove completamente uma sessão (incluindo arquivos)
 * Permite conectar um novo número
 */
app.delete('/session/:company_id', validateServerToken, async (req, res) => {
  const { company_id } = req.params;

  try {
    appLogger.info(`[${company_id}] Removendo sessão completamente...`);
    
    await sessionManager.removeSession(company_id);
    
    res.json({ 
      success: true, 
      message: 'Sessão removida completamente' 
    });
  } catch (error) {
    appLogger.error(`[${company_id}] Erro ao remover:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// =====================================================
// INICIAR SERVIDOR
// =====================================================

app.listen(PORT, async () => {
  appLogger.info('=========================================');
  appLogger.info('🚀 SERVIDOR WHATSAPP - ESCALA CERTO PRO');
  appLogger.info('=========================================');
  appLogger.info(`📡 Porta: ${PORT}`);
  appLogger.info(`🔗 Webhook: ${WEBHOOK_URL || 'NÃO CONFIGURADO'}`);
  appLogger.info(`🔐 Auth: ${SERVER_SECRET ? 'ATIVO' : 'DESATIVADO'}`);
  appLogger.info(`📁 Sessões: ${path.resolve(SESSIONS_DIR)}`);
  appLogger.info('=========================================');

  // Restaurar sessões existentes na inicialização
  await sessionManager.restoreAllSessions();
});

// =====================================================
// TRATAMENTO DE ERROS
// =====================================================

process.on('uncaughtException', (error) => {
  appLogger.error('Erro não capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  appLogger.error('Promise rejeitada não tratada:', reason);
});

process.on('SIGINT', async () => {
  appLogger.info('Encerrando servidor...');
  await sessionManager.disconnectAllSessions();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  appLogger.info('Recebido SIGTERM, encerrando...');
  await sessionManager.disconnectAllSessions();
  process.exit(0);
});
INDEX_EOF
log_success "index.js criado (CommonJS)"

# ===== INSTALAR DEPENDÊNCIAS =====
log_step "Instalando dependências..."
cd "$INSTALL_DIR"
npm install --production 2>&1 | tail -5
log_success "Dependências instaladas"

# ===== CONFIGURAR FIREWALL =====
log_step "Configurando firewall..."
if command -v ufw &> /dev/null; then
    ufw allow $PORT/tcp > /dev/null 2>&1 || true
    log_success "Porta $PORT liberada no firewall"
else
    log_warn "UFW não encontrado, configure o firewall manualmente"
fi

# ===== INICIAR COM PM2 =====
log_step "Iniciando servidor com PM2..."
cd "$INSTALL_DIR"
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup systemd -u root --hp /root > /dev/null 2>&1 || true
log_success "Servidor iniciado"

# ===== VERIFICAR =====
log_step "Verificando servidor..."
sleep 3

if curl -s http://localhost:$PORT/health | grep -q "ok"; then
    log_success "Servidor respondendo em http://localhost:$PORT"
else
    log_warn "Servidor pode não estar respondendo ainda, verificar logs"
fi

# ===== RESUMO FINAL =====
echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "📡 ${BLUE}Servidor:${NC} http://SEU-IP:$PORT"
echo -e "🔗 ${BLUE}Webhook:${NC} $WEBHOOK_URL"
echo -e "🔐 ${BLUE}Token:${NC} ${SECURITY_TOKEN:0:4}****"
echo ""
echo -e "${YELLOW}Comandos úteis:${NC}"
echo "  pm2 status              # Ver status"
echo "  pm2 logs escala-whatsapp # Ver logs"
echo "  pm2 restart escala-whatsapp # Reiniciar"
echo ""
echo -e "${YELLOW}Testar conexão:${NC}"
echo "  curl http://localhost:$PORT/health"
echo "  curl http://localhost:$PORT/diagnostics"
echo ""
echo -e "${GREEN}================================================${NC}"

# Mostrar últimos logs
echo ""
log_step "Últimos logs do servidor:"
pm2 logs escala-whatsapp --lines 20 --nostream
