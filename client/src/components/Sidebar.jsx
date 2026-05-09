import { useState, useMemo } from 'react';

export default function Sidebar({ user, scripts, currentId, tone, onSelectScript, onDeleteScript, onNewScript, onLogout }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? scripts.filter((s) => s.topic?.toLowerCase().includes(q) || s.tone?.toLowerCase().includes(q))
      : scripts;
  }, [scripts, search]);

  const latestTone = scripts[0]?.tone || 'None yet';

  return (
    <aside className="sidebar glass-card">
      <div className="sidebar-brand">
        <img className="sidebar-logo" src="./assets/narrivox-logo.jpeg" alt="Narrivox AI logo" />
        <div>
          <p className="eyebrow">Narrivox AI</p>
          <h2>Script Vault</h2>
        </div>
      </div>

      <div className="sidebar-user">
        <p>Signed in as</p>
        <strong>{user.email}</strong>
      </div>

      <div className="sidebar-stats">
        <div className="stat-card">
          <span>Saved scripts</span>
          <strong>{scripts.length}</strong>
        </div>
        <div className="stat-card">
          <span>Latest tone</span>
          <strong>{latestTone}</strong>
        </div>
      </div>

      <div className="sidebar-actions">
        <button type="button" className="secondary-button" onClick={onNewScript}>New Script</button>
        <button type="button" className="ghost-button" onClick={onLogout}>Log Out</button>
      </div>

      <div className="history-block">
        <div className="section-heading compact">
          <h3>History</h3>
          <p>Recent scripts synced from the Narrivox database.</p>
        </div>
        <label className="history-search">
          <span>Search history</span>
          <input
            type="search"
            placeholder="Search topic or tone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="history-list">
          {filtered.length === 0 ? (
            <p className="history-empty">
              {search ? 'No history matches that search yet.' : 'No saved scripts yet. Generate one to start your vault.'}
            </p>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className={`history-item${item.id === currentId ? ' active' : ''}`}
              >
                <button
                  type="button"
                  className="history-item-button"
                  onClick={() => onSelectScript(item.id)}
                >
                  <strong>{item.topic}</strong>
                  <span className="history-meta">{item.tone} | {item.duration}</span>
                  <span className="history-meta">
                    {new Date(item.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </button>
                <button
                  type="button"
                  className="history-delete-button"
                  onClick={() => onDeleteScript(item.id)}
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
