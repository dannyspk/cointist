import React from 'react';
import { render, screen } from '@testing-library/react';
import Topbar from '../src/components/Topbar';

test('Topbar renders links and toggle', () => {
  render(<Topbar />);
  expect(screen.getByText(/About Us/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument();
});
