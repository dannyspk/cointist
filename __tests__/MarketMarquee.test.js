import React from 'react';
import { render, screen } from '@testing-library/react';
import MarketMarquee from '../src/components/MarketMarquee';

beforeAll(() => {
  // jest-dom requires this but the component uses fetch; we'll stub fetch
  global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve([]) }));
});

afterAll(() => { global.fetch = undefined; });

test('MarketMarquee renders loading state', async () => {
  render(<MarketMarquee />);
  expect(await screen.findByText(/Loading market data/i)).toBeInTheDocument();
});
