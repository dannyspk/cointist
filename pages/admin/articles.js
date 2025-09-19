import React, { useEffect, useState } from 'react';

export default function AdminArticlesPage() {
  const [password, setPassword] = useState('');
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', category: '', excerpt: '', content: '', author: '', tags: '' });
  const [authorsList, setAuthorsList] = useState([]);

  const headersForAuth = () => ({ 'x-cms-pass': password, 'Content-Type': 'application/json' });

  async function loadArticles() {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/admin/articles', { headers: headersForAuth() });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setArticles(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(String(e));
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (password) loadArticles();
  }, [password]);

  // fetch authors on mount so the selector is available immediately
  useEffect(() => {
    fetch('/api/authors')
      .then(r => r.json())
      .then(j => setAuthorsList(Array.isArray(j) ? j : []))
      .catch(() => setAuthorsList([]))
  }, []);

  function startCreate() {
    setEditing(null);
    setForm({ title: '', category: '', excerpt: '', content: '', author: '', tags: '' });
  }

  function startEdit(a) {
    setEditing(a.id);
    setForm({ title: a.title || '', category: a.category || '', excerpt: a.excerpt || '', content: a.content || '', author: a.author || '', tags: (a.tags && Array.isArray(a.tags)) ? a.tags.join(', ') : (a.tags || '') });
  }

  async function save() {
    setLoading(true); setError(null);
    try {
      const payload = { ...form };
      // convert comma-separated tags string to array
      if (payload.tags && typeof payload.tags === 'string') {
        payload.tags = payload.tags.split(',').map(s=>s.trim()).filter(Boolean)
      }
      const url = editing ? `/api/admin/articles/${editing}` : '/api/admin/articles';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: headersForAuth(), body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      await loadArticles();
      startCreate();
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  }

  async function remove(id) {
    if (!confirm('Delete article?')) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/articles/${id}`, { method: 'DELETE', headers: headersForAuth() });
      if (!res.ok && res.status !== 204) throw new Error(await res.text());
      await loadArticles();
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  }

  return React.createElement('div', { style: { padding: 20, fontFamily: 'Arial, sans-serif' } },
    React.createElement('h1', null, 'Admin — Articles'),
    React.createElement('div', { style: { marginBottom: 12 } },
      React.createElement('label', null, 'CMS Password: '),
      React.createElement('input', { type: 'password', value: password, onChange: e => setPassword(e.target.value), style: { marginLeft: 8 } }),
      React.createElement('button', { onClick: loadArticles, style: { marginLeft: 8 } }, 'Load')
    ),
    password ? (
      React.createElement('div', null,
        React.createElement('div', { style: { marginBottom: 12 } },
          React.createElement('button', { onClick: startCreate }, 'New Article'),
          React.createElement('button', { onClick: () => { setEditing(null); setForm({ title: '', category: 'Guides', excerpt: '', content: '' }); }, style: { marginLeft: 8 } }, 'New Guide'),
          React.createElement('span', { style: { marginLeft: 12 } }, loading ? 'Loading...' : null),
          React.createElement('div', { style: { color: 'red' } }, error)
        ),
        React.createElement('div', { style: { display: 'flex', gap: 20 } },
          React.createElement('div', { style: { flex: 1 } },
            React.createElement('h2', null, 'Articles'),
            React.createElement('ul', null, articles.map(a => React.createElement('li', { key: a.id, style: { marginBottom: 8 } },
              React.createElement('strong', null, a.title || ('#' + a.id)), ' — ', React.createElement('em', null, a.category),
              React.createElement('div', null,
                React.createElement('button', { onClick: () => startEdit(a) }, 'Edit'),
                React.createElement('button', { onClick: () => remove(a.id), style: { marginLeft: 8 } }, 'Delete')
              )
            )))
          ),
          React.createElement('div', { style: { width: 420 } },
            React.createElement('h2', null, editing ? 'Edit Article' : 'New Article'),
            React.createElement('div', null,
              React.createElement('div', null, React.createElement('label', null, 'Title'), React.createElement('br'), React.createElement('input', { value: form.title, onChange: e => setForm({ ...form, title: e.target.value }), style: { width: '100%' } })),
              React.createElement('div', null, React.createElement('label', null, 'Category'), React.createElement('br'), React.createElement('input', { value: form.category, onChange: e => setForm({ ...form, category: e.target.value }), style: { width: '100%' } })),
              React.createElement('div', null, React.createElement('label', null, 'Author'), React.createElement('br'), React.createElement('select', { value: form.author || '', onChange: e => setForm({ ...form, author: e.target.value }), style: { width: '100%' } },
                React.createElement('option', { value: '' }, '-- choose author --'),
                authorsList.map(a=>React.createElement('option', { key: a.name, value: a.name }, a.name))
              )),
              React.createElement('div', null, React.createElement('label', null, 'Tags (comma-separated)'), React.createElement('br'), React.createElement('input', { value: form.tags || '', onChange: e => setForm({ ...form, tags: e.target.value }), style: { width: '100%' } })),
              React.createElement('div', null, React.createElement('label', null, 'Excerpt'), React.createElement('br'), React.createElement('textarea', { value: form.excerpt, onChange: e => setForm({ ...form, excerpt: e.target.value }), style: { width: '100%' } })),
              React.createElement('div', null, React.createElement('label', null, 'Content'), React.createElement('br'), React.createElement('textarea', { value: form.content, onChange: e => setForm({ ...form, content: e.target.value }), style: { width: '100%', height: 140 } })),
              React.createElement('div', { style: { marginTop: 8 } }, React.createElement('button', { onClick: save }, editing ? 'Save' : 'Create'))
            )
          )
        )
      )
    ) : React.createElement('div', null, 'Enter CMS password to manage articles')
  );
}
