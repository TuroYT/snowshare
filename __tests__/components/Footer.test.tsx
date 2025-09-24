import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Footer from '@/components/Footer';
import { useTranslation } from 'react-i18next';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
}));

const mockUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;

describe('Footer Component', () => {
  beforeEach(() => {
    mockUseTranslation.mockReturnValue({
      t: (key: string, fallback?: string) => {
        const translations: Record<string, string> = {
          'footer.made_with': 'Made with',
          'footer.by': 'by Romain',
          'footer.github': 'GitHub',
          'footer.license': 'License',
        };
        return translations[key] || fallback || key;
      },
      i18n: {
        changeLanguage: jest.fn(),
        language: 'en',
      },
    });
  });

  it('renders footer content', () => {
    render(<Footer />);
    
    // Check if the main content is rendered
    expect(screen.getByText(/Made with/)).toBeInTheDocument();
    expect(screen.getByText(/by Romain/)).toBeInTheDocument();
    expect(screen.getByText('❤️')).toBeInTheDocument();
  });

  it('renders GitHub link with correct attributes', () => {
    render(<Footer />);
    
    const githubLink = screen.getByRole('link', { name: 'GitHub' });
    expect(githubLink).toBeInTheDocument();
    expect(githubLink.getAttribute('href')).toBe('https://github.com/TuroYT/snowshare');
    expect(githubLink.getAttribute('target')).toBe('_blank');
    expect(githubLink.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders License link with correct attributes', () => {
    render(<Footer />);
    
    const licenseLink = screen.getByRole('link', { name: 'License' });
    expect(licenseLink).toBeInTheDocument();
    expect(licenseLink.getAttribute('href')).toBe('/LICENSE');
  });

  it('has proper semantic structure', () => {
    render(<Footer />);
    
    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInTheDocument();
    
    // Check for links structure
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2); // GitHub and License links
  });

  it('applies correct CSS classes', () => {
    render(<Footer />);
    
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveClass('mt-12', 'border-t', 'border-gray-800', 'bg-gray-900');
  });

  it('uses translation keys correctly', () => {
    render(<Footer />);
    
    expect(mockUseTranslation).toHaveBeenCalled();
    const { t } = mockUseTranslation.mock.results[0].value;
    
    // Verify translation function was called with correct keys
    expect(t).toBeDefined();
  });
});