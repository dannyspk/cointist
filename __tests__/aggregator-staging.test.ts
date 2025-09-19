import fs from 'fs';
import path from 'path';
import handler from '../pages/api/selection-staging';

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res._json = null;
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (data: any) => { res._json = data; return res; };
  return res;
}

describe('Aggregator staging endpoint', () => {
  const tmpDir = path.join(process.cwd(), 'tmp');
  const outfile = path.join(tmpDir, 'selection-from-pipeline.json');

  beforeAll(() => {
    try { if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true }); } catch(e) {}
    try { if (fs.existsSync(outfile)) fs.unlinkSync(outfile); } catch(e) {}
  });

  afterAll(() => {
    try { if (fs.existsSync(outfile)) fs.unlinkSync(outfile); } catch(e) {}
  });

  test('stages selected ids 5,7,9 to selection-from-pipeline.json', async () => {
    const payload = {
      selected: [
        { id: null, slug: 'article-5', title: 'Title 5', summary: '' },
        { id: null, slug: 'article-7', title: 'Title 7', summary: '' },
        { id: null, slug: 'article-9', title: 'Title 9', summary: '' }
      ]
    };
    const req: any = { method: 'POST', body: payload };
    const res = mockRes();
    await handler(req, res as any);
    expect(res.statusCode).toBe(200);
    expect(res._json && res._json.ok).toBe(true);
    // file should exist
    expect(fs.existsSync(outfile)).toBe(true);
    const j = JSON.parse(fs.readFileSync(outfile, 'utf8'));
    expect(Array.isArray(j.selected)).toBe(true);
    expect(j.selected.length).toBe(3);
    expect(j.selected.map((s:any)=>s.slug)).toEqual(['article-5','article-7','article-9']);
    expect(typeof j.stagedAt === 'string').toBe(true);
  });
});
