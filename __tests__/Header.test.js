import React from 'react';
import { render, screen } from '@testing-library/react';
import Header from '../src/components/Header';

test('Header renders brand and nav links', () => {
  render(<Header />);
  expect(screen.getByRole('img', { name: /cointist/i })).toBeInTheDocument();
  // Nav links may appear twice (desktop + mobile). Ensure at least one exists.
  const newsLinks = screen.getAllByText(/News/i);
  expect(Array.isArray(newsLinks) && newsLinks.length).toBeGreaterThan(0);
});
