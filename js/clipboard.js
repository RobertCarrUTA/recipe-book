export async function writeTextToClipboard(text, options = {}) {
  const document = options.document || globalThis.document;
  const logger = options.logger || console;
  const navigator = options.navigator || globalThis.navigator;
  const clipboard = navigator && navigator.clipboard;

  if (clipboard && typeof clipboard.writeText === "function") {
    try {
      await clipboard.writeText(text);
      return true;
    } catch (error) {
      if (logger && typeof logger.warn === "function") {
        logger.warn("Clipboard API failed; trying copy fallback", error);
      }
    }
  }

  if (!document || !document.body || typeof document.createElement !== "function") {
    throw new Error("Clipboard copy failed.");
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand && document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard copy failed.");

  return true;
}
