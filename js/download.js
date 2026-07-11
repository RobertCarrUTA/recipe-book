export function downloadTextFile(payload, options = {}) {
  const documentLike = options.document || globalThis.document;
  const windowLike = options.window || globalThis;
  const BlobCtor = Object.hasOwn(options, "Blob") ? options.Blob : globalThis.Blob;
  const urlApi = Object.hasOwn(options, "urlApi") ? options.urlApi : windowLike.URL || globalThis.URL;

  if (!documentLike?.body || typeof documentLike.createElement !== "function") {
    throw new Error("Downloads require a document body.");
  }
  if (
    typeof BlobCtor !== "function" ||
    typeof urlApi?.createObjectURL !== "function" ||
    typeof urlApi?.revokeObjectURL !== "function"
  ) {
    throw new Error("Downloads are not available in this browser.");
  }

  const link = documentLike.createElement("a");
  let objectUrl = null;

  try {
    const blob = new BlobCtor([payload.text], { type: payload.mimeType });
    objectUrl = urlApi.createObjectURL(blob);
    link.href = objectUrl;
    link.download = payload.fileName;
    link.hidden = true;
    documentLike.body.appendChild(link);
    link.click();
  } finally {
    link.remove();

    if (objectUrl) {
      if (windowLike && typeof windowLike.setTimeout === "function") {
        windowLike.setTimeout(() => urlApi.revokeObjectURL(objectUrl), 0);
      } else {
        urlApi.revokeObjectURL(objectUrl);
      }
    }
  }

  return true;
}
