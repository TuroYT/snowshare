import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CodeBlock from '@/components/pasteShareComponents/CodeBlock';

// Mock CodeMirror
jest.mock('@uiw/react-codemirror', () => {
  return {
    __esModule: true,
    default: ({ 
      value, 
      onChange, 
      readOnly, 
      theme,
      extensions 
    }: { 
      value: string; 
      onChange?: (v: string) => void; 
      readOnly?: boolean;
      theme?: unknown;
      extensions: unknown[];
    }) => (
      <textarea
        data-testid="codemirror"
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        readOnly={readOnly}
        data-theme={typeof theme === 'object' ? 'atomone' : 'default'}
        data-extensions={JSON.stringify(extensions.map(ext => 
          typeof ext === 'object' && ext !== null && 'name' in ext ? ext.name : 'static-extension'
        ))}
      />
    ),
  };
});

// Mock all CodeMirror language extensions
jest.mock('@codemirror/lang-javascript', () => ({
  javascript: jest.fn((options) => ({ name: 'javascript', options })),
}));

jest.mock('@codemirror/lang-python', () => ({
  python: jest.fn(() => ({ name: 'python' })),
}));

jest.mock('@codemirror/lang-java', () => ({
  java: jest.fn(() => ({ name: 'java' })),
}));

jest.mock('@codemirror/lang-php', () => ({
  php: jest.fn(() => ({ name: 'php' })),
}));

jest.mock('@codemirror/lang-go', () => ({
  go: jest.fn(() => ({ name: 'go' })),
}));

jest.mock('@codemirror/lang-html', () => ({
  html: jest.fn(() => ({ name: 'html' })),
}));

jest.mock('@codemirror/lang-css', () => ({
  css: jest.fn(() => ({ name: 'css' })),
}));

jest.mock('@codemirror/lang-sql', () => ({
  sql: jest.fn(() => ({ name: 'sql' })),
}));

jest.mock('@codemirror/lang-json', () => ({
  json: jest.fn(() => ({ name: 'json' })),
}));

jest.mock('@codemirror/lang-markdown', () => ({
  markdown: jest.fn(() => ({ name: 'markdown' })),
}));

jest.mock('@uiw/codemirror-theme-atomone', () => ({
  atomoneInit: jest.fn(() => ({ name: 'atomone-theme' })),
}));

describe('CodeBlock Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with JavaScript code and language', () => {
    const mockOnChange = jest.fn();
    
    render(
      <CodeBlock 
        code="console.log('hello world');"
        language="javascript"
        onChange={mockOnChange}
      />
    );
    
    const textarea = screen.getByTestId('codemirror') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toBe("console.log('hello world');");
    expect(textarea.getAttribute('data-extensions')).toContain('javascript');
  });

  it('renders with markdown language', () => {
    const mockOnChange = jest.fn();
    
    render(
      <CodeBlock 
        code={"# Hello World\n\nThis is **markdown** content."}
        language="markdown"
        onChange={mockOnChange}
      />
    );
    
    const textarea = screen.getByTestId('codemirror') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toBe("# Hello World\n\nThis is **markdown** content.");
    expect(textarea.getAttribute('data-extensions')).toContain('markdown');
  });

  it('renders in read-only mode', () => {
    render(
      <CodeBlock 
        code="Read-only content" 
        language="markdown" 
        readOnly={true}
      />
    );
    
    const textarea = screen.getByTestId('codemirror') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.readOnly).toBe(true);
  });

  it('handles code changes via onChange callback', () => {
    const mockOnChange = jest.fn();
    
    render(
      <CodeBlock 
        code="Initial code" 
        language="javascript" 
        onChange={mockOnChange}
      />
    );
    
    const textarea = screen.getByTestId('codemirror');
    fireEvent.change(textarea, { target: { value: 'Updated code' } });
    
    expect(mockOnChange).toHaveBeenCalledWith('Updated code');
  });

  it('handles unknown language gracefully', () => {
    const mockOnChange = jest.fn();
    
    render(
      <CodeBlock 
        code="Some content" 
        language="unknown-language" 
        onChange={mockOnChange}
      />
    );
    
    const textarea = screen.getByTestId('codemirror') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toBe('Some content');
    // Should fallback to empty extensions array for unknown languages
    expect(textarea.getAttribute('data-extensions')).toContain('static-extension');
  });

  it('renders with plaintext language', () => {
    render(
      <CodeBlock 
        code="Plain text content" 
        language="plaintext"
      />
    );
    
    const textarea = screen.getByTestId('codemirror') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toBe('Plain text content');
    expect(textarea.getAttribute('data-extensions')).toContain('static-extension');
  });

  it('applies atomone theme', () => {
    render(
      <CodeBlock 
        code="Themed content" 
        language="javascript"
      />
    );
    
    const textarea = screen.getByTestId('codemirror');
    expect(textarea.getAttribute('data-theme')).toBe('atomone');
  });

  it('supports all language extensions', () => {
    const languages = [
      { lang: 'javascript', expected: 'javascript' },
      { lang: 'typescript', expected: 'javascript' }, // TypeScript uses javascript extension
      { lang: 'python', expected: 'python' },
      { lang: 'java', expected: 'java' },
      { lang: 'php', expected: 'php' },
      { lang: 'go', expected: 'go' },
      { lang: 'html', expected: 'html' },
      { lang: 'css', expected: 'css' },
      { lang: 'sql', expected: 'sql' },
      { lang: 'json', expected: 'json' }
    ];

    languages.forEach(({ lang, expected }) => {
      const { unmount } = render(
        <CodeBlock 
          code={`// ${lang} code`}
          language={lang}
        />
      );
      
      const textarea = screen.getByTestId('codemirror');
      expect(textarea.getAttribute('data-extensions')).toContain(expected);
      
      unmount();
    });
  });

  it('updates internal value when code prop changes', () => {
    const { rerender } = render(
      <CodeBlock 
        code="Initial code" 
        language="javascript"
      />
    );
    
    let textarea = screen.getByTestId('codemirror') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Initial code');
    
    // Update the code prop
    rerender(
      <CodeBlock 
        code="Updated code" 
        language="javascript"
      />
    );
    
    textarea = screen.getByTestId('codemirror') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Updated code');
  });
});