import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FileShare from '@/components/FileShare';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

// Mock dependencies
jest.mock('@/hooks/useAuth');
jest.mock('react-i18next');
jest.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr-code">{value}</div>
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;

// Mock fetch
global.fetch = jest.fn();

describe('FileShare', () => {
  beforeEach(() => {
    mockUseTranslation.mockReturnValue({
      t: (key: string, defaultValue?: string, options?: any) => {
        if (options && options.count !== undefined) {
          return defaultValue?.replace('{{count}}', options.count.toString()) || key;
        }
        if (options && options.max !== undefined) {
          return defaultValue?.replace('{{max}}', options.max.toString()) || key;
        }
        return defaultValue || key;
      },
      i18n: {
        changeLanguage: jest.fn(),
        language: 'en',
      },
    } as any);

    // Mock XMLHttpRequest
    const mockXHR = {
      open: jest.fn(),
      send: jest.fn(),
      setRequestHeader: jest.fn(),
      readyState: 4,
      status: 200,
      responseText: JSON.stringify({ share: { fileShare: { slug: 'test-slug' } } }),
      upload: {
        onprogress: null,
      },
      onload: null,
      onerror: null,
    };

    (global as any).XMLHttpRequest = jest.fn(() => mockXHR);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders FileShare component for anonymous users', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });

    render(<FileShare />);

    expect(screen.getByText('FileShare')).toBeInTheDocument();
    expect(screen.getByText('Upload and share your files easily')).toBeInTheDocument();
    expect(screen.getByText('Drag & drop your file here')).toBeInTheDocument();
    expect(screen.getByText('50MB maximum for anonymous users')).toBeInTheDocument();
  });

  it('renders FileShare component for authenticated users', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });

    render(<FileShare />);

    expect(screen.getByText('500MB maximum for authenticated users')).toBeInTheDocument();
    expect(screen.getByText('Never expires')).toBeInTheDocument();
  });

  it('handles file selection via click', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });

    render(<FileShare />);

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText('Selected file:')).toBeInTheDocument();
    expect(screen.getByText('test.txt')).toBeInTheDocument();
  });

  it('handles drag and drop file selection', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });

    render(<FileShare />);

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const dropZone = screen.getByText('Drag & drop your file here').closest('div');

    if (dropZone) {
      fireEvent.dragOver(dropZone);
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file],
        },
      });
    }

    expect(screen.getByText('Selected file:')).toBeInTheDocument();
    expect(screen.getByText('test.txt')).toBeInTheDocument();
  });

  it('validates file size for anonymous users', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });

    render(<FileShare />);

    // Create a file larger than 50MB (50 * 1024 * 1024 + 1)
    const largeFile = new File(['x'.repeat(50 * 1024 * 1024 + 1)], 'large.txt', { type: 'text/plain' });
    const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    expect(screen.getByText(/File is too large/)).toBeInTheDocument();
  });

  it('shows different file size limits for authenticated users', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });

    render(<FileShare />);

    expect(screen.getByText('500MB maximum for authenticated users')).toBeInTheDocument();
  });

  it('handles form submission', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });

    render(<FileShare />);

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    const submitButton = screen.getByRole('button', { name: /Share file/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Creating share/)).toBeInTheDocument();
    });
  });

  it('displays error when no file is selected', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });

    render(<FileShare />);

    const submitButton = screen.getByRole('button', { name: /Share file/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('A file is required')).toBeInTheDocument();
    });
  });

  it('shows advanced settings', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });

    render(<FileShare />);

    expect(screen.getByText('Advanced settings (optional)')).toBeInTheDocument();
    expect(screen.getByText('Custom link')).toBeInTheDocument();
    expect(screen.getByText('Password protection')).toBeInTheDocument();
  });

  it('handles custom slug input', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });

    render(<FileShare />);

    const slugInput = screen.getByPlaceholderText('my-custom-file');
    fireEvent.change(slugInput, { target: { value: 'my-test-file' } });

    expect(slugInput).toHaveValue('my-test-file');
  });

  it('handles password protection input', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });

    render(<FileShare />);

    const passwordInput = screen.getByPlaceholderText(/Optional - leave empty for open access/);
    fireEvent.change(passwordInput, { target: { value: 'testpassword' } });

    expect(passwordInput).toHaveValue('testpassword');
  });

  it('shows never expires option for authenticated users', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });

    render(<FileShare />);

    expect(screen.getByText('Never expires')).toBeInTheDocument();
    expect(screen.getByText('This file will remain available indefinitely')).toBeInTheDocument();
  });

  it('toggles never expires checkbox', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });

    render(<FileShare />);

    const neverExpiresCheckbox = screen.getByRole('checkbox');
    fireEvent.click(neverExpiresCheckbox);

    expect(neverExpiresCheckbox).toBeChecked();
  });

  it('removes selected file when change button is clicked', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });

    render(<FileShare />);

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText('test.txt')).toBeInTheDocument();

    const changeButton = screen.getByTitle('Change file');
    fireEvent.click(changeButton);

    expect(screen.queryByText('test.txt')).not.toBeInTheDocument();
    expect(screen.getByText('Drag & drop your file here')).toBeInTheDocument();
  });
});