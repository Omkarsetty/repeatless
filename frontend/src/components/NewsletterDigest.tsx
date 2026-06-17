import { useState, useEffect } from 'react';
import { Newspaper, Calendar, Sparkles, X, User, MessageSquare } from 'lucide-react';

interface NewsletterDigestProps {
  token: string | null;
  API_URL: string;
}

export default function NewsletterDigest({ token, API_URL }: NewsletterDigestProps) {
  const [digestDays, setDigestDays] = useState(7);
  const [stories, setStories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Source Email Preview
  const [selectedSourceEmail, setSelectedSourceEmail] = useState<any>(null);

  const fetchDigest = async (daysVal = digestDays) => {
    if (!token) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/newsletters/digest?days=${daysVal}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load digest');
      const data = await res.json();
      setStories(data);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to compile news digest.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDigest();
  }, [token, digestDays]);

  const handleOpenSourceEmail = async (emailId: string, threadId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/emails/threads/${threadId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load thread details');
      const data = await res.json();
      
      const matchedMsg = data.messages.find((m: any) => m.id === emailId);
      if (matchedMsg) {
        setSelectedSourceEmail(matchedMsg);
      }
    } catch (err) {
      console.error('Failed to load newsletter source email:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflow: 'hidden' }}>
      {/* Timeframe Controls */}
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px' }}>
        <div style={{ display: 'flex', alignTracks: 'center', gap: '10px' }}>
          <div style={{ color: 'var(--accent-cyan)' }}>
            <Sparkles size={18} />
          </div>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Semantically deduplicating overlaps across newsletter sources
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Timeframe:</label>
          <select 
            className="action-input"
            value={digestDays} 
            onChange={(e) => setDigestDays(parseInt(e.target.value, 10))}
            style={{ padding: '6px 12px', fontSize: '0.85rem', width: '120px' }}
          >
            <option value={1}>Past 24 Hours</option>
            <option value={4}>Past 4 Days</option>
            <option value={7}>Past 7 Days</option>
            <option value={14}>Past 14 Days</option>
            <option value={30}>Past 30 Days</option>
          </select>
        </div>
      </div>

      {/* Stories list */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
            Compiling and deduplicating news digest...
          </div>
        ) : errorMsg ? (
          <div style={{ color: 'var(--accent-red)', padding: '24px', textAlign: 'center' }}>
            {errorMsg}
          </div>
        ) : stories.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px',
            color: 'var(--text-muted)',
            textAlign: 'center'
          }}>
            <Newspaper size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
            <p style={{ fontSize: '0.95rem' }}>No newsletter articles found in this timeframe.</p>
          </div>
        ) : (
          stories.map((story, index) => (
            <div key={index} className="glass-card newsletter-story-card">
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                {story.title}
              </h3>
              <p style={{ fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                {story.summary}
              </p>
              
              {story.sources && story.sources.length > 0 && (
                <div className="story-sources-attribution">
                  <span className="story-sources-label">Carried By:</span>
                  {story.sources.map((src: any) => (
                    <button 
                      key={src.email_id}
                      className="source-pill"
                      onClick={() => handleOpenSourceEmail(src.email_id, src.thread_id)}
                      title={`Inspect "${src.subject}"`}
                    >
                      {src.from.split('<')[0].trim() || 'Newsletter'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Source Email Preview Modal */}
      {selectedSourceEmail && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Newspaper size={16} style={{ color: 'var(--accent-cyan)' }} />
                <span>Newsletter Source Article</span>
              </h3>
              <button className="modal-close-btn" onClick={() => setSelectedSourceEmail(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}>
                  <User size={14} style={{ color: 'var(--text-muted)' }} />
                  <strong>From:</strong> <span style={{ color: 'var(--text-primary)' }}>{selectedSourceEmail.from_address}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}>
                  <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                  <strong>Date:</strong> <span style={{ color: 'var(--text-primary)' }}>{new Date(selectedSourceEmail.date).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}>
                  <MessageSquare size={14} style={{ color: 'var(--text-muted)' }} />
                  <strong>Subject:</strong> <span style={{ color: 'var(--text-primary)' }}>{selectedSourceEmail.subject}</span>
                </div>
              </div>
              <div style={{
                maxHeight: '300px',
                overflowY: 'auto',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '6px',
                padding: '16px',
                fontSize: '0.88rem',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                color: 'var(--text-secondary)'
              }}>
                {selectedSourceEmail.body_text || selectedSourceEmail.snippet}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedSourceEmail(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
