import { requireAdmin } from '../../../src/lib/auth';

export default function handler(req, res) {
  if (requireAdmin(req, res)) return res.json({ ok: true });
  // requireAdmin already returned 401 on failure
}
