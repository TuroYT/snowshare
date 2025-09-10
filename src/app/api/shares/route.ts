/** API route for creating shares */

import { NextResponse } from "next/server";
import { createLinkShare } from "./(linkShare)/linkshare";
import { createPasteShare } from "./(pasteShare)/pasteshareshare";

async function POST(req: Request) {
  const data = await req.json();
  if (!data || !data.type) {
    return NextResponse.json({ error: "Type de partage requis" }, { status: 400 });
  }

  switch (data.type) {
    case "URL": {
      const { urlOriginal, expiresAt, slug, password } = data;
      const result = await createLinkShare(urlOriginal, expiresAt, slug, password);
      if (result?.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ share: result }, { status: 201 });
    }
    case "PASTE": {
      const { paste, pastelanguage, expiresAt, slug, password } = data;
      const result = await createPasteShare(paste, pastelanguage, expiresAt, slug, password);
      if (result?.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ share: result }, { status: 201 });
    }
    default:
      return NextResponse.json({ error: "Type de partage invalide" }, { status: 400 });
  }

  // return NextResponse.json({ shareType }, { status: 201 });
}

export { POST };
