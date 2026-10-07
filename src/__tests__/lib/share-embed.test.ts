/**
 * @jest-environment node
 */

jest.mock("@/lib/prisma", () => ({
  prisma: { share: { findUnique: jest.fn() } },
}));
jest.mock("@/lib/settings", () => ({ getSettingsCached: jest.fn() }));

import { prisma } from "@/lib/prisma";
import { getSettingsCached } from "@/lib/settings";
import {
  buildShareEmbed,
  getShareEmbedMetadata,
  getShareEmbedViewport,
  truncateForEmbed,
  type EmbedShare,
} from "@/lib/share-embed";

const mockFindUnique = prisma.share.findUnique as jest.Mock;
const mockSettings = getSettingsCached as jest.Mock;

const SETTINGS = { appName: "SnowShare", embedPasteExcerpt: false };

function share(overrides: Partial<EmbedShare> = {}): EmbedShare {
  return {
    type: "FILE",
    password: null,
    expiresAt: null,
    maxViews: null,
    viewCount: 0,
    filePath: "cuid123_report_final.pdf",
    size: BigInt(2000),
    note: null,
    isBulk: false,
    paste: null,
    pastelanguage: null,
    files: [],
    ...overrides,
  };
}

describe("truncateForEmbed", () => {
  it("collapses whitespace", () => {
    expect(truncateForEmbed("a\n\n  b\tc", 50)).toBe("a b c");
  });

  it("cuts long text with an ellipsis", () => {
    const result = truncateForEmbed("x".repeat(300), 200);
    expect(result).toHaveLength(200);
    expect(result.endsWith("…")).toBe(true);
  });
});

describe("buildShareEmbed", () => {
  it("shows the original file name and size of a public file", () => {
    const meta = buildShareEmbed(share({ note: "Q3 numbers" }), "FILE", SETTINGS, "en");
    expect(meta.title).toBe("report_final.pdf");
    expect(meta.description).toBe("2 KB\nQ3 numbers\nShared via SnowShare");
    expect(meta.openGraph).toMatchObject({ title: "report_final.pdf", siteName: "SnowShare" });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("shows the file count and total size of a bulk share", () => {
    const meta = buildShareEmbed(
      share({
        isBulk: true,
        filePath: null,
        files: [{ size: BigInt(1000) }, { size: BigInt(1000) }],
      }),
      "FILE",
      SETTINGS,
      "en"
    );
    expect(meta.title).toBe("2 files");
    expect(meta.description).toBe("2 KB\nShared via SnowShare");
  });

  it("hides everything about a password-protected file", () => {
    const meta = buildShareEmbed(
      share({ password: "hash", note: "secret note" }),
      "FILE",
      SETTINGS,
      "en"
    );
    expect(meta.title).toBe("Password-protected file");
    expect(meta.description).toBe("Shared via SnowShare");
  });

  it.each([
    ["missing", null],
    ["expired", share({ expiresAt: new Date(Date.now() - 1000) })],
    ["out of views", share({ maxViews: 1, viewCount: 1 })],
    ["of another type", share({ type: "PASTE" })],
  ])("shows a generic preview for a share %s", (_label, value) => {
    const meta = buildShareEmbed(value, "FILE", SETTINGS, "en");
    expect(meta.title).toBe("This share is no longer available");
    expect(meta.description).toBe("Shared via SnowShare");
  });

  it("shows the paste language without content by default", () => {
    const meta = buildShareEmbed(
      share({ type: "PASTE", paste: "console.log(1)", pastelanguage: "JAVASCRIPT" }),
      "PASTE",
      SETTINGS,
      "en"
    );
    expect(meta.title).toBe("JavaScript paste");
    expect(meta.description).toBe("Shared via SnowShare");
  });

  it("shows an excerpt when enabled", () => {
    const meta = buildShareEmbed(
      share({ type: "PASTE", paste: "hello\nworld", pastelanguage: "PLAINTEXT" }),
      "PASTE",
      { ...SETTINGS, embedPasteExcerpt: true },
      "en"
    );
    expect(meta.title).toBe("Text paste");
    expect(meta.description).toBe("hello world\nShared via SnowShare");
  });

  it("never shows an excerpt of a view-limited paste", () => {
    const meta = buildShareEmbed(
      share({ type: "PASTE", paste: "secret", maxViews: 5 }),
      "PASTE",
      { ...SETTINGS, embedPasteExcerpt: true },
      "en"
    );
    expect(meta.description).toBe("Shared via SnowShare");
  });

  it("hides a password-protected paste", () => {
    const meta = buildShareEmbed(
      share({ type: "PASTE", paste: "secret", password: "hash" }),
      "PASTE",
      { ...SETTINGS, embedPasteExcerpt: true },
      "en"
    );
    expect(meta.title).toBe("Password-protected paste");
    expect(meta.description).toBe("Shared via SnowShare");
  });

  it("translates the preview", () => {
    const meta = buildShareEmbed(share({ password: "hash" }), "FILE", SETTINGS, "fr");
    expect(meta.title).toBe("Fichier protégé par mot de passe");
    expect(meta.description).toBe("Partagé via SnowShare");
  });
});

describe("getShareEmbedMetadata", () => {
  const originalUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DATABASE_URL = "postgres://test";
  });

  afterAll(() => {
    process.env.DATABASE_URL = originalUrl;
  });

  it("builds the preview from the database", async () => {
    mockSettings.mockResolvedValue({
      socialEmbedsEnabled: true,
      appName: "Drop",
      embedPasteExcerpt: false,
    });
    mockFindUnique.mockResolvedValue(share());

    const meta = await getShareEmbedMetadata("abc", "FILE", "en");

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "abc" } })
    );
    expect(meta.title).toBe("report_final.pdf");
    expect(meta.description).toBe("2 KB\nShared via Drop");
  });

  it("falls back to the root metadata when embeds are disabled", async () => {
    mockSettings.mockResolvedValue({ socialEmbedsEnabled: false });

    expect(await getShareEmbedMetadata("abc", "FILE", "en")).toEqual({});
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("skips the database during static builds", async () => {
    delete process.env.DATABASE_URL;

    expect(await getShareEmbedMetadata("abc", "FILE", "en")).toEqual({});
    expect(mockSettings).not.toHaveBeenCalled();
  });

  it("logs and falls back on database errors", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockSettings.mockRejectedValue(new Error("down"));

    expect(await getShareEmbedMetadata("abc", "FILE", "en")).toEqual({});
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("getShareEmbedViewport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DATABASE_URL = "postgres://test";
  });

  it("uses the branding primary color", async () => {
    mockSettings.mockResolvedValue({ socialEmbedsEnabled: true, primaryColor: "#123456" });
    expect(await getShareEmbedViewport()).toEqual({ themeColor: "#123456" });
  });

  it("returns nothing when embeds are disabled", async () => {
    mockSettings.mockResolvedValue({ socialEmbedsEnabled: false, primaryColor: "#123456" });
    expect(await getShareEmbedViewport()).toEqual({});
  });
});
