/**
 * Tests for useFetch (request deduplication and unmount handling)
 */

import { renderHook, waitFor } from "@testing-library/react";
import { useFetch } from "@/hooks/useFetch";

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response);
}

describe("useFetch", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("loads data", async () => {
    global.fetch = jest.fn(() => mockJsonResponse({ value: 1 }));

    const { result } = renderHook(() => useFetch<{ value: number }>("/api/a"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ value: 1 });
    expect(result.current.error).toBeNull();
  });

  it("shares one request between concurrent consumers", async () => {
    global.fetch = jest.fn(() => mockJsonResponse({ value: 2 }));

    const first = renderHook(() => useFetch<{ value: number }>("/api/shared"));
    const second = renderHook(() => useFetch<{ value: number }>("/api/shared"));

    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(first.result.current.data).toEqual({ value: 2 });
    expect(second.result.current.data).toEqual({ value: 2 });
  });

  it("still delivers data to other consumers when one unmounts mid-request", async () => {
    let resolve: (value: Response) => void = () => {};
    global.fetch = jest.fn(
      () => new Promise<Response>((r) => (resolve = r))
    ) as unknown as typeof fetch;

    const leaving = renderHook(() => useFetch<{ value: number }>("/api/slow"));
    const staying = renderHook(() => useFetch<{ value: number }>("/api/slow"));
    leaving.unmount();

    resolve({ ok: true, status: 200, json: () => Promise.resolve({ value: 3 }) } as Response);

    await waitFor(() => expect(staying.result.current.loading).toBe(false));
    expect(staying.result.current.data).toEqual({ value: 3 });
  });

  it("reports HTTP errors with the custom message", async () => {
    global.fetch = jest.fn(() => mockJsonResponse({}, false, 500));

    const { result } = renderHook(() =>
      useFetch("/api/broken", { errorMessage: "Could not load" })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Could not load");
    expect(result.current.data).toBeNull();
  });
});
