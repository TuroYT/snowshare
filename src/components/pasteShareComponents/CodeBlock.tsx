"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { Extension } from "@codemirror/state";
import { StreamLanguage } from "@codemirror/language";

type Props = {
  code: string;
  language: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
};

// CodeMirror itself is a sizeable dependency; only load it once the editor
// actually renders, and never during SSR.
const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full min-h-[300px] rounded-xl border border-[var(--border)] bg-[var(--surface)] animate-pulse" />
  ),
});

let themePromise: Promise<typeof import("@uiw/codemirror-theme-atomone")> | null = null;
function loadTheme() {
  if (!themePromise) themePromise = import("@uiw/codemirror-theme-atomone");
  return themePromise;
}

// Each CodeMirror language mode is its own package; only load the one
// currently selected instead of bundling all of them upfront.
const LANGUAGE_LOADERS: Record<string, () => Promise<Extension | Extension[]>> = {
  javascript: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ jsx: true })),
  typescript: () =>
    import("@codemirror/lang-javascript").then((m) => m.javascript({ typescript: true })),
  python: () => import("@codemirror/lang-python").then((m) => m.python()),
  java: () => import("@codemirror/lang-java").then((m) => m.java()),
  php: () => import("@codemirror/lang-php").then((m) => m.php()),
  go: () => import("@codemirror/lang-go").then((m) => m.go()),
  html: () => import("@codemirror/lang-html").then((m) => m.html()),
  css: () => import("@codemirror/lang-css").then((m) => m.css()),
  sql: () => import("@codemirror/lang-sql").then((m) => m.sql()),
  json: () => import("@codemirror/lang-json").then((m) => m.json()),
  markdown: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
  powershell: () =>
    import("@codemirror/legacy-modes/mode/powershell").then((m) =>
      StreamLanguage.define(m.powerShell)
    ),
};

const basicSetup = {
  lineNumbers: true,
  foldGutter: false,
  dropCursor: false,
  allowMultipleSelections: false,
  searchKeymap: false,
};

const CodeBlock: React.FC<Props> = ({ code, language, onChange, readOnly = false }) => {
  const [value, setValue] = React.useState(code);
  const [extensions, setExtensions] = React.useState<Extension[]>([]);
  const [theme, setTheme] = React.useState<Extension | undefined>(undefined);

  React.useEffect(() => setValue(code), [code]);

  React.useEffect(() => {
    let cancelled = false;
    const loader = LANGUAGE_LOADERS[language];
    if (!loader) {
      setExtensions([]);
      return;
    }
    loader()
      .then((ext) => {
        if (!cancelled) setExtensions(Array.isArray(ext) ? ext : [ext]);
      })
      .catch((error) => {
        console.error(`CodeBlock: failed to load language extension "${language}":`, error);
        if (!cancelled) setExtensions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [language]);

  React.useEffect(() => {
    let cancelled = false;
    loadTheme()
      .then((m) => {
        if (!cancelled) {
          setTheme(m.atomoneInit({ settings: { caret: "#c6c6c6", fontFamily: "monospace" } }));
        }
      })
      .catch((error) => {
        console.error("CodeBlock: failed to load editor theme:", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="codemirror-scroll-fix codemirror-container text-left text-sm rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] p-2 h-full w-full">
      <div className="w-full h-full overflow-x-auto overflow-y-auto max-w-full">
        <CodeMirror
          value={value}
          height="100%"
          width="100%"
          readOnly={readOnly}
          basicSetup={basicSetup}
          theme={theme}
          extensions={extensions}
          onChange={(v: string) => {
            setValue(v);
            if (onChange) onChange(v);
          }}
        />
      </div>
    </div>
  );
};

export default CodeBlock;
