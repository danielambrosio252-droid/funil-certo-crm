/**
 * =====================================================
 * UTILITÁRIO DE LOGS
 * =====================================================
 * 
 * Logger simples para o servidor WhatsApp.
 * Em produção, usa formato JSON para integração com
 * ferramentas de monitoramento.
 */

const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  level: isProduction ? 'info' : 'debug',
  transport: isProduction 
    ? undefined 
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      },
  base: {
    service: 'escala-whatsapp'
  }
});

// Em desenvolvimento sem pino-pretty, usar console
if (!isProduction) {
  try {
    require('pino-pretty');
  } catch {
    // pino-pretty não instalado, usar logger básico
    module.exports = {
      logger: {
        info: (...args) => console.log('[INFO]', new Date().toISOString(), ...args),
        warn: (...args) => console.warn('[WARN]', new Date().toISOString(), ...args),
        error: (...args) => console.error('[ERROR]', new Date().toISOString(), ...args),
        debug: (...args) => console.log('[DEBUG]', new Date().toISOString(), ...args)
      }
    };
  }
}

module.exports = { logger };
