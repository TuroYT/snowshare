/**
 * Tests for the UploadProgress component
 */
import React, { createRef } from "react";
import { act, render, screen } from "@testing-library/react";
import UploadProgress, {
  type UploadProgressHandle,
} from "@/components/shareComponents/UploadProgress";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, def?: unknown, opts?: Record<string, unknown>) => {
      if (typeof def !== "string") return key;
      return def.replace(/{{(\w+)}}/g, (_m, name) => String(opts?.[name] ?? ""));
    },
    i18n: { language: "en" },
  }),
}));

describe("UploadProgress", () => {
  const renderProgress = () => {
    const ref = createRef<UploadProgressHandle>();
    render(<UploadProgress ref={ref} />);
    const bar = screen.getByRole("progressbar");
    return { ref, bar, fill: bar.firstElementChild as HTMLElement };
  };

  it("exposes a progressbar with an accessible name and 0-100 bounds", () => {
    const { bar } = renderProgress();

    expect(screen.getByRole("progressbar", { name: "Uploading..." })).toBe(bar);
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("starts at 0", () => {
    const { bar, fill } = renderProgress();

    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(fill).toHaveStyle({ width: "0%" });
    expect(screen.getByText("Progress: 0%")).toBeInTheDocument();
  });

  it("updates the text, aria-valuenow and bar width through the ref", () => {
    const { ref, bar, fill } = renderProgress();

    act(() => ref.current?.setProgress(42));

    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(fill).toHaveStyle({ width: "42%" });
    expect(screen.getByText("Progress: 42%")).toBeInTheDocument();

    act(() => ref.current?.setProgress(100));

    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(fill).toHaveStyle({ width: "100%" });
    expect(screen.getByText("Progress: 100%")).toBeInTheDocument();
  });

  it("keeps the same handle between renders", () => {
    const ref = createRef<UploadProgressHandle>();
    const { rerender } = render(<UploadProgress ref={ref} />);
    const handle = ref.current;

    rerender(<UploadProgress ref={ref} />);

    expect(ref.current).toBe(handle);
  });
});
