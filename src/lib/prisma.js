// Lazy-load PrismaClient to avoid bundling native query engines into serverless functions
let _prismaClient = null;

export async function getPrisma() {
  if (_prismaClient) return _prismaClient;
  // dynamic import keeps @prisma/client out of the top-level bundle
  const { PrismaClient } = await import('@prisma/client');
  _prismaClient = new PrismaClient();
  return _prismaClient;
}

// Synchronous helper for modules that can't be async at top-level
export function getPrismaSync() {
  if (_prismaClient) return _prismaClient;
  // Use require to synchronously construct PrismaClient when called at runtime
  // This will still delay loading until the first call.
  // eslint-disable-next-line global-require
  const { PrismaClient } = require('@prisma/client');
  _prismaClient = new PrismaClient();
  return _prismaClient;
}

export default getPrisma;
