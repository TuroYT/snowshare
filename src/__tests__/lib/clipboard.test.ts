import { copyText } from "@/lib/clipboard";

describe("copyText", () => {
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

  afterEach(() => {
    if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
    else Reflect.deleteProperty(navigator, "clipboard");
    jest.restoreAllMocks();
  });

  it("uses the Clipboard API when available", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    await expect(copyText("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to execCommand when the Clipboard API is missing (plain HTTP)", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    const execCommand = jest.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });

    await expect(copyText("hello")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("reports failure when the Clipboard API rejects and the fallback fails too", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const writeText = jest.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    Object.defineProperty(document, "execCommand", {
      value: jest.fn().mockReturnValue(false),
      configurable: true,
    });

    await expect(copyText("hello")).resolves.toBe(false);
  });
});
