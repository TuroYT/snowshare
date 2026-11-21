/**
 * Copies text to the clipboard. `navigator.clipboard` only exists in secure contexts (HTTPS or
 * localhost), which self-hosted instances served over plain HTTP are not, so fall back to a
 * hidden textarea and `execCommand`. Resolves to false when both paths fail.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error("Clipboard API failed, falling back to execCommand:", error);
    }
  }

  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  const previouslyFocused = document.activeElement as HTMLElement | null;
  try {
    textarea.select();
    return document.execCommand("copy");
  } catch (error) {
    console.error("execCommand copy failed:", error);
    return false;
  } finally {
    textarea.remove();
    previouslyFocused?.focus?.();
  }
}
