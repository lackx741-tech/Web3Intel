(function (global) {
  const MAX_PREVIEW_LENGTH = 320;

  function truncate(value, maxLength) {
    const limit = typeof maxLength === 'number' ? maxLength : MAX_PREVIEW_LENGTH;
    const stringValue = typeof value === 'string' ? value : String(value ?? '');
    return stringValue.length > limit ? stringValue.slice(0, limit - 1) + '…' : stringValue;
  }

  function safeJsonParse(value) {
    if (typeof value !== 'string') {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  function previewValue(value) {
    if (value == null) {
      return null;
    }

    if (typeof FormData !== 'undefined' && value instanceof FormData) {
      const formEntries = [];
      value.forEach(function (entryValue, entryKey) {
        formEntries.push([entryKey, entryValue instanceof File ? '[File]' : entryValue]);
      });
      return truncate(JSON.stringify(formEntries));
    }

    if (typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams) {
      return truncate(value.toString());
    }

    if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
      return '[ArrayBuffer ' + value.byteLength + ' bytes]';
    }

    if (typeof Blob !== 'undefined' && value instanceof Blob) {
      return '[Blob ' + value.size + ' bytes]';
    }

    if (ArrayBuffer.isView(value)) {
      return '[TypedArray ' + value.byteLength + ' bytes]';
    }

    if (typeof value === 'string') {
      return truncate(value);
    }

    if (typeof value === 'object') {
      try {
        return truncate(JSON.stringify(value));
      } catch (error) {
        return truncate(Object.prototype.toString.call(value));
      }
    }

    return truncate(String(value));
  }

  function getUrlObject(url, baseUrl) {
    try {
      return new URL(url, baseUrl || (global.location ? global.location.href : undefined));
    } catch (error) {
      return null;
    }
  }

  function normalizeUrl(url, baseUrl) {
    const parsed = getUrlObject(url, baseUrl);
    return parsed ? parsed.href : url;
  }

  function unique(values) {
    return Array.from(new Set((values || []).filter(Boolean)));
  }

  function inferApiKind(details) {
    const safeDetails = details || {};
    const channel = safeDetails.channel || safeDetails.type || '';
    if (/eventsource/i.test(channel)) {
      return 'SSE';
    }
    if (/websocket/i.test(channel)) {
      return 'WebSocket';
    }

    const payloadPreview = safeDetails.requestPayloadPreview || safeDetails.payloadPreview || '';
    const lowerPayload = String(payloadPreview).toLowerCase();
    const lowerUrl = String(safeDetails.url || '').toLowerCase();
    const parsedPayload = safeJsonParse(payloadPreview);

    if (parsedPayload && typeof parsedPayload === 'object') {
      if (parsedPayload.jsonrpc || typeof parsedPayload.method === 'string' && /^(eth_|wallet_|net_|personal_)/.test(parsedPayload.method)) {
        return 'JSON-RPC';
      }
      if (typeof parsedPayload.query === 'string' || typeof parsedPayload.operationName === 'string') {
        return 'GraphQL';
      }
    }

    if (/\b(jsonrpc|eth_|wallet_|net_|personal_)\b/.test(lowerPayload) || /\/rpc\b/.test(lowerUrl)) {
      return 'JSON-RPC';
    }

    if (/graphql/.test(lowerUrl) || /\b(query|mutation|subscription)\b/.test(lowerPayload)) {
      return 'GraphQL';
    }

    return 'REST';
  }

  function extractRpcMethods(input) {
    const methods = [];

    function collect(value) {
      if (!value) {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach(collect);
        return;
      }

      if (typeof value === 'string') {
        const parsed = safeJsonParse(value);
        if (parsed) {
          collect(parsed);
          return;
        }

        const matches = value.match(/(?:eth_[A-Za-z0-9_]+|wallet_[A-Za-z0-9_]+|personal_[A-Za-z0-9_]+|net_[A-Za-z0-9_]+)/g);
        if (matches) {
          matches.forEach(function (match) {
            methods.push(match);
          });
        }
        return;
      }

      if (typeof value === 'object') {
        if (typeof value.method === 'string') {
          methods.push(value.method);
        }
        if (Array.isArray(value.params)) {
          value.params.forEach(collect);
        }
      }
    }

    collect(input);
    return unique(methods.filter(function (method) {
      return /^(eth_|wallet_|personal_|net_)/.test(method);
    }));
  }

  function isThirdPartyUrl(url, baseUrl) {
    const resourceUrl = getUrlObject(url, baseUrl);
    const base = getUrlObject(baseUrl || (global.location ? global.location.href : ''), baseUrl);
    if (!resourceUrl || !base) {
      return false;
    }
    return resourceUrl.origin !== base.origin;
  }

  function formatBytes(bytes) {
    if (typeof bytes !== 'number' || !isFinite(bytes)) {
      return 'Unknown';
    }
    if (bytes < 1024) {
      return bytes + ' B';
    }
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, function (character) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character];
    });
  }

  global.WebsiteIntelShared = {
    escapeHtml: escapeHtml,
    extractRpcMethods: extractRpcMethods,
    formatBytes: formatBytes,
    inferApiKind: inferApiKind,
    isThirdPartyUrl: isThirdPartyUrl,
    normalizeUrl: normalizeUrl,
    previewValue: previewValue,
    safeJsonParse: safeJsonParse,
    truncate: truncate,
    unique: unique
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
