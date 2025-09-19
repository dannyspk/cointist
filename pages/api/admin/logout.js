export default function handler(req, res){
  const secureFlag = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';
  res.setHeader('Set-Cookie', `cms_token=deleted; HttpOnly; ${secureFlag}Path=/; Max-Age=0; SameSite=Lax`);
  res.json({ ok: true });
}
