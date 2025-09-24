import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FileShare from '@/components/FileShare';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

// Mock dependencies
jest.mock('@/hooks/useAuth');
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
}));
jest.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr-code">{value}</div>
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;

// Mock fetch
global.fetch = jest.fn();

// Mock XMLHttpRequest for file uploads
const mockXHR = {
  open: jest.fn(),
  send: jest.fn(),
  setRequestHeader: jest.fn(),
  readyState: 4,
  status: 200,
  response: JSON.stringify({
    success: true,
    share: {
      fileShare: {
        slug: 'test-slug'
      }
    }
  }),
  addEventListener: jest.fn((event, callback) => {
    if (event === 'load') {
      setTimeout(callback, 0);
    }
  }),
  upload: {
    addEventListener: jest.fn()
  }
};

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
    // Handle interpolation with named parameters
    if (options && typeof options === 'object') {
      let result = defaultValue || key;
      for (const [param, value] of Object.entries(options)) {
        if (typeof value === 'number' || typeof value === 'string') {
          result = result.replace(`{{${param}}}`, String(value));
        }
      }
      return result;
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
    jest.clearAllMocks();
    mockUseTranslation.mockReturnValue(createMockTranslation());
    
    // Mock XMLHttpRequest
    (global as any).XMLHttpRequest = jest.fn(() => mockXHR);
  });

  describe('Unauthenticated users', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
    });

    it('renders locked message for anonymous users', () => {
      render(<FileShare />);
      
      expect(screen.getByText('File sharing is locked')).toBeInTheDocument();
      expect(screen.getByText('You must be logged in to share files.')).toBeInTheDocument();
    });

    it('does not show file upload interface', () => {
      render(<FileShare />);
      
      expect(screen.queryByRole('button', { name: /drag.*drop.*file/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/Upload File/i)).not.toBeInTheDocument();
    });
  });

  describe('Authenticated users', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(true));
    });

    it('renders FileShare component for authenticated users', () => {
      render(<FileShare />);
      
      expect(screen.getByText('Drag & drop your file here')).toBeInTheDocument();
      expect(screen.getByText('or click to select a file')).toBeInTheDocument();
    });

    it('handles file selection via input change', () => {
      render(<FileShare />);

      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(screen.getByText('test.txt')).toBeInTheDocument();
    });

    it('validates file size limits', () => {
      render(<FileShare />);

      // Create a file larger than 500MB (authenticated user limit)
      const largeFile = new File(['x'.repeat(1000)], 'large.txt', { type: 'text/plain' });
      Object.defineProperty(largeFile, 'size', { value: 600 * 1024 * 1024 }); // 600MB

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [largeFile] } });

      expect(screen.getByText(/File is too large/)).toBeInTheDocument();
    });

    it('handles drag and drop events', () => {
      render(<FileShare />);

      const dropZone = screen.getByText(/Drag & drop your file here/i).closest('div');
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });

      // Simulate drag over
      fireEvent.dragOver(dropZone!, {
        dataTransfer: { files: [file] }
      });

      // Simulate drop
      fireEvent.drop(dropZone!, {
        dataTransfer: { files: [file] }
      });

      expect(screen.getByText('test.txt')).toBeInTheDocument();
    });

    it('shows expiration settings', () => {
      render(<FileShare />);

      expect(screen.getByText(/Expiration/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('30')).toBeInTheDocument(); // Default 30 days for auth users
    });

    it('shows advanced settings when expanded', () => {
      render(<FileShare />);

      const advancedButton = screen.getByText(/Advanced Settings/i);
      fireEvent.click(advancedButton);

      expect(screen.getByText(/Custom Slug/i)).toBeInTheDocument();
      expect(screen.getByText(/Password protection/i)).toBeInTheDocument();
    });

    it('handles custom slug input', () => {
      render(<FileShare />);

      const advancedButton = screen.getByText(/Advanced Settings/i);
      fireEvent.click(advancedButton);

      const slugInput = screen.getByPlaceholderText(/my-custom-file/i);
      fireEvent.change(slugInput, { target: { value: 'my-test-file' } });

      expect(slugInput).toHaveValue('my-test-file');
    });

    it('handles password protection input', () => {
      render(<FileShare />);

      const advancedButton = screen.getByText(/Advanced Settings/i);
      fireEvent.click(advancedButton);

      const passwordInput = screen.getByPlaceholderText(/Optional.*leave empty/i);
      fireEvent.change(passwordInput, { target: { value: 'testpassword' } });

      expect(passwordInput).toHaveValue('testpassword');
    });

    it('shows never expires option for authenticated users', () => {
      render(<FileShare />);

      expect(screen.getByText(/Never expires/i)).toBeInTheDocument();
    });

    it('toggles never expires checkbox', () => {
      render(<FileShare />);

      const neverExpiresCheckbox = screen.getByRole('checkbox');
      fireEvent.click(neverExpiresCheckbox);

      expect(neverExpiresCheckbox).toBeChecked();
    });

    it('removes selected file when change button is clicked', () => {
      render(<FileShare />);

      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(fileInput, { target: { files: [file] } });
      expect(screen.getByText('test.txt')).toBeInTheDocument();

      const changeButton = screen.getByTitle(/Change file/i);
      fireEvent.click(changeButton);

      expect(screen.queryByText('test.txt')).not.toBeInTheDocument();
    });

    it('displays error when no file is selected for upload', async () => {
      render(<FileShare />);

      const uploadButton = screen.getByRole('button', { name: /Upload File/i });
      fireEvent.click(uploadButton);

      expect(screen.getByText(/Please select a file/i)).toBeInTheDocument();
    });

    it('handles successful file upload', async () => {
      render(<FileShare />);

      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(fileInput, { target: { files: [file] } });
      
      const uploadButton = screen.getByRole('button', { name: /Upload File/i });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(mockXHR.open).toHaveBeenCalledWith('POST', '/api/shares');
      });
    });
  });
});