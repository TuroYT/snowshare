/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { detectLocale, detectLocaleFromHeaders } from "@/lib/i18n-server";

describe("detectLocale", () => {
  it("prefers the lang query parameter", () => {
    const request = new NextRequest("http://localhost/api?lang=de", {
      headers: { cookie: "i18next=fr", "accept-language": "es" },
    });
    expect(detectLocale(request)).toBe("de");
  });

  it("then the locale cookie", () => {
    const request = new NextRequest("http://localhost/api", {
      headers: { cookie: "i18nextLng=nl", "accept-language": "es" },
    });
    expect(detectLocale(request)).toBe("nl");
  });

  it("then the highest-weighted supported Accept-Language", () => {
    const request = new NextRequest("http://localhost/api", {
      headers: { "accept-language": "ja;q=1, pl;q=0.5, fr-FR;q=0.8" },
    });
    expect(detectLocale(request)).toBe("fr");
  });
});

describe("detectLocaleFromHeaders", () => {
  it("reads the locale cookie", () => {
    const headers = new Headers({ cookie: "theme=dark; NEXT_LOCALE=es", "accept-language": "de" });
    expect(detectLocaleFromHeaders(headers)).toBe("es");
  });

  it("ignores unsupported cookie values", () => {
    const headers = new Headers({ cookie: "i18next=ja", "accept-language": "pl-PL" });
    expect(detectLocaleFromHeaders(headers)).toBe("pl");
  });

  it("falls back to a supported default without any hint", () => {
    expect(["en", "fr", "es", "de", "pl", "nl"]).toContain(detectLocaleFromHeaders(new Headers()));
  });
});
