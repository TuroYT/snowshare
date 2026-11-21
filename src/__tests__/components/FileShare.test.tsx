/**
 * Tests for the FileShare form. The tus upload hook is mocked at the hook boundary, so these
 * tests drive the form through the callbacks the real hook would fire.
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FileShare from "@/components/FileShare";
import type { StartTusUploadOptions } from "@/hooks/useTusUpload";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, def?: unknown, opts?: Record<string, unknown>) => {
      if (typeof def !== "string") return key;
      return def.replace(/{{(\w+)}}/g, (_m, name) => String(opts?.[name] ?? ""));
    },
    i18n: { language: "en", exists: () => false },
  }),
}));

const mockUseAuth = jest.fn();
jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseShareSettings = jest.fn();
jest.mock("@/hooks/useShareSettings", () => ({
  useShareSettings: () => mockUseShareSettings(),
}));

const mockStartUpload = jest.fn();
jest.mock("@/hooks/useTusUpload", () => ({
  useTusUpload: () => ({ startUpload: mockStartUpload }),
}));

// ShareSuccess dependencies
jest.mock("@/hooks/useFetch", () => ({
  useFetch: () => ({ data: null, loading: false, error: null }),
}));
jest.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
}));
jest.mock("next/dynamic", () => () => {
  const react = jest.requireActual("react");
  return function QRCodeStub() {
    return react.createElement("svg", { "data-testid": "qr-code" });
  };
});

const MIB = 1024 * 1024;

const makeFile = (name: string, content = "hello", type = "text/plain") =>
  new File([content], name, { type, lastModified: 1000 });

/** A file reporting `size` bytes without allocating them. */
const makeSizedFile = (name: string, size: number) => {
  const file = makeFile(name);
  Object.defineProperty(file, "size", { value: size });
  return file;
};

type StartCall = StartTusUploadOptions;
const startCall = (index: number): StartCall => mockStartUpload.mock.calls[index][0];

/** Simulates a successful server side upload of one file. */
const succeedWith = (headers: { shareSlug: string | null; shareId?: string | null }) =>
  mockStartUpload.mockImplementation(async (options: StartCall) => {
    options.onAfterResponse?.({
      shareSlug: headers.shareSlug,
      shareId: headers.shareId ?? null,
      isBulk: null,
    });
    options.onSuccess?.();
  });

describe("FileShare", () => {
  let user: ReturnType<typeof userEvent.setup>;
  let consoleErrorSpy: jest.SpyInstance;

  const renderForm = (props: React.ComponentProps<typeof FileShare> = {}) => {
    const utils = render(<FileShare {...props} />);
    const fileInput = utils.container.querySelector<HTMLInputElement>(
      'input[type="file"]'
    ) as HTMLInputElement;
    return { ...utils, fileInput };
  };

  const submitButton = () => screen.getByRole("button", { name: /Share file|Creating/ });
  const selectFiles = (input: HTMLInputElement, files: File | File[]) => user.upload(input, files);

  beforeEach(() => {
    // user-event does not understand accept="*/*" and would filter every file out
    user = userEvent.setup({ applyAccept: false });
    mockStartUpload.mockReset();
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
    mockUseShareSettings.mockReturnValue({
      allowAnonFileShare: true,
      allowAnonLinkShare: true,
      allowAnonPasteShare: true,
      anoMaxUploadBytes: 10 * MIB,
      authMaxUploadBytes: 100 * MIB,
      defaultExpirationDays: 7,
      useGiBForAnon: false,
      useGiBForAuth: false,
      loading: false,
    });
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("form state", () => {
    it("disables the submit button until a file is selected", async () => {
      const { fileInput } = renderForm();
      expect(submitButton()).toBeDisabled();

      await selectFiles(fileInput, makeFile("a.txt"));

      expect(submitButton()).toBeEnabled();
    });

    it("never starts an upload without files", () => {
      renderForm();

      fireEvent.submit(document.querySelector("form") as HTMLFormElement);

      expect(mockStartUpload).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent("At least one file is required");
    });

    it("shows the locked state to anonymous users when anonymous file sharing is disabled", () => {
      mockUseShareSettings.mockReturnValue({
        ...mockUseShareSettings(),
        allowAnonFileShare: false,
      });

      renderForm();

      expect(screen.getByText("File sharing is locked")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Share file" })).not.toBeInTheDocument();
    });

    it("loads files provided by the parent (clipboard paste) and reports them as consumed", () => {
      const onInitialFilesConsumed = jest.fn();

      renderForm({ initialFiles: [makeFile("pasted.png")], onInitialFilesConsumed });

      expect(screen.getByText("pasted.png")).toBeInTheDocument();
      expect(submitButton()).toBeEnabled();
      expect(onInitialFilesConsumed).toHaveBeenCalledTimes(1);
    });
  });

  describe("single file upload", () => {
    it("starts the upload with the file metadata and the default options", async () => {
      const { fileInput } = renderForm();
      const file = makeFile("report.pdf", "pdf-content", "application/pdf");
      mockStartUpload.mockReturnValue(new Promise(() => {}));

      await selectFiles(fileInput, file);
      await user.click(submitButton());

      expect(mockStartUpload).toHaveBeenCalledTimes(1);
      const call = startCall(0);
      expect(call.file).toBe(file);
      expect(call.metadata).toEqual({
        expiresAt: expect.any(String),
        filename: "report.pdf",
        filetype: "application/pdf",
        isBulk: "false",
      });
      expect(call.metadata).not.toHaveProperty("relativePath");
      expect(call.metadata).not.toHaveProperty("bulkShareId");
      expect(call.networkErrorMessage).toBe("Network error — could not create share");
    });

    it("falls back to application/octet-stream when the file has no type", async () => {
      const { fileInput } = renderForm();
      mockStartUpload.mockReturnValue(new Promise(() => {}));

      await selectFiles(fileInput, makeFile("data.bin", "x", ""));
      await user.click(submitButton());

      expect(startCall(0).metadata.filetype).toBe("application/octet-stream");
    });

    it("sends the chosen slug, password, expiry, view limit and note", async () => {
      const { fileInput } = renderForm();
      mockStartUpload.mockReturnValue(new Promise(() => {}));

      await selectFiles(fileInput, makeFile("a.txt"));
      await user.type(screen.getByLabelText("Password protection"), "  s3cret-pass ");
      await user.type(screen.getByLabelText("Custom link"), "my-slug");
      await user.type(screen.getByLabelText("Note"), "  hello note  ");
      const days = screen.getByLabelText("Expires after");
      await user.clear(days);
      await user.type(days, "3");
      await user.click(screen.getByRole("switch", { name: "Limit number of views" }));
      const views = screen.getByRole("spinbutton", { name: "Limit number of views" });
      fireEvent.change(views, { target: { value: "5" } });
      const before = Date.now();
      await user.click(submitButton());

      const { metadata } = startCall(0);
      expect(metadata).toMatchObject({
        slug: "my-slug",
        password: "s3cret-pass",
        note: "hello note",
        maxViews: "5",
        filename: "a.txt",
        isBulk: "false",
      });
      const expiresInDays = (new Date(metadata.expiresAt).getTime() - before) / 86_400_000;
      expect(expiresInDays).toBeGreaterThan(2.99);
      expect(expiresInDays).toBeLessThan(3.01);
    });

    it("omits the optional metadata that was left empty", async () => {
      const { fileInput } = renderForm();
      mockStartUpload.mockReturnValue(new Promise(() => {}));

      await selectFiles(fileInput, makeFile("a.txt"));
      await user.type(screen.getByLabelText("Note"), "   ");
      await user.click(submitButton());

      const { metadata } = startCall(0);
      expect(metadata).not.toHaveProperty("slug");
      expect(metadata).not.toHaveProperty("password");
      expect(metadata).not.toHaveProperty("note");
      expect(metadata).not.toHaveProperty("maxViews");
    });

    it("shows the share link built from the X-Share-Slug header on success", async () => {
      const { fileInput } = renderForm();
      succeedWith({ shareSlug: "abc123", shareId: "share-1" });

      await selectFiles(fileInput, makeFile("a.txt"));
      await user.click(submitButton());

      const link = await screen.findByRole("link", { name: `${window.location.origin}/f/abc123` });
      expect(link).toHaveAttribute("href", `${window.location.origin}/f/abc123`);
      expect(screen.getByText("Share created successfully!")).toBeInTheDocument();
      // The form is reset: file list emptied, drop area back, button disabled again
      expect(screen.queryByText("a.txt")).not.toBeInTheDocument();
      expect(screen.getByText("Drag & drop files or folders here")).toBeInTheDocument();
      expect(submitButton()).toBeDisabled();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("resets the options after a successful upload", async () => {
      const { fileInput } = renderForm();
      succeedWith({ shareSlug: "abc123" });

      await selectFiles(fileInput, makeFile("a.txt"));
      await user.type(screen.getByLabelText("Custom link"), "my-slug");
      await user.type(screen.getByLabelText("Password protection"), "s3cret-pass");
      await user.click(submitButton());
      await screen.findByText("Share created successfully!");

      expect(screen.getByLabelText("Custom link")).toHaveValue("");
      expect(screen.getByLabelText("Password protection")).toHaveValue("");
    });

    it("reports a network error when the upload succeeds without a share slug", async () => {
      const { fileInput } = renderForm();
      succeedWith({ shareSlug: null });

      await selectFiles(fileInput, makeFile("a.txt"));
      await user.click(submitButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Network error — could not create share"
      );
      expect(screen.queryByText("Share created successfully!")).not.toBeInTheDocument();
      expect(screen.getByText("a.txt")).toBeInTheDocument();
    });

    it("shows the translated error and keeps the form values when the upload fails", async () => {
      const { fileInput } = renderForm();
      mockStartUpload.mockImplementation(async (options: StartCall) => {
        options.onError?.(options.translateErrorCode("SLUG_ALREADY_TAKEN"));
      });

      await selectFiles(fileInput, makeFile("a.txt"));
      await user.type(screen.getByLabelText("Custom link"), "taken-slug");
      await user.type(screen.getByLabelText("Password protection"), "s3cret-pass");
      await user.type(screen.getByLabelText("Note"), "keep me");
      await user.click(submitButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "This custom URL is already taken. Please choose another one."
      );
      expect(screen.getByLabelText("Custom link")).toHaveValue("taken-slug");
      expect(screen.getByLabelText("Password protection")).toHaveValue("s3cret-pass");
      expect(screen.getByLabelText("Note")).toHaveValue("keep me");
      expect(screen.getByText("a.txt")).toBeInTheDocument();
      expect(submitButton()).toBeEnabled();
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("maps known server error codes and passes unknown ones through", async () => {
      const { fileInput } = renderForm();
      let translate: StartCall["translateErrorCode"] | undefined;
      mockStartUpload.mockImplementation(async (options: StartCall) => {
        translate = options.translateErrorCode;
      });

      await selectFiles(fileInput, makeFile("a.txt"));
      await user.click(submitButton());

      expect(translate?.("IP_QUOTA_EXCEEDED")).toBe("IP quota exceeded.");
      expect(translate?.("FILE_TOO_LARGE")).toBe("File size exceeds the allowed limit.");
      expect(translate?.("SOMETHING_ELSE")).toBe("SOMETHING_ELSE");
    });

    it("clears a previous error when files are added again", async () => {
      const { fileInput } = renderForm();
      mockStartUpload.mockImplementation(async (options: StartCall) => {
        options.onError?.("Upload failed");
      });
      await selectFiles(fileInput, makeFile("a.txt"));
      await user.click(submitButton());
      expect(await screen.findByRole("alert")).toBeInTheDocument();

      await selectFiles(fileInput, makeFile("b.txt"));

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("catches exceptions thrown by startUpload and shows their message", async () => {
      const { fileInput } = renderForm();
      mockStartUpload.mockRejectedValue(new Error("chunk loading failed"));

      await selectFiles(fileInput, makeFile("a.txt"));
      await user.click(submitButton());

      expect(await screen.findByRole("alert")).toHaveTextContent("chunk loading failed");
      expect(consoleErrorSpy).toHaveBeenCalledWith("FileShare error:", expect.any(Error));
      expect(submitButton()).toBeEnabled();
    });
  });

  describe("progress and concurrency", () => {
    it("feeds progress events to the progress bar", async () => {
      const { fileInput } = renderForm();
      mockStartUpload.mockReturnValue(new Promise(() => {}));
      await selectFiles(fileInput, makeFile("a.txt"));
      await user.click(submitButton());

      const bar = screen.getByRole("progressbar");
      expect(bar).toHaveAttribute("aria-valuenow", "0");

      act(() => startCall(0).onProgress?.(25, 100));
      expect(bar).toHaveAttribute("aria-valuenow", "25");
      expect(screen.getByText("Progress: 25%")).toBeInTheDocument();

      act(() => startCall(0).onProgress?.(100, 100));
      expect(bar).toHaveAttribute("aria-valuenow", "100");
    });

    it("falls back to the file size when tus reports no total", async () => {
      const { fileInput } = renderForm();
      mockStartUpload.mockReturnValue(new Promise(() => {}));
      await selectFiles(fileInput, makeFile("a.txt", "12345678"));
      await user.click(submitButton());

      act(() => startCall(0).onProgress?.(4, 0));

      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    });

    it("shows the busy state while uploading", async () => {
      const { fileInput } = renderForm();
      mockStartUpload.mockReturnValue(new Promise(() => {}));
      await selectFiles(fileInput, makeFile("a.txt"));

      await user.click(submitButton());

      expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled();
      expect(screen.getByRole("progressbar", { name: "Uploading..." })).toBeInTheDocument();
    });

    it("ignores a second submit while an upload is running", async () => {
      const { fileInput } = renderForm();
      mockStartUpload.mockReturnValue(new Promise(() => {}));
      await selectFiles(fileInput, makeFile("a.txt"));
      const form = document.querySelector("form") as HTMLFormElement;

      await user.click(submitButton());
      fireEvent.submit(form);
      fireEvent.submit(form);

      expect(mockStartUpload).toHaveBeenCalledTimes(1);
    });

    it("ignores the Ctrl+Enter shortcut while an upload is running", async () => {
      const { fileInput } = renderForm();
      mockStartUpload.mockReturnValue(new Promise(() => {}));
      await selectFiles(fileInput, makeFile("a.txt"));
      await user.click(submitButton());

      await user.keyboard("{Control>}{Enter}{/Control}");

      expect(mockStartUpload).toHaveBeenCalledTimes(1);
    });
  });

  describe("size limits", () => {
    it("rejects a file over the anonymous limit without starting the upload", async () => {
      const { fileInput } = renderForm();

      await selectFiles(fileInput, makeSizedFile("huge.bin", 10 * MIB + 1));
      await user.click(submitButton());

      expect(mockStartUpload).not.toHaveBeenCalled();
      expect(await screen.findByRole("alert")).toHaveTextContent("File is too large (max 10 MiB)");
      expect(submitButton()).toBeEnabled();
      expect(screen.getByText("huge.bin")).toBeInTheDocument();
    });

    it("rejects several files whose total is over the limit", async () => {
      const { fileInput } = renderForm();

      await selectFiles(fileInput, [
        makeSizedFile("a.bin", 6 * MIB),
        makeSizedFile("b.bin", 6 * MIB),
      ]);
      await user.click(submitButton());

      expect(mockStartUpload).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent("Total size exceeds limit (max 10 MiB)");
    });

    it("uses the higher limit of authenticated users", async () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
      const { fileInput } = renderForm();
      succeedWith({ shareSlug: "big" });

      await selectFiles(fileInput, makeSizedFile("big.bin", 50 * MIB));
      await user.click(submitButton());

      expect(mockStartUpload).toHaveBeenCalledTimes(1);
      expect(await screen.findByRole("link")).toHaveAttribute(
        "href",
        `${window.location.origin}/f/big`
      );
    });

    it("rejects files over the authenticated limit", async () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
      const { fileInput } = renderForm();

      await selectFiles(fileInput, makeSizedFile("huge.bin", 100 * MIB + 1));
      await user.click(submitButton());

      expect(mockStartUpload).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent("File is too large (max 100 MiB)");
    });
  });

  describe("several files (bulk share)", () => {
    it("uploads the files one after the other, chaining the share id", async () => {
      const { fileInput } = renderForm();
      let runningUploads = 0;
      let maxConcurrent = 0;
      mockStartUpload.mockImplementation(async (options: StartCall) => {
        runningUploads++;
        maxConcurrent = Math.max(maxConcurrent, runningUploads);
        await Promise.resolve();
        options.onAfterResponse?.({ shareSlug: "bulk-slug", shareId: "bulk-id", isBulk: "true" });
        options.onSuccess?.();
        runningUploads--;
      });

      await selectFiles(fileInput, [makeFile("a.txt"), makeFile("b.txt")]);
      await user.type(screen.getByLabelText("Custom link"), "my-bulk");
      await user.click(submitButton());

      await screen.findByText("Share created successfully!");
      expect(mockStartUpload).toHaveBeenCalledTimes(2);
      expect(maxConcurrent).toBe(1);

      const first = startCall(0).metadata;
      expect(first).toMatchObject({
        filename: "a.txt",
        relativePath: "a.txt",
        isBulk: "true",
        fileIndex: "0",
        totalFiles: "2",
        slug: "my-bulk",
      });
      expect(first).not.toHaveProperty("bulkShareId");

      const second = startCall(1).metadata;
      expect(second).toMatchObject({
        filename: "b.txt",
        relativePath: "b.txt",
        isBulk: "true",
        fileIndex: "1",
        totalFiles: "2",
        bulkShareId: "bulk-id",
        slug: "my-bulk",
      });

      expect(screen.getByRole("link")).toHaveAttribute(
        "href",
        `${window.location.origin}/f/bulk-slug`
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("sends folder files with their relative path", async () => {
      const { fileInput } = renderForm();
      const dirInput = document.querySelectorAll<HTMLInputElement>('input[type="file"]')[1];
      succeedWith({ shareSlug: "folder", shareId: "folder-id" });
      const one = makeFile("one.txt");
      const two = makeFile("two.txt");
      Object.defineProperty(one, "webkitRelativePath", { value: "photos/one.txt" });
      Object.defineProperty(two, "webkitRelativePath", { value: "photos/deep/two.txt" });
      expect(fileInput).not.toBe(dirInput);

      fireEvent.change(dirInput, { target: { files: [one, two] } });
      await user.click(submitButton());

      await screen.findByText("Share created successfully!");
      expect(startCall(0).metadata.relativePath).toBe("photos/one.txt");
      expect(startCall(1).metadata.relativePath).toBe("photos/deep/two.txt");
    });

    it("reports overall progress across the files", async () => {
      const { fileInput } = renderForm();
      const pending: Array<() => void> = [];
      mockStartUpload.mockImplementation(
        (options: StartCall) =>
          new Promise<void>((resolve) => {
            pending.push(() => {
              options.onAfterResponse?.({ shareSlug: "s", shareId: "id", isBulk: "true" });
              options.onSuccess?.();
              resolve();
            });
          })
      );

      // 4 bytes + 6 bytes
      await selectFiles(fileInput, [makeFile("a.txt", "aaaa"), makeFile("b.txt", "bbbbbb")]);
      await user.click(submitButton());

      const bar = screen.getByRole("progressbar");
      act(() => startCall(0).onProgress?.(2, 4));
      expect(bar).toHaveAttribute("aria-valuenow", "20");

      await act(async () => pending[0]());
      await waitFor(() => expect(mockStartUpload).toHaveBeenCalledTimes(2));

      act(() => startCall(1).onProgress?.(3, 6));
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "70");

      act(() => startCall(1).onProgress?.(6, 6));
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");

      await act(async () => pending[1]());
      expect(await screen.findByText("Share created successfully!")).toBeInTheDocument();
    });

    it("stops at the first file that fails and numbers it in the error", async () => {
      const { fileInput } = renderForm();
      mockStartUpload.mockImplementation(async (options: StartCall) => {
        options.onError?.("boom");
      });

      await selectFiles(fileInput, [makeFile("a.txt"), makeFile("b.txt")]);
      await user.click(submitButton());

      expect(await screen.findByRole("alert")).toHaveTextContent("File 1: boom");
      expect(mockStartUpload).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("Share created successfully!")).not.toBeInTheDocument();
      expect(screen.getByText("Selected Files (2)")).toBeInTheDocument();
      expect(submitButton()).toBeEnabled();
    });

    it("keeps the share link and leaves only the remaining files when a later file fails", async () => {
      const { fileInput } = renderForm();
      mockStartUpload.mockImplementation(async (options: StartCall) => {
        if (options.metadata.fileIndex === "0") {
          options.onAfterResponse?.({ shareSlug: "partial", shareId: "p-id", isBulk: "true" });
          options.onSuccess?.();
          return;
        }
        options.onError?.("boom");
      });

      await selectFiles(fileInput, [makeFile("a.txt"), makeFile("b.txt")]);
      await user.click(submitButton());

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("File 2: boom");
      expect(alert).toHaveTextContent(
        "1 of 2 files were added to the share link. Retry to send the remaining files."
      );
      expect(screen.getByRole("link")).toHaveAttribute(
        "href",
        `${window.location.origin}/f/partial`
      );
      // Only the file that was not sent stays selected
      expect(screen.getByText("Selected Files (1)")).toBeInTheDocument();
      const list = screen.getByText("Selected Files (1)").closest("div")?.parentElement;
      expect(within(list as HTMLElement).getByText("b.txt")).toBeInTheDocument();
      expect(within(list as HTMLElement).queryByText("a.txt")).not.toBeInTheDocument();
    });

    it("reports a numbered network error when a file succeeds without share headers", async () => {
      const { fileInput } = renderForm();
      mockStartUpload.mockImplementation(async (options: StartCall) => {
        options.onSuccess?.();
      });

      await selectFiles(fileInput, [makeFile("a.txt"), makeFile("b.txt")]);
      await user.click(submitButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "File 1: Network error — could not create share"
      );
      expect(mockStartUpload).toHaveBeenCalledTimes(1);
    });
  });
});
