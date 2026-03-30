/**
 * Tests for Footer component
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import Footer from "@/components/Footer";

// Mock useTheme hook (Footer uses @/hooks/useTheme)
jest.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({
    primaryColor: "#3b82f6",
    branding: { appName: "SnowShare" },
  }),
}));

// Mock react-i18next
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key,
    i18n: { language: "en" },
  }),
}));

// Mock fetch to return no custom links by default
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ links: [] }),
  }) as jest.Mock;
});

describe("Footer", () => {
  it("renders the footer component", () => {
    render(<Footer />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("displays GitHub link when there are no custom links", () => {
    render(<Footer />);
    const githubLinks = screen.getAllByRole("link", { name: /github/i });
    expect(githubLinks.length).toBeGreaterThan(0);
    expect(githubLinks[0]).toHaveAttribute("href", "https://github.com/TuroYT/snowshare");
    expect(githubLinks[0]).toHaveAttribute("target", "_blank");
    expect(githubLinks[0]).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("displays the License link when there are no custom links", () => {
    render(<Footer />);
    const licenseLink = screen.getByRole("link", { name: /license/i });
    expect(licenseLink).toBeInTheDocument();
    expect(licenseLink).toHaveAttribute(
      "href",
      "https://github.com/TuroYT/snowshare/blob/main/LICENSE"
    );
  });

  it("displays the Terms of Use link", () => {
    render(<Footer />);
    const termsLink = screen.getByRole("link", { name: /terms of use/i });
    expect(termsLink).toBeInTheDocument();
    expect(termsLink).toHaveAttribute("href", "/terms-of-use");
  });

  it("displays copyright text with app name", () => {
    render(<Footer />);
    expect(screen.getByText(/© \d{4} SnowShare/i)).toBeInTheDocument();
  });

  it("displays all rights reserved text", () => {
    render(<Footer />);
    expect(screen.getByText(/Tous droits réservés/i)).toBeInTheDocument();
  });

  it("displays Powered by SnowShare", () => {
    render(<Footer />);
    expect(screen.getByText(/Powered by/i)).toBeInTheDocument();
  });
});
