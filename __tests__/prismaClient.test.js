/* eslint-env node */
/* @jest-environment node */
jest.mock('../src/lib/prisma', () => ({
  article: { findMany: jest.fn().mockResolvedValue([]) }
}));

import prisma from '../src/lib/prisma';

describe('Prisma client (mocked)', () => {
  test('mocked prisma returns array', async () => {
    const articles = await prisma.article.findMany();
    expect(Array.isArray(articles)).toBe(true);
    expect(prisma.article.findMany).toHaveBeenCalled();
  });
});
