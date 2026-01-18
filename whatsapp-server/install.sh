#!/bin/bash

# =====================================================
# SCRIPT DE INSTALAÇÃO - SERVIDOR WHATSAPP
# =====================================================
# 
# Este script configura automaticamente o servidor
# WhatsApp em uma VPS Ubuntu 20.04+
#
# Uso:
#   chmod +x install.sh
#   ./install.sh
# =====================================================

set -e

echo "==========================================="
echo "🚀 INSTALAÇÃO DO SERVIDOR WHATSAPP"
echo "   Escala Certo Pro"
echo "==========================================="

# Verificar se é root
if [ "$EUID" -eq 0 ]; then
  echo "❌ Não execute como root. Use um usuário normal com sudo."
  exit 1
fi

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função de log
log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# =====================================================
# 1. Atualizar sistema
# =====================================================
log_info "Atualizando sistema..."
sudo apt update && sudo apt upgrade -y

# =====================================================
# 2. Instalar Node.js 20 LTS
# =====================================================
log_info "Instalando Node.js 20 LTS..."

if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v)
  log_info "Node.js já instalado: $NODE_VERSION"
else
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
  log_info "Node.js instalado: $(node -v)"
fi

# =====================================================
# 3. Instalar PM2
# =====================================================
log_info "Instalando PM2..."

if command -v pm2 &> /dev/null; then
  log_info "PM2 já instalado"
else
  sudo npm install -g pm2
  log_info "PM2 instalado"
fi

# =====================================================
# 4. Criar diretórios
# =====================================================
log_info "Criando diretórios..."
mkdir -p sessions logs

# =====================================================
# 5. Instalar dependências
# =====================================================
log_info "Instalando dependências do Node.js..."
npm install

# =====================================================
# 6. Configurar variáveis de ambiente
# =====================================================
if [ ! -f .env ]; then
  log_info "Configurando variáveis de ambiente..."
  
  read -p "Digite a URL do webhook (Escala Certo Pro): " WEBHOOK_URL
  read -p "Digite a porta do servidor (padrão: 3001): " PORT
  PORT=${PORT:-3001}
  
  cat > .env << EOF
PORT=$PORT
WEBHOOK_URL=$WEBHOOK_URL
NODE_ENV=production
SESSIONS_DIR=./sessions
EOF

  log_info "Arquivo .env criado"
else
  log_warn "Arquivo .env já existe, mantendo configuração atual"
fi

# =====================================================
# 7. Configurar PM2 startup
# =====================================================
log_info "Configurando PM2 para iniciar com o sistema..."
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

# =====================================================
# 8. Iniciar servidor
# =====================================================
log_info "Iniciando servidor..."
npm run pm2:start
pm2 save

# =====================================================
# 9. Configurar firewall (se UFW instalado)
# =====================================================
if command -v ufw &> /dev/null; then
  log_info "Configurando firewall..."
  sudo ufw allow $PORT/tcp
  log_info "Porta $PORT liberada no firewall"
fi

# =====================================================
# Finalização
# =====================================================
echo ""
echo "==========================================="
echo -e "${GREEN}✅ INSTALAÇÃO CONCLUÍDA!${NC}"
echo "==========================================="
echo ""
echo "📡 Servidor rodando na porta: $PORT"
echo "📁 Sessões salvas em: ./sessions"
echo "📝 Logs em: ./logs"
echo ""
echo "Comandos úteis:"
echo "  pm2 logs escala-whatsapp    - Ver logs em tempo real"
echo "  pm2 restart escala-whatsapp - Reiniciar servidor"
echo "  pm2 stop escala-whatsapp    - Parar servidor"
echo "  pm2 status                  - Ver status do processo"
echo ""
echo "Próximos passos:"
echo "  1. Configure a URL do servidor no Escala Certo Pro"
echo "  2. Clique em 'Conectar WhatsApp'"
echo "  3. Escaneie o QR Code com seu WhatsApp"
echo ""
echo "==========================================="
