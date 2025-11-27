/**
 * Tests for Footer component
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import Footer from '@/components/Footer';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key,
    i18n: { language: 'en' },
  }),
}));

describe('Footer', () => {
  it('renders the footer component', () => {
    render(<Footer />);
    
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('displays the "Made with" text', () => {
    render(<Footer />);
    
    expect(screen.getByText(/Made with/i)).toBeInTheDocument();
  });

  it('displays the heart emoji', () => {
    render(<Footer />);
    
    expect(screen.getByText('❤️')).toBeInTheDocument();
  });

  it('displays GitHub link', () => {
    render(<Footer />);
    
    const githubLink = screen.getByRole('link', { name: /github/i });
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute('href', 'https://github.com/TuroYT/snowshare');
    expect(githubLink).toHaveAttribute('target', '_blank');
    expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('displays License link', () => {
    render(<Footer />);
    
    const licenseLink = screen.getByRole('link', { name: /license/i });
    expect(licenseLink).toBeInTheDocument();
    expect(licenseLink).toHaveAttribute('href', '/LICENSE');
  });

  it('displays copyright text', () => {
    render(<Footer />);
    
    expect(screen.getByText(/© 2025 SnowShare/i)).toBeInTheDocument();
  });

  it('displays all rights reserved text', () => {
    render(<Footer />);
    
    // The translation key for rights
    expect(screen.getByText(/Tous droits réservés/i)).toBeInTheDocument();
  });
});
