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

// Helper functions for mocks
const createMockAuthResponse = (isAuthenticated: boolean) => ({
  session: isAuthenticated ? { 
    user: { id: '1', name: 'Test User', email: 'test@example.com' },
    expires: '2025-12-31T23:59:59.999Z'
  } : null,
  status: isAuthenticated ? 'authenticated' as const : 'unauthenticated' as const,
  isLoading: false,
  isAuthenticated,
  user: isAuthenticated ? { id: '1', name: 'Test User', email: 'test@example.com' } : undefined,
});

const createMockTranslation = () => ({
  t: (key: string, defaultValue?: string, options?: Record<string, unknown>) => {
    if (options && options.count !== undefined && options.count !== null) {
      return defaultValue?.replace('{{count}}', String(options.count)) || key;
    }
    if (options && options.max !== undefined && options.max !== null) {
      return defaultValue?.replace('{{max}}', String(options.max)) || key;
    }
    if (options && options.progress !== undefined && options.progress !== null) {
      return defaultValue?.replace('{{progress}}', String(options.progress)) || key;
    }
    return defaultValue || key;
  },
  i18n: {
    changeLanguage: jest.fn(),
    language: 'en',
  },
});

describe('FileShare', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseTranslation.mockReturnValue(createMockTranslation() as any);

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).XMLHttpRequest = jest.fn(() => mockXHR);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders locked message for anonymous users', () => {
    mockUseAuth.mockReturnValue(createMockAuthResponse(false));

    render(<FileShare />);

    expect(screen.getByText('File sharing is locked')).toBeInTheDocument();
    expect(screen.getByText('You must be logged in to share files.')).toBeInTheDocument();
    expect(screen.queryByText('Upload and share your files easily')).not.toBeInTheDocument();
    expect(screen.queryByText('Drag & drop your file here')).not.toBeInTheDocument();
  });

  it('renders FileShare component for authenticated users', () => {
    mockUseAuth.mockReturnValue(createMockAuthResponse(true));

    render(<FileShare />);

    expect(screen.getByText('FileShare')).toBeInTheDocument();
    expect(screen.getByText('Upload and share your files easily')).toBeInTheDocument();
    expect(screen.getByText('Drag & drop your file here')).toBeInTheDocument();
    expect(screen.getByText('500MB maximum for authenticated users')).toBeInTheDocument();
    expect(screen.getByText('Never expires')).toBeInTheDocument();
  });

  describe('Authenticated users only', () => {
    it('handles file selection via click', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(true));

      render(<FileShare />);

      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;

      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(screen.getByText('Selected file:')).toBeInTheDocument();
      expect(screen.getByText('test.txt')).toBeInTheDocument();
    });

    it('handles drag and drop file selection', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(true));

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

    it('validates file size for authenticated users', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(true));

      render(<FileShare />);

      // Create a file larger than 500MB (500 * 1024 * 1024 + 1)
      const largeFile = new File(['x'.repeat(500 * 1024 * 1024 + 1)], 'large.txt', { type: 'text/plain' });
      const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;

      fireEvent.change(fileInput, { target: { files: [largeFile] } });

      expect(screen.getByText(/File is too large/)).toBeInTheDocument();
    });

    it('shows different file size limits for authenticated users', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(true));

      render(<FileShare />);

      expect(screen.getByText('500MB maximum for authenticated users')).toBeInTheDocument();
    });

    it('handles form submission', async () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(true));

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
      mockUseAuth.mockReturnValue(createMockAuthResponse(true));

      render(<FileShare />);

      const submitButton = screen.getByRole('button', { name: /Share file/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('A file is required')).toBeInTheDocument();
      });
    });

    it('shows advanced settings', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(true));

      render(<FileShare />);

      expect(screen.getByText('Advanced settings (optional)')).toBeInTheDocument();
      expect(screen.getByText('Custom link')).toBeInTheDocument();
      expect(screen.getByText('Password protection')).toBeInTheDocument();
    });

    it('handles custom slug input', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(true));

      render(<FileShare />);

      const slugInput = screen.getByPlaceholderText('my-custom-file');
      fireEvent.change(slugInput, { target: { value: 'my-test-file' } });

      expect(slugInput).toHaveValue('my-test-file');
    });

    it('handles password protection input', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(true));

      render(<FileShare />);

      const passwordInput = screen.getByPlaceholderText(/Optional - leave empty for open access/);
      fireEvent.change(passwordInput, { target: { value: 'testpassword' } });

      expect(passwordInput).toHaveValue('testpassword');
    });

    it('shows never expires option for authenticated users', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(true));

      render(<FileShare />);

      expect(screen.getByText('Never expires')).toBeInTheDocument();
      expect(screen.getByText('This file will remain available indefinitely')).toBeInTheDocument();
    });

    it('toggles never expires checkbox', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(true));

      render(<FileShare />);

      const neverExpiresCheckbox = screen.getByRole('checkbox');
      fireEvent.click(neverExpiresCheckbox);

      expect(neverExpiresCheckbox).toBeChecked();
    });

    it('removes selected file when change button is clicked', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(true));

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
});