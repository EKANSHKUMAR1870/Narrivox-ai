import { useState } from 'react';
import Sidebar from './Sidebar';
import ScriptForm from './ScriptForm';
import OutputPanel from './OutputPanel';

export default function WorkspaceView({ user, scripts, onScriptsChange, onLogout }) {
  const [currentId, setCurrentId] = useState(scripts[0]?.id || null);
  const [output, setOutput] = useState('Your script will appear here.');
  const [status, setStatus] = useState('Ready for your next idea.');
  const [thumbnail, setThumbnail] = useState(null);
  const [tone, setTone] = useState('Clear and motivational');
  const [thumbnailStatus, setThumbnailStatus] = useState(null);

  const currentItem = scripts.find((s) => s.id === currentId) || null;

  function handleLoadScript(id) {
    const item = scripts.find((s) => s.id === id);
    if (!item) return;
    setCurrentId(id);
    setOutput(item.script);
    setStatus(`Loaded from history: ${new Date(item.createdAt).toLocaleString()}`);
    setThumbnail(item.thumbnail || null);
    setThumbnailStatus(item.thumbnail ? null : 'No thumbnail yet for this script. Generate one from the panel above.');
  }

  async function handleGenerate(data) {
    setOutput('Narrivox AI is building your outline, hook, and full script...');
    setStatus('Generating script...');

    try {
      const result = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json());

      setOutput(result.script);
      setStatus('Script ready');
      setThumbnail(null);
      setThumbnailStatus('Script saved. Generate a thumbnail for this script when you\'re ready.');
      setCurrentId(result.savedScript.id);
      onScriptsChange((prev) => [result.savedScript, ...prev.filter((s) => s.id !== result.savedScript.id)]);
    } catch (err) {
      setOutput(err.message || 'Something went wrong.');
      setStatus('Request failed');
    }
  }

  async function handleDelete(id) {
    try {
      await fetch('/api/delete-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: id }),
      });

      const next = scripts.filter((s) => s.id !== id);
      onScriptsChange(next);

      if (currentId === id) {
        if (next.length > 0) {
          handleLoadScript(next[0].id);
        } else {
          setCurrentId(null);
          setOutput('Your script will appear here.');
          setStatus('Ready for your next idea.');
          setThumbnail(null);
          setThumbnailStatus(null);
        }
      }
    } catch (err) {
      setOutput(err.message || 'Unable to delete.');
      setStatus('Delete failed');
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace-view" aria-label="Narrivox AI workspace">
        <Sidebar
          user={user}
          scripts={scripts}
          currentId={currentId}
          tone={tone}
          onSelectScript={handleLoadScript}
          onDeleteScript={handleDelete}
          onNewScript={() => {
            setCurrentId(null);
            setOutput('Your script will appear here.');
            setStatus('Ready for your next idea.');
            setThumbnail(null);
            setThumbnailStatus(null);
          }}
          onLogout={onLogout}
        />

        <section className="workspace-main">
          <header className="hero-panel glass-card">
            <div className="hero-text">
              <p className="eyebrow">Narrivox AI Writer</p>
              <h1>Build scripts with a stronger point of view.</h1>
              <p className="lede">
                Generate hooks, title angles, full scripts, and visual cues with
                editorial tones like satire, criticism, documentary analysis,
                commentary, and movie-review pacing.
              </p>
            </div>
            <img className="hero-logo" src="./assets/narrivox-logo.jpeg" alt="Narrivox AI logo" />
          </header>

          <section className="workspace-grid">
            <ScriptForm
              currentItem={currentItem}
              onGenerate={handleGenerate}
              onToneChange={setTone}
            />
            <OutputPanel
              output={output}
              status={status}
              tone={tone}
              thumbnail={thumbnail}
              thumbnailStatus={thumbnailStatus}
              onThumbnailChange={(t) => {
                setThumbnail(t);
                setThumbnailStatus(null);
                onScriptsChange((prev) =>
                  prev.map((s) => (s.id === currentId ? { ...s, thumbnail: t } : s))
                );
              }}
              onThumbnailStatusChange={setThumbnailStatus}
            />
          </section>
        </section>
      </section>
    </main>
  );
}
