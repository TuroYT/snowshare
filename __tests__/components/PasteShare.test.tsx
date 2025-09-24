import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PasteShare from '@/components/PasteShare';

// Mock the sub-components
jest.mock('@/components/pasteShareComponents/CodeBlock', () => {
  return function MockCodeBlock({ code, language, onChange }: { 
    code: string; 
    language: string; 
    onChange?: (value: string) => void; 
  }) {
    return (
      <div data-testid="code-block">
        <textarea
          data-testid="code-textarea"
          value={code}
          onChange={(e) => onChange && onChange(e.target.value)}
          data-language={language}
        />
      </div>
    );
  };
});

jest.mock('@/components/pasteShareComponents/ManageCodeBlock', () => {
  return function MockManageCodeBlock({ 
    code, 
    language, 
    onLanguageChange 
  }: { 
    code: string; 
    language: string; 
    onLanguageChange: (lang: string) => void; 
  }) {
    return (
      <div data-testid="manage-code-block">
        <select
          data-testid="language-select"
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="markdown">Markdown</option>
        </select>
        <div data-testid="current-code">{code}</div>
      </div>
    );
  };
});

describe('PasteShare Component', () => {
  it('renders the main layout with CodeBlock and ManageCodeBlock', () => {
    render(<PasteShare />);
    
    expect(screen.getByTestId('code-block')).toBeInTheDocument();
    expect(screen.getByTestId('manage-code-block')).toBeInTheDocument();
  });

  it('initializes with default JavaScript code and language', () => {
    render(<PasteShare />);
    
    const codeTextarea = screen.getByTestId('code-textarea');
    const languageSelect = screen.getByTestId('language-select');
    
    expect(codeTextarea).toHaveValue('function helloWorld() {\n    console.log("Hello, world!");\n  }');
    expect(languageSelect).toHaveValue('javascript');
    expect(codeTextarea).toHaveAttribute('data-language', 'javascript');
  });

  it('updates code when CodeBlock changes', () => {
    render(<PasteShare />);
    
    const codeTextarea = screen.getByTestId('code-textarea');
    const currentCodeDisplay = screen.getByTestId('current-code');
    
    // Change the code in CodeBlock
    fireEvent.change(codeTextarea, { 
      target: { value: 'console.log("New code");' } 
    });
    
    // Verify the code is updated in ManageCodeBlock
    expect(currentCodeDisplay).toHaveTextContent('console.log("New code");');
  });

  it('updates language when ManageCodeBlock changes', () => {
    render(<PasteShare />);
    
    const languageSelect = screen.getByTestId('language-select');
    const codeTextarea = screen.getByTestId('code-textarea');
    
    // Change the language in ManageCodeBlock
    fireEvent.change(languageSelect, { target: { value: 'python' } });
    
    // Verify the language is updated in CodeBlock
    expect(codeTextarea).toHaveAttribute('data-language', 'python');
    expect(languageSelect).toHaveValue('python');
  });

  it('synchronizes state between CodeBlock and ManageCodeBlock', () => {
    render(<PasteShare />);
    
    const codeTextarea = screen.getByTestId('code-textarea');
    const languageSelect = screen.getByTestId('language-select');
    const currentCodeDisplay = screen.getByTestId('current-code');
    
    // Change both code and language
    fireEvent.change(codeTextarea, { 
      target: { value: '# Python Code\nprint("Hello World")' } 
    });
    fireEvent.change(languageSelect, { target: { value: 'python' } });
    
    // Verify both components are synchronized
    expect(codeTextarea).toHaveValue('# Python Code\nprint("Hello World")');
    expect(codeTextarea).toHaveAttribute('data-language', 'python');
    expect(currentCodeDisplay).toHaveTextContent('# Python Code\nprint("Hello World")');
    expect(languageSelect).toHaveValue('python');
  });

  it('has proper layout structure with responsive design classes', () => {
    const { container } = render(<PasteShare />);
    
    // Check for main container classes
    const mainContainer = container.querySelector('.w-full.min-h-screen.flex');
    expect(mainContainer).toBeInTheDocument();
    expect(mainContainer).toHaveClass('flex-col', 'lg:flex-row', 'gap-6', 'p-4', 'lg:p-6');
  });

  it('applies correct styling to CodeBlock container', () => {
    const { container } = render(<PasteShare />);
    
    // Check for CodeBlock container styling
    const codeBlockContainer = container.querySelector('.flex-1.bg-\\[\\#181f2a\\]');
    expect(codeBlockContainer).toBeInTheDocument();
    expect(codeBlockContainer).toHaveClass(
      'rounded-2xl', 
      'shadow-xl', 
      'border', 
      'border-[#232a38]', 
      'p-4', 
      'lg:p-6'
    );
  });

  it('applies correct styling to ManageCodeBlock container', () => {
    const { container } = render(<PasteShare />);
    
    // Check for ManageCodeBlock container styling
    const manageContainer = container.querySelector('.w-full.lg\\:w-96');
    expect(manageContainer).toBeInTheDocument();
    
    const innerContainer = manageContainer?.querySelector('.bg-\\[\\#181f2a\\]');
    expect(innerContainer).toHaveClass(
      'rounded-2xl', 
      'shadow-xl', 
      'border', 
      'border-[#232a38]', 
      'p-4', 
      'lg:p-6'
    );
  });

  it('includes custom CSS styles', () => {
    const { container } = render(<PasteShare />);
    
    // Check that style element is present (JSX styles are rendered)
    const styleElement = container.querySelector('style');
    expect(styleElement).toBeInTheDocument();
  });

  it('maintains state consistency during multiple interactions', () => {
    render(<PasteShare />);
    
    const codeTextarea = screen.getByTestId('code-textarea');
    const languageSelect = screen.getByTestId('language-select');
    const currentCodeDisplay = screen.getByTestId('current-code');
    
    // Sequence of changes
    fireEvent.change(languageSelect, { target: { value: 'markdown' } });
    fireEvent.change(codeTextarea, { target: { value: '# Markdown Title' } });
    fireEvent.change(languageSelect, { target: { value: 'python' } });
    fireEvent.change(codeTextarea, { target: { value: 'print("Python code")' } });
    
    // Final state verification
    expect(codeTextarea).toHaveValue('print("Python code")');
    expect(codeTextarea).toHaveAttribute('data-language', 'python');
    expect(currentCodeDisplay).toHaveTextContent('print("Python code")');
    expect(languageSelect).toHaveValue('python');
  });
});