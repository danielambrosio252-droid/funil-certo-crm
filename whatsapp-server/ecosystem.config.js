/**
 * Configuração do PM2 para rodar o servidor em produção
 * 
 * Uso:
 *   npm run pm2:start   - Inicia o servidor
 *   npm run pm2:stop    - Para o servidor
 *   npm run pm2:restart - Reinicia o servidor
 *   npm run pm2:logs    - Visualiza logs em tempo real
 */
module.exports = {
  apps: [
    {
      name: 'escala-whatsapp',
      script: 'src/index.js',
      instances: 1, // WhatsApp Web precisa de 1 instância por empresa
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
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
