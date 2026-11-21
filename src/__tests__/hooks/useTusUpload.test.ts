/**
 * Tests for the useTusUpload hook (tus-js-client is replaced by a fake Upload class)
 */
import { renderHook, waitFor } from "@testing-library/react";
import { useTusUpload, type StartTusUploadOptions } from "@/hooks/useTusUpload";

interface FakeResponse {
  getStatus: () => number;
  getBody: () => string;
  getHeader: (name: string) => string | undefined;
}

// Variables referenced from a jest.mock factory must be prefixed with "mock"
const mockTus: {
  supported: boolean;
  instances: Array<{
    file: unknown;
    options: Record<string, (...args: unknown[]) => unknown> & Record<string, unknown>;
    findPreviousUploads: jest.Mock;
    resumeFromPreviousUpload: jest.Mock;
    start: jest.Mock;
    abort: jest.Mock;
  }>;
  findPreviousUploads: () => Promise<unknown[]>;
  abort: () => unknown;
} = {
  supported: true,
  instances: [],
  findPreviousUploads: () => Promise.resolve([]),
  abort: () => Promise.resolve(),
};

jest.mock("tus-js-client", () => ({
  get isSupported() {
    return mockTus.supported;
  },
  Upload: class FakeUpload {
    file: unknown;
    options: Record<string, never>;
    findPreviousUploads = jest.fn(() => mockTus.findPreviousUploads());
    resumeFromPreviousUpload = jest.fn();
    start = jest.fn();
    abort = jest.fn(() => mockTus.abort());

    constructor(file: unknown, options: Record<string, never>) {
      this.file = file;
      this.options = options;
      mockTus.instances.push(this as unknown as (typeof mockTus.instances)[number]);
    }
  },
}));

function makeResponse(
  overrides: Partial<FakeResponse> & { headers?: Record<string, string> } = {}
) {
  const { headers = {}, ...rest } = overrides;
  return {
    getStatus: () => 200,
    getBody: () => "",
    getHeader: (name: string) => headers[name],
    ...rest,
  } as FakeResponse;
}

function lastUpload() {
  return mockTus.instances[mockTus.instances.length - 1];
}

describe("useTusUpload", () => {
  let consoleErrorSpy: jest.SpyInstance;
  const file = new File(["hello"], "hello.txt", { type: "text/plain" });

  const baseOptions = (overrides: Partial<StartTusUploadOptions> = {}): StartTusUploadOptions => ({
    file,
    metadata: { filename: "hello.txt", filetype: "text/plain" },
    translateErrorCode: (code) => `translated:${code}`,
    networkErrorMessage: "Network error",
    ...overrides,
  });

  /** Starts an upload and waits until the fake Upload was started (lazy import + previous uploads lookup). */
  async function begin(
    startUpload: (options: StartTusUploadOptions) => Promise<void>,
    overrides: Partial<StartTusUploadOptions> = {}
  ) {
    const promise = startUpload(baseOptions(overrides));
    await waitFor(() => expect(lastUpload()?.start).toHaveBeenCalled());
    return { promise, upload: lastUpload() };
  }

  beforeEach(() => {
    mockTus.supported = true;
    mockTus.instances = [];
    mockTus.findPreviousUploads = () => Promise.resolve([]);
    mockTus.abort = () => Promise.resolve();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("creates the tus upload with the endpoint, metadata and retry delays", async () => {
    const { result } = renderHook(() => useTusUpload());
    const metadata = { filename: "hello.txt", filetype: "text/plain", slug: "my-slug" };

    const { upload } = await begin(result.current.startUpload, { metadata });

    expect(upload.file).toBe(file);
    expect(upload.options.endpoint).toBe("/api/tus");
    expect(upload.options.metadata).toEqual(metadata);
    expect(upload.options.retryDelays).toEqual([0, 1000, 3000, 5000, 10000]);
    expect(upload.options.removeFingerprintOnSuccess).toBe(true);
  });

  it("reports the network error and resolves when the browser does not support tus", async () => {
    mockTus.supported = false;
    const onError = jest.fn();
    const { result } = renderHook(() => useTusUpload());

    await expect(result.current.startUpload(baseOptions({ onError }))).resolves.toBeUndefined();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith("Network error");
    expect(mockTus.instances).toHaveLength(0);
  });

  it("forwards progress events", async () => {
    const onProgress = jest.fn();
    const { result } = renderHook(() => useTusUpload());
    const { upload } = await begin(result.current.startUpload, { onProgress });

    upload.options.onProgress(250, 1000);
    upload.options.onProgress(1000, 1000);

    expect(onProgress).toHaveBeenNthCalledWith(1, 250, 1000);
    expect(onProgress).toHaveBeenNthCalledWith(2, 1000, 1000);
  });

  it("does not throw when no callback is provided", async () => {
    const { result } = renderHook(() => useTusUpload());
    const { promise, upload } = await begin(result.current.startUpload);

    expect(() => {
      upload.options.onProgress(1, 2);
      upload.options.onAfterResponse({}, makeResponse());
      upload.options.onSuccess();
    }).not.toThrow();
    await expect(promise).resolves.toBeUndefined();
  });

  describe("onAfterResponse", () => {
    it("maps the share headers", async () => {
      const onAfterResponse = jest.fn();
      const { result } = renderHook(() => useTusUpload());
      const { upload } = await begin(result.current.startUpload, { onAfterResponse });

      upload.options.onAfterResponse(
        {},
        makeResponse({
          headers: { "X-Share-Slug": "abc123", "X-Share-Id": "id-1", "X-Is-Bulk": "true" },
        })
      );

      expect(onAfterResponse).toHaveBeenCalledWith({
        shareSlug: "abc123",
        shareId: "id-1",
        isBulk: "true",
      });
    });

    it("falls back to null for missing or empty headers", async () => {
      const onAfterResponse = jest.fn();
      const { result } = renderHook(() => useTusUpload());
      const { upload } = await begin(result.current.startUpload, { onAfterResponse });

      upload.options.onAfterResponse({}, makeResponse({ headers: { "X-Share-Id": "" } }));

      expect(onAfterResponse).toHaveBeenCalledWith({
        shareSlug: null,
        shareId: null,
        isBulk: null,
      });
    });
  });

  it("calls onSuccess and resolves the promise on success", async () => {
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const { result } = renderHook(() => useTusUpload());
    const { promise, upload } = await begin(result.current.startUpload, { onSuccess, onError });

    upload.options.onSuccess();

    await expect(promise).resolves.toBeUndefined();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  describe("onError", () => {
    const failWith = async (
      error: unknown,
      overrides: Partial<StartTusUploadOptions> = {}
    ): Promise<jest.Mock> => {
      const onError = jest.fn();
      const { result } = renderHook(() => useTusUpload());
      const { promise, upload } = await begin(result.current.startUpload, {
        onError,
        ...overrides,
      });

      upload.options.onError(error);

      await expect(promise).resolves.toBeUndefined();
      return onError;
    };

    it("translates the error code of a JSON body", async () => {
      const onError = await failWith({
        originalResponse: makeResponse({
          getBody: () => JSON.stringify({ error: "SLUG_ALREADY_TAKEN" }),
        }),
      });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith("translated:SLUG_ALREADY_TAKEN");
    });

    it("uses the raw body when it is not JSON", async () => {
      const onError = await failWith({
        originalResponse: makeResponse({ getBody: () => "Bad gateway" }),
      });

      expect(onError).toHaveBeenCalledWith("Bad gateway");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "useTusUpload: error parsing tus error body:",
        expect.anything()
      );
    });

    it("falls back to the network error message when the JSON body has no error code", async () => {
      const onError = await failWith({
        originalResponse: makeResponse({ getBody: () => JSON.stringify({ message: "nope" }) }),
      });

      expect(onError).toHaveBeenCalledWith("Network error");
    });

    it("falls back to the network error message when there is no body", async () => {
      const onError = await failWith({
        originalResponse: makeResponse({ getBody: () => "" }),
      });

      expect(onError).toHaveBeenCalledWith("Network error");
    });

    it("falls back to the network error message when there is no response at all", async () => {
      const onError = await failWith(new Error("connection lost"));

      expect(onError).toHaveBeenCalledWith("Network error");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "useTusUpload: tus upload error:",
        expect.any(Error)
      );
    });

    it("tolerates a missing onError callback", async () => {
      const { result } = renderHook(() => useTusUpload());
      const { promise, upload } = await begin(result.current.startUpload);

      upload.options.onError(new Error("boom"));

      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe("onShouldRetry", () => {
    const shouldRetry = async (error: unknown) => {
      const { result } = renderHook(() => useTusUpload());
      const { upload } = await begin(result.current.startUpload);
      return upload.options.onShouldRetry(error);
    };
    const withStatus = (status: number) => ({
      originalResponse: makeResponse({ getStatus: () => status }),
    });

    it.each([400, 401, 403, 404, 413, 429, 499])("does not retry on %i", async (status) => {
      expect(await shouldRetry(withStatus(status))).toBe(false);
    });

    it("does not retry on 409 (slug conflict)", async () => {
      expect(await shouldRetry(withStatus(409))).toBe(false);
    });

    it.each([500, 502, 503, 504])("retries on %i", async (status) => {
      expect(await shouldRetry(withStatus(status))).toBe(true);
    });

    it("retries on network errors without a response", async () => {
      expect(await shouldRetry(new Error("network"))).toBe(true);
      expect(await shouldRetry({ originalResponse: null })).toBe(true);
      expect(await shouldRetry(undefined)).toBe(true);
    });

    it("retries when the response has no usable status (0)", async () => {
      expect(await shouldRetry(withStatus(0))).toBe(true);
    });
  });

  describe("resuming", () => {
    it("resumes from the first previous upload when there is one", async () => {
      const previous = [{ urlStorageKey: "first" }, { urlStorageKey: "second" }];
      mockTus.findPreviousUploads = () => Promise.resolve(previous);
      const { result } = renderHook(() => useTusUpload());

      const { upload } = await begin(result.current.startUpload);

      expect(upload.resumeFromPreviousUpload).toHaveBeenCalledTimes(1);
      expect(upload.resumeFromPreviousUpload).toHaveBeenCalledWith(previous[0]);
      expect(upload.start).toHaveBeenCalledTimes(1);
    });

    it("starts a fresh upload when there is no previous upload", async () => {
      const { result } = renderHook(() => useTusUpload());

      const { upload } = await begin(result.current.startUpload);

      expect(upload.resumeFromPreviousUpload).not.toHaveBeenCalled();
      expect(upload.start).toHaveBeenCalledTimes(1);
    });

    it("still starts the upload when looking up previous uploads fails", async () => {
      mockTus.findPreviousUploads = () => Promise.reject(new Error("storage unavailable"));
      const { result } = renderHook(() => useTusUpload());

      const { upload } = await begin(result.current.startUpload);

      expect(upload.resumeFromPreviousUpload).not.toHaveBeenCalled();
      expect(upload.start).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "useTusUpload: error finding previous uploads:",
        expect.any(Error)
      );
    });
  });

  describe("unmount", () => {
    it("aborts the active uploads", async () => {
      const { result, unmount } = renderHook(() => useTusUpload());
      const first = (await begin(result.current.startUpload)).upload;
      const second = (await begin(result.current.startUpload)).upload;

      unmount();

      expect(first.abort).toHaveBeenCalledTimes(1);
      expect(second.abort).toHaveBeenCalledTimes(1);
    });

    it("does not abort uploads that already succeeded or failed", async () => {
      const { result, unmount } = renderHook(() => useTusUpload());
      const done = (await begin(result.current.startUpload)).upload;
      const failed = (await begin(result.current.startUpload, { onError: jest.fn() })).upload;
      const running = (await begin(result.current.startUpload)).upload;

      done.options.onSuccess();
      failed.options.onError(new Error("boom"));
      unmount();

      expect(done.abort).not.toHaveBeenCalled();
      expect(failed.abort).not.toHaveBeenCalled();
      expect(running.abort).toHaveBeenCalledTimes(1);
    });

    it("does not start an upload when unmounted before the lazy import resolves", async () => {
      const { result, unmount } = renderHook(() => useTusUpload());

      const promise = result.current.startUpload(baseOptions({ onSuccess: jest.fn() }));
      unmount();

      await expect(promise).resolves.toBeUndefined();
      expect(mockTus.instances).toHaveLength(0);
    });

    it("does not start an upload when unmounted while looking for previous uploads", async () => {
      let finishLookup: (previous: unknown[]) => void = () => {};
      mockTus.findPreviousUploads = () => new Promise((resolve) => (finishLookup = resolve));
      const onSuccess = jest.fn();
      const { result, unmount } = renderHook(() => useTusUpload());

      const promise = result.current.startUpload(baseOptions({ onSuccess }));
      await waitFor(() => expect(mockTus.instances).toHaveLength(1));
      unmount();
      finishLookup([{ uploadUrl: "/api/tus/old" }]);

      await expect(promise).resolves.toBeUndefined();
      expect(lastUpload().start).not.toHaveBeenCalled();
      expect(lastUpload().resumeFromPreviousUpload).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("does not start an upload when the previous uploads lookup fails after unmount", async () => {
      let failLookup: (reason: Error) => void = () => {};
      mockTus.findPreviousUploads = () => new Promise((_resolve, reject) => (failLookup = reject));
      const { result, unmount } = renderHook(() => useTusUpload());

      const promise = result.current.startUpload(baseOptions());
      await waitFor(() => expect(mockTus.instances).toHaveLength(1));
      unmount();
      failLookup(new Error("storage unavailable"));

      await expect(promise).resolves.toBeUndefined();
      expect(lastUpload().start).not.toHaveBeenCalled();
    });

    it("does not abort anything twice", async () => {
      const { result, unmount } = renderHook(() => useTusUpload());
      const { upload } = await begin(result.current.startUpload);

      unmount();

      expect(upload.abort).toHaveBeenCalledTimes(1);
    });

    it("logs and keeps going when abort() throws synchronously", async () => {
      const error = new Error("sync failure");
      mockTus.abort = () => {
        throw error;
      };
      const { result, unmount } = renderHook(() => useTusUpload());
      const first = (await begin(result.current.startUpload)).upload;
      const second = (await begin(result.current.startUpload)).upload;

      expect(() => unmount()).not.toThrow();

      expect(first.abort).toHaveBeenCalledTimes(1);
      expect(second.abort).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "useTusUpload: error aborting upload on unmount:",
        error
      );
    });

    it("logs when abort() returns a rejected promise, without an unhandled rejection", async () => {
      const error = new Error("async failure");
      mockTus.abort = () => Promise.reject(error);
      const unhandled = jest.fn();
      process.on("unhandledRejection", unhandled);
      try {
        const { result, unmount } = renderHook(() => useTusUpload());
        await begin(result.current.startUpload);

        expect(() => unmount()).not.toThrow();
        // Let the rejection (and any unhandled rejection report) settle
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "useTusUpload: error aborting upload on unmount:",
          error
        );
        expect(unhandled).not.toHaveBeenCalled();
      } finally {
        process.off("unhandledRejection", unhandled);
      }
    });
  });
});
