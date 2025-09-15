import { render, screen } from '@testing-library/react'
import CodeBlock from '@/components/pasteShareComponents/CodeBlock'

// Mock CodeMirror
jest.mock('@uiw/react-codemirror', () => {
  return {
    __esModule: true,
    default: ({ value, onChange, extensions }: { value: string; onChange?: (v: string) => void; extensions: unknown[] }) => (
      <textarea
        data-testid="codemirror"
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        data-extensions={JSON.stringify(extensions)}
      />
    ),
  }
})

// Mock all CodeMirror language extensions
jest.mock('@codemirror/lang-javascript', () => ({
  javascript: jest.fn(() => 'javascript-extension'),
}))

jest.mock('@codemirror/lang-python', () => ({
  python: jest.fn(() => 'python-extension'),
}))

jest.mock('@codemirror/lang-java', () => ({
  java: jest.fn(() => 'java-extension'),
}))

jest.mock('@codemirror/lang-php', () => ({
  php: jest.fn(() => 'php-extension'),
}))

jest.mock('@codemirror/lang-go', () => ({
  go: jest.fn(() => 'go-extension'),
}))

jest.mock('@codemirror/lang-html', () => ({
  html: jest.fn(() => 'html-extension'),
}))

jest.mock('@codemirror/lang-css', () => ({
  css: jest.fn(() => 'css-extension'),
}))

jest.mock('@codemirror/lang-sql', () => ({
  sql: jest.fn(() => 'sql-extension'),
}))

jest.mock('@codemirror/lang-json', () => ({
  json: jest.fn(() => 'json-extension'),
}))

jest.mock('@codemirror/lang-markdown', () => ({
  markdown: jest.fn(() => 'markdown-extension'),
}))

jest.mock('@uiw/codemirror-theme-atomone', () => ({
  atomoneInit: jest.fn(() => 'atomone-theme'),
}))

describe('CodeBlock Component', () => {
  it('renders with markdown language', () => {
    const mockOnChange = jest.fn()
    
    render(
      <CodeBlock 
        code="# Hello World\n\nThis is **markdown** content." 
        language="markdown" 
        onChange={mockOnChange}
      />
    )
    
    const textarea = screen.getByTestId('codemirror') as HTMLTextAreaElement
    expect(textarea).toBeDefined()
    expect(textarea.value).toContain('# Hello World')
    expect(textarea.value).toContain('This is **markdown** content.')
  })

  it('renders with javascript language', () => {
    const mockOnChange = jest.fn()
    
    render(
      <CodeBlock 
        code="console.log('Hello World');" 
        language="javascript" 
        onChange={mockOnChange}
      />
    )
    
    const textarea = screen.getByTestId('codemirror') as HTMLTextAreaElement
    expect(textarea).toBeDefined()
    expect(textarea.value).toBe("console.log('Hello World');")
  })

  it('renders with plaintext language', () => {
    const mockOnChange = jest.fn()
    
    render(
      <CodeBlock 
        code="Plain text content" 
        language="plaintext" 
        onChange={mockOnChange}
      />
    )
    
    const textarea = screen.getByTestId('codemirror') as HTMLTextAreaElement
    expect(textarea).toBeDefined()
    expect(textarea.value).toBe('Plain text content')
  })

  it('renders in read-only mode', () => {
    render(
      <CodeBlock 
        code="Read-only content" 
        language="markdown" 
        readOnly={true}
      />
    )
    
    const textarea = screen.getByTestId('codemirror')
    expect(textarea).toBeDefined()
  })

  it('handles unknown language gracefully', () => {
    const mockOnChange = jest.fn()
    
    render(
      <CodeBlock 
        code="Some content" 
        language="unknown-language" 
        onChange={mockOnChange}
      />
    )
    
    const textarea = screen.getByTestId('codemirror') as HTMLTextAreaElement
    expect(textarea).toBeDefined()
    expect(textarea.value).toBe('Some content')
  })
})