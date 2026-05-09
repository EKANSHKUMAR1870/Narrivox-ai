import { useState, useEffect } from 'react';

const tones = [
  'Clear and motivational',
  'Bold and persuasive',
  'Friendly and educational',
  'High-energy and punchy',
  'Satirical and witty',
  'Critical and analytical',
  'Movie review style',
  'Deep-dive commentary',
  'Investigative and skeptical',
  'Cultural criticism',
  'Documentary voice',
  'Comedic roast',
];

const durations = ['4 to 6 minutes', '60 seconds', '8 to 10 minutes', '12 to 15 minutes', '15 to 20 minutes'];

export default function ScriptForm({ currentItem, onGenerate, onToneChange }) {
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('Clear and motivational');
  const [duration, setDuration] = useState('4 to 6 minutes');
  const [objective, setObjective] = useState('');
  const [keyPoints, setKeyPoints] = useState('');
  const [callToAction, setCallToAction] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    onToneChange(tone);
  }, [tone, onToneChange]);

  useEffect(() => {
    setTopic(currentItem?.request?.topic || currentItem?.topic || '');
    setAudience(currentItem?.request?.audience || '');
    setTone(currentItem?.request?.tone || currentItem?.tone || 'Clear and motivational');
    setDuration(currentItem?.request?.duration || currentItem?.duration || '4 to 6 minutes');
    setObjective(currentItem?.request?.objective || '');
    setKeyPoints(currentItem?.request?.keyPoints || '');
    setCallToAction(currentItem?.request?.callToAction || '');
  }, [currentItem]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    try {
      await onGenerate({ topic: topic.trim(), audience: audience.trim(), tone, duration, objective: objective.trim(), keyPoints: keyPoints.trim(), callToAction: callToAction.trim() });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="glass-card form-panel" onSubmit={handleSubmit}>
      <div className="section-heading">
        <h2>Video Brief</h2>
        <p>Shape the angle before the model starts writing.</p>
      </div>

      <label>
        <span>Topic</span>
        <input
          name="topic"
          type="text"
          placeholder="Why modern horror movie trailers give away too much"
          required
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
      </label>

      <div className="split">
        <label>
          <span>Audience</span>
          <input
            name="audience"
            type="text"
            placeholder="Movie lovers, film students, and YouTube essay fans"
            required
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          />
        </label>
        <label>
          <span>Tone</span>
          <select name="tone" required value={tone} onChange={(e) => setTone(e.target.value)}>
            {tones.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
      </div>

      <div className="split">
        <label>
          <span>Duration</span>
          <select name="duration" required value={duration} onChange={(e) => setDuration(e.target.value)}>
            {durations.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label>
          <span>Goal</span>
          <input
            name="objective"
            type="text"
            placeholder="Drive comments and position the channel as smart but entertaining"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
          />
        </label>
      </div>

      <label>
        <span>Key points or facts</span>
        <textarea
          name="keyPoints"
          rows="5"
          placeholder="Mention spoiler-heavy marketing, audience trust, one recent film example, and how restraint can improve anticipation."
          value={keyPoints}
          onChange={(e) => setKeyPoints(e.target.value)}
        />
      </label>

      <label>
        <span>Call to action</span>
        <input
          name="callToAction"
          type="text"
          placeholder="Ask viewers to comment on the last trailer that spoiled a movie for them"
          value={callToAction}
          onChange={(e) => setCallToAction(e.target.value)}
        />
      </label>

      <button type="submit" className="primary-button" disabled={busy}>
        {busy ? 'Generating...' : 'Generate Script'}
      </button>
    </form>
  );
}
