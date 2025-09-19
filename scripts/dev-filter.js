#!/usr/bin/env node
const { spawn } = require('child_process');
const os = require('os');

const path = require('path');
let child;
try {
  // Prefer calling the Next CLI via the node executable for cross-platform stability
  const nextCli = require.resolve('next/dist/bin/next');
  const nodeExe = process.execPath;
  child = spawn(nodeExe, [nextCli, 'dev'], { stdio: ['inherit', 'pipe', 'pipe'], env: process.env });
} catch (err) {
  // Fallback to npx if resolution fails
  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const args = ['next', 'dev'];
  child = spawn(cmd, args, { stdio: ['inherit', 'pipe', 'pipe'], env: process.env });
}

const filterLine = (line) => {
  try {
    const s = String(line);
    if (/\[Fast Refresh\]|\[HMR\]|Fast Refresh had to perform a full reload/i.test(s)) return null;
    return s;
  } catch (e) {
    return String(line);
  }
};

child.stdout.on('data', (chunk) => {
  const text = String(chunk);
  text.split(/\r?\n/).forEach((ln) => {
    const out = filterLine(ln);
    if (out !== null && out !== '') console.log(out);
  });
});

child.stderr.on('data', (chunk) => {
  const text = String(chunk);
  text.split(/\r?\n/).forEach((ln) => {
    const out = filterLine(ln);
    if (out !== null && out !== '') console.error(out);
  });
});

child.on('close', (code) => {
  process.exit(code);
});
