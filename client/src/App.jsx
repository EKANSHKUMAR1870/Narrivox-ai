import { useState, useEffect, useCallback } from 'react';
import { requestJson, setToken, clearToken, getToken } from './api';
import LoginView from './components/LoginView';
import WorkspaceView from './components/WorkspaceView';

export default function App() {
  const [user, setUser] = useState(null);
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleAuthSuccess = useCallback((token, userData, scriptList) => {
    setToken(token);
    setUser(userData);
    setScripts(Array.isArray(scriptList) ? scriptList : []);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await requestJson('/api/auth/logout', { method: 'POST' });
    } catch {}
    clearToken();
    setUser(null);
    setScripts([]);
  }, []);

  useEffect(() => {
    if (getToken()) {
      requestJson('/api/auth/session', { method: 'GET' })
        .then((data) => {
          setUser(data.user);
          setScripts(Array.isArray(data.scripts) ? data.scripts : []);
        })
        .catch(() => {
          clearToken();
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) return null;

  if (!user) {
    return <LoginView onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <WorkspaceView
      user={user}
      scripts={scripts}
      onScriptsChange={setScripts}
      onLogout={handleLogout}
    />
  );
}
