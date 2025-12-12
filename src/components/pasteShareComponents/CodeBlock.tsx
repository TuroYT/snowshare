"use client";

import React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { atomoneInit } from "@uiw/codemirror-theme-atomone";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { php } from "@codemirror/lang-php";
import { go } from "@codemirror/lang-go";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { sql } from "@codemirror/lang-sql";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";

type Props = {
  code: string;
  language: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
};

function getExtension(language: string) {
  switch (language) {
    case "plaintext":
      return [];
    case "javascript":
      return javascript({ jsx: true });
    case "typescript":
      return javascript({ typescript: true });
    case "python":
      return python();
    case "java":
      return java();
    case "php":
      return php();
    case "go":
      return go();
    case "html":
      return html();
    case "css":
      return css();
    case "sql":
      return sql();
    case "json":
      return json();
    case "markdown":
      return markdown();
    default:
      return [];
  }
}

const CodeBlock: React.FC<Props> = ({ code, language, onChange, readOnly = false }) => {
  const [value, setValue] = React.useState(code);

  React.useEffect(() => setValue(code), [code]);

  return (
    <div className="codemirror-scroll-fix codemirror-container text-left text-sm rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] p-2 h-full w-full">
      <div className="w-full h-full overflow-x-auto overflow-y-auto max-w-full">
        <CodeMirror
          value={value}
          height="100%"
          width="100%"
          readOnly={readOnly}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            dropCursor: false,
            allowMultipleSelections: false,
            searchKeymap: false,
          }}
          theme={atomoneInit({
            settings: {
              caret: "#c6c6c6",
              fontFamily: "monospace",
            },
          })}
          extensions={[getExtension(language)]}
          onChange={(v) => {
            setValue(v);
            if (onChange) onChange(v);
          }}
        />
      </div>
    </div>
  );
};

export default CodeBlock;
