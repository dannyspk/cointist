import fs from 'fs';
import path from 'path';
import os from 'os';
import handler from '../pages/api/selection-export';

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res._json = null;
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (data: any) => { res._json = data; return res; };
  return res;
}

describe('API /api/selection-export', () => {
  let tmpRoot: string;
  let restoreCwd: jest.SpyInstance<string, []> | null = null;

  beforeAll(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sel-export-'));
    restoreCwd = jest.spyOn(process, 'cwd').mockReturnValue(tmpRoot);
  });

  afterAll(() => {
    if (restoreCwd) restoreCwd.mockRestore();
    try {
      const target = path.join(tmpRoot, 'tmp');
      if (fs.existsSync(target)) {
        // best-effort cleanup
        const rm = (p: string) => {
          if (!fs.existsSync(p)) return;
          const stat = fs.statSync(p);
          if (stat.isDirectory()) {
            for (const n of fs.readdirSync(p)) rm(path.join(p, n));
            try { fs.rmdirSync(p); } catch {}
          } else {
            try { fs.unlinkSync(p); } catch {}
          }
        };
        rm(target);
      }
      try { fs.rmdirSync(tmpRoot); } catch {}
    } catch {}
  });

  test('rejects when any item lacks numeric id', async () => {
    const req: any = { method: 'POST', body: { selected: [ { slug: 'a', title: 'A', id: null } ] } };
    const res = mockRes();
    await handler(req, res as any);
    expect(res.statusCode).toBe(400);
    expect(res._json && res._json.error).toMatch(/requires all items to include a numeric DB id/i);
    // ensure no file was written
    const outfile = path.join(process.cwd(), 'tmp', 'selection-from-pipeline.json');
    expect(fs.existsSync(outfile)).toBe(false);
  });

  test('writes file when all items have numeric ids', async () => {
    const req: any = { method: 'POST', body: { selected: [ { id: 123, slug: 'abc', title: 'T', summary: 'S' } ] } };
    const res = mockRes();
    await handler(req, res as any);
    expect(res.statusCode).toBe(200);
    expect(res._json && res._json.ok).toBe(true);
    const outfile = path.join(process.cwd(), 'tmp', 'selection-from-pipeline.json');
    expect(fs.existsSync(outfile)).toBe(true);
    const data = JSON.parse(fs.readFileSync(outfile, 'utf8'));
    expect(Array.isArray(data.selected)).toBe(true);
    expect(data.selected.length).toBe(1);
    expect(data.selected[0].id).toBe(123);
  });
});
