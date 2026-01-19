/**
 * =====================================================
 * UTILITÁRIO DE LOGS - COMPATÍVEL COM BAILEYS
 * =====================================================
 * 
 * Logger para o servidor WhatsApp.
 * Exporta:
 * - logger: para logs do app (info, warn, error, debug)
 * - baileysLogger: para Baileys (com trace, child, fatal)
 * 
 * IMPORTANTE: Baileys REQUER que o logger tenha:
 * - trace(), debug(), info(), warn(), error(), fatal()
 * - child() que retorna outro logger
 */

const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

// Verificar se pino-pretty está disponível (dev only)
let hasPinoPretty = false;
if (!isProduction) {
  try {
    require.resolve('pino-pretty');
    hasPinoPretty = true;
  } catch {
    hasPinoPretty = false;
  }
}

// Logger principal para a aplicação
const logger = pino({
  level: LOG_LEVEL,
  transport: (!isProduction && hasPinoPretty) 
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      }
    : undefined,
  base: {
    service: 'escala-whatsapp'
  }
});

/**
 * Logger compatível com Baileys
 * 
 * Baileys chama internamente: logger.trace(), logger.child()
 * Se esses métodos não existirem, dá erro:
 * "TypeError: logger.trace is not a function"
 * 
 * Este logger silencia trace/debug/info do Baileys (muito verboso)
 * mas mantém warn/error/fatal visíveis
 */
const createBaileysLogger = (parentLogger, context = {}) => {
  const baileysLogger = {
    level: 'silent', // Baileys verifica isso
    
    // Métodos silenciosos (Baileys é MUITO verboso)
    trace: () => {},
    debug: () => {},
    info: () => {},
    
    // Métodos que logam (apenas warnings e erros)
    warn: (...args) => {
      if (args.length === 1 && typeof args[0] === 'object') {
        parentLogger.warn({ ...context, ...args[0] });
      } else if (args.length === 2 && typeof args[0] === 'object') {
        parentLogger.warn({ ...context, ...args[0] }, args[1]);
      } else {
        parentLogger.warn(context, ...args);
      }
    },
    error: (...args) => {
      if (args.length === 1 && typeof args[0] === 'object') {
        parentLogger.error({ ...context, ...args[0] });
      } else if (args.length === 2 && typeof args[0] === 'object') {
        parentLogger.error({ ...context, ...args[0] }, args[1]);
      } else {
        parentLogger.error(context, ...args);
      }
    },
    fatal: (...args) => {
      if (args.length === 1 && typeof args[0] === 'object') {
        parentLogger.error({ ...context, ...args[0], fatal: true });
      } else if (args.length === 2 && typeof args[0] === 'object') {
        parentLogger.error({ ...context, ...args[0], fatal: true }, args[1]);
      } else {
        parentLogger.error({ ...context, fatal: true }, ...args);
      }
    },
    
    // child() DEVE retornar outro logger com mesma interface
    child: (childContext = {}) => {
      return createBaileysLogger(parentLogger, { ...context, ...childContext });
    }
  };
  
  return baileysLogger;
};

// Instância do baileysLogger para exportar
const baileysLogger = createBaileysLogger(logger);

module.exports = { 
  logger, 
  baileysLogger 
};
