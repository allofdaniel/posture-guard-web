/**
 * WebSocket Relay Server
 * Relays messages between PWA and Wear OS clients.
 */

const WebSocket = require('ws');
const http = require('http');

const PORT = 8080;
const HEARTBEAT_INTERVAL_MS = 30000;
const MAX_MESSAGE_BYTES = 8192;
const ALLOWED_VIBRATE_PATTERNS = new Set(['low', 'medium', 'high', 'pulse']);
let nextConnectionId = 0;
const ALLOWED_ORIGINS = new Set(
  (process.env.RELAY_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const ALLOWED_TOKENS = (process.env.RELAY_AUTH_TOKENS || '')
  .split(',')
  .map((token) => token.trim())
  .filter(Boolean);
const REQUIRE_TOKEN = ALLOWED_TOKENS.length > 0;

const MAX_PAYLOAD_DEPTH = 3;
const nextLogContext = () => `#${String(nextConnectionId).padStart(4, '0')}`;

const buildLogEvent = (code, metadata = {}) => ({
  code,
  ts: new Date().toISOString(),
  ...metadata,
});

const logDebug = (code, metadata) => {
  console.debug(JSON.stringify(buildLogEvent(`relay.${code}`, metadata)));
};

const logWarn = (code, metadata) => {
  console.warn(JSON.stringify(buildLogEvent(`relay.${code}`, metadata)));
};

const logError = (code, metadata) => {
  console.error(JSON.stringify(buildLogEvent(`relay.${code}`, metadata)));
};

const attachConnectionMetadata = (ws, req) => {
  nextConnectionId += 1;
  ws.__connId = nextLogContext();
  ws.__remoteAddress = req?.socket?.remoteAddress || 'unknown';
  ws.__userAgent = req?.headers?.['user-agent'] || 'unknown';
};

const getConnectionMetadata = (ws) => ({
  connectionId: ws?.__connId || 'unknown',
  remoteAddress: ws?.__remoteAddress || 'unknown',
});

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Posture Guard WebSocket Relay Server');
});

const wss = new WebSocket.Server({ server });

const clients = {
  web: new Set(),
  watch: new Set(),
};

const sendPayload = (client, payload) => {
  if (!client || client.readyState !== WebSocket.OPEN) {
    if (client) {
      removeSocketFromClients(client);
    }
    return;
  }

  try {
    client.send(payload);
  } catch (error) {
    logWarn('send.failure', {
      error: error.message,
      ...getConnectionMetadata(client),
    });
    removeSocketFromClients(client);
  }
};

const broadcastToWeb = (payload) => {
  const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
  clients.web.forEach((client) => sendPayload(client, message));
};

const broadcastToWatch = (payload) => {
  const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
  clients.watch.forEach((client) => sendPayload(client, message));
};

const buildStatus = () => ({
  type: 'status',
  webClients: clients.web.size,
  watchClients: clients.watch.size,
});

const sendError = (client, message) => {
  sendPayload(client, JSON.stringify({
    type: 'error',
    message,
  }));
};

const safeInt = (value, fallback = 0, min = 0, max = Number.POSITIVE_INFINITY) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(min, Math.min(max, Math.floor(value)));
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  return Math.max(min, Math.min(max, normalized));
};

const clampPattern = (pattern) => {
  if (typeof pattern === 'string' && ALLOWED_VIBRATE_PATTERNS.has(pattern)) return pattern;
  return 'medium';
};

const sanitizeData = (value, depth = 0) => {
  if (depth > MAX_PAYLOAD_DEPTH) return undefined;

  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.slice(0, 120);
  if (typeof value === 'number') return safeInt(value, 0, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY);
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, 24)
      .map((entry) => sanitizeData(entry, depth + 1))
      .filter((entry) => entry !== undefined);
  }
  if (typeof value !== 'object' || Object.prototype.toString.call(value) !== '[object Object]') return undefined;

  const cleaned = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof key !== 'string' || key.length > 48) continue;
    const normalized = sanitizeData(entry, depth + 1);
    if (normalized !== undefined) {
      cleaned[key] = normalized;
    }
  }
  return cleaned;
};

const sanitizeConfigPayload = (message) => {
  const { type: _type, ...rest } = message;
  return sanitizeData(rest);
};

const removeSocketFromClients = (socket) => {
  clients.web.delete(socket);
  clients.watch.delete(socket);
};

const parseMessage = (data) => {
  if (typeof data === 'string') {
    if (data.length > MAX_MESSAGE_BYTES) return null;
  } else if (Buffer.isBuffer(data)) {
    if (data.length > MAX_MESSAGE_BYTES) return null;
    data = data.toString('utf8');
  } else if (data instanceof ArrayBuffer) {
    if (data.byteLength > MAX_MESSAGE_BYTES) return null;
    data = Buffer.from(data).toString('utf8');
  } else {
    return null;
  }

  try {
    const message = JSON.parse(data);
    if (!message || typeof message !== 'object' || Array.isArray(message)) return null;
    return message;
  } catch {
    return null;
  }
};

const isPrivateIp = (address) => {
  if (!address) return false;

  const normalized = address.replace('::ffff:', '');
  return (
    normalized === '127.0.0.1'
    || normalized === '::1'
    || normalized === 'localhost'
    || normalized.startsWith('10.')
    || normalized.startsWith('192.168.')
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
    || normalized.startsWith('192.168.')
  );
};

const parseAuthToken = (req) => {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  if (req.url) {
    try {
      const url = new URL(req.url, `ws://${req.headers.host || 'localhost'}`);
      const queryToken = url.searchParams.get('token');
      if (queryToken) {
        return queryToken.trim();
      }
    } catch {
      return '';
    }
  }

  return '';
};

const isAllowedOrigin = (req) => {
  const remoteAddress = req.socket?.remoteAddress || '';
  const originHeader = req.headers.origin || '';

  if (!ALLOWED_ORIGINS.size) {
    return isPrivateIp(remoteAddress);
  }

  if (!originHeader) {
    return isPrivateIp(remoteAddress);
  }

  try {
    const originHost = new URL(originHeader).hostname;
    return ALLOWED_ORIGINS.has(originHost) || ALLOWED_ORIGINS.has(req.headers.host?.split(':')[0]);
  } catch {
    return false;
  }
};

const isAuthorized = (req) => {
  if (!REQUIRE_TOKEN) return true;
  const token = parseAuthToken(req);
  return token && ALLOWED_TOKENS.includes(token);
};

const isConnectionAllowed = (req) => isAllowedOrigin(req) && isAuthorized(req);

logDebug('server.start', { port: PORT });

wss.on('connection', (ws, req) => {
  const remoteAddress = req?.socket?.remoteAddress || 'unknown';
  attachConnectionMetadata(ws, req);

  logDebug('connection.attempt', {
    ...getConnectionMetadata(ws),
    remoteAddress,
    userAgent: ws.__userAgent,
  });

  if (!isConnectionAllowed(req)) {
    ws.close(1008, 'Forbidden');
    logWarn('connection.rejected', {
      ...getConnectionMetadata(ws),
      reason: 'forbidden',
      remoteAddress,
    });
    return;
  }

  logDebug('connection.accepted', {
    ...getConnectionMetadata(ws),
    remoteAddress,
  });

  let deviceType = null;

  ws.on('message', (data) => {
    const message = parseMessage(data);
    if (!message || typeof message.type !== 'string') {
      logWarn('message.invalid', {
        ...getConnectionMetadata(ws),
      });
      sendError(ws, 'Invalid message format');
      return;
    }

    if (!deviceType && message.type !== 'register') {
      sendError(ws, 'Register device first');
      return;
    }

    switch (message.type) {
      case 'register': {
        const requestedType = message.device;
        if (requestedType !== 'web' && requestedType !== 'watch') {
          sendError(ws, 'Unsupported device type');
          return;
        }

        removeSocketFromClients(ws);
        deviceType = requestedType;

        if (deviceType === 'web') {
          clients.web.add(ws);
          logDebug('client.registered', {
            ...getConnectionMetadata(ws),
            type: 'web',
            webClients: clients.web.size,
            watchClients: clients.watch.size,
          });
          sendPayload(ws, JSON.stringify(buildStatus()));
          sendPayload(ws, JSON.stringify({ type: 'registered', device: 'web' }));
          return;
        }

        clients.watch.add(ws);
        logDebug('client.registered', {
          ...getConnectionMetadata(ws),
          type: 'watch',
          webClients: clients.web.size,
          watchClients: clients.watch.size,
        });
        broadcastToWeb({
          type: 'watchConnected',
          watchClients: clients.watch.size,
          count: clients.watch.size,
        });
        sendPayload(ws, JSON.stringify({ type: 'registered', device: 'watch' }));
        break;
      }

      case 'vibrate': {
        if (deviceType !== 'web') {
          sendError(ws, 'Only web client can send vibration');
          return;
        }

        const vibrationMsg = {
          type: 'vibrate',
          intensity: safeInt(message.intensity, 255, 1, 255),
          pattern: clampPattern(message.pattern),
        };

        broadcastToWatch(vibrationMsg);
        logDebug('message.vibrate.forwarded', {
          ...getConnectionMetadata(ws),
          watchClients: clients.watch.size,
        });
        break;
      }

      case 'config': {
        if (deviceType !== 'web') {
          sendError(ws, 'Only web client can send config');
          return;
        }

        const config = sanitizeConfigPayload(message);
        if (!config || Object.keys(config).length === 0) {
          sendError(ws, 'Invalid config payload');
          logWarn('message.config.invalid', {
            ...getConnectionMetadata(ws),
          });
          return;
        }

        broadcastToWatch({ type: 'config', ...config });
        logDebug('message.config.forwarded', {
          ...getConnectionMetadata(ws),
          payloadKeys: Object.keys(config),
        });
        break;
      }

      case 'status': {
        sendPayload(ws, JSON.stringify(buildStatus()));
        break;
      }

      default:
        sendError(ws, 'Unknown message type');
        logWarn('message.unknown', {
          ...getConnectionMetadata(ws),
          messageType: message.type,
        });
        break;
    }
  });

  ws.on('close', () => {
    logDebug('connection.closed', {
      ...getConnectionMetadata(ws),
      clientType: deviceType || 'unknown',
      webClients: clients.web.size - (deviceType === 'web' ? 1 : 0),
      watchClients: clients.watch.size - (deviceType === 'watch' ? 1 : 0),
    });
    clients.web.delete(ws);
    clients.watch.delete(ws);

    if (deviceType === 'watch') {
      broadcastToWeb({
        type: 'watchDisconnected',
        watchClients: clients.watch.size,
        count: clients.watch.size,
      });
    }
  });

  ws.on('error', (err) => {
    logError('connection.error', {
      ...getConnectionMetadata(ws),
      error: err.message,
      clientType: deviceType,
    });
  });

  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
});

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      ws.terminate();
      return;
    }

    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL_MS);

wss.on('close', () => {
  clearInterval(interval);
});

server.listen(PORT, '0.0.0.0', () => {
  logDebug('server.ready', {
    host: '0.0.0.0',
    port: PORT,
    enforceOrigin: Boolean(ALLOWED_ORIGINS.size),
    requireToken: REQUIRE_TOKEN,
    tokenCount: ALLOWED_TOKENS.length,
    originCount: ALLOWED_ORIGINS.size,
  });
});
