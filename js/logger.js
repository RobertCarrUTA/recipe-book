const noop = () => {};

function getConsoleMethod(consoleLike, method) {
  if (!consoleLike || typeof consoleLike[method] !== "function") return noop;
  return consoleLike[method].bind(consoleLike);
}

export function createLogger(scope, options = {}) {
  const consoleLike = options.console || globalThis.console;
  const debugEnabled = Boolean(options.debugEnabled);
  const prefix = scope ? `[${scope}]` : "[app]";

  return {
    debug: debugEnabled ? getConsoleMethod(consoleLike, "debug").bind(null, prefix) : noop,
    info: getConsoleMethod(consoleLike, "info").bind(null, prefix),
    warn: getConsoleMethod(consoleLike, "warn").bind(null, prefix),
    error: getConsoleMethod(consoleLike, "error").bind(null, prefix),
  };
}

export function isDebugEnabled(locationLike = globalThis.location) {
  try {
    const params = new URLSearchParams(locationLike.search || "");
    return params.has("debug");
  } catch (error) {
    return false;
  }
}
