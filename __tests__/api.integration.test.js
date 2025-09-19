// Call the API handler directly and mock prisma to avoid needing a running server
jest.mock('../src/lib/prisma', () => ({
  article: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({ id: 1 }), count: jest.fn().mockResolvedValue(0) }
}));

const handler = require('../pages/api/articles/index.js').default;

test('GET /api/articles returns JSON array (handler)', async () => {
  const req = { method: 'GET', query: {} };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
    end: jest.fn()
  };
  await handler(req, res);
  expect(res.json).toHaveBeenCalled();
  const arg = res.json.mock.calls[0][0];
  expect(arg).toBeDefined();
  expect(Array.isArray(arg.data)).toBe(true);
}, 10000);
