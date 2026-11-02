/** ShareX custom uploader (.sxcu) configs for this instance's v1 API. */

export type ShareXKind = "files" | "links";

export function buildShareXConfig(
  origin: string,
  token: string,
  kind: ShareXKind
): Record<string, unknown> {
  const base = origin.replace(/\/+$/, "");
  const host = new URL(base).host;
  const common = {
    Version: "15.0.0",
    RequestMethod: "POST",
    Headers: { Authorization: `Bearer ${token}` },
    ErrorMessage: "{json:error}",
  };

  if (kind === "files") {
    return {
      ...common,
      Name: `SnowShare files (${host})`,
      DestinationType: "ImageUploader, FileUploader",
      RequestURL: `${base}/api/v1/upload`,
      Body: "MultipartFormData",
      FileFormName: "file",
      URL: `${base}/f/{json:share.slug}`,
    };
  }

  return {
    ...common,
    Name: `SnowShare links (${host})`,
    DestinationType: "URLShortener",
    RequestURL: `${base}/api/v1/shares`,
    Body: "JSON",
    Data: JSON.stringify({ type: "URL", urlOriginal: "{input}" }),
    URL: `${base}/l/{json:share.slug}`,
  };
}

/** Triggers a browser download of the .sxcu file. */
export function downloadShareXConfig(origin: string, token: string, kind: ShareXKind) {
  const config = buildShareXConfig(origin, token, kind);
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `snowshare-${kind}.sxcu`;
  a.click();
  URL.revokeObjectURL(url);
}
