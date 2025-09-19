const { PrismaClient } = require('@prisma/client');

let globalForPrisma = global;
const client = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client;

module.exports = client;
