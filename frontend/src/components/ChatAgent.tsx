import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Plus, Trash2, Sparkles, ExternalLink, Calendar, User, Mail, X } from 'lucide-react';

interface ChatAgentProps {
  token: string | null;
  API_URL: string;
}

export default function ChatAgent({ token, API_URL }: ChatAgentProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [promptInput, setPromptInput] = useState('');
  const [isSendingPrompt, setIsSendingPrompt] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Source Email Preview Modal
  const [selectedSourceEmail, setSelectedSourceEmail] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchSessions = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/chat/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load chat sessions');
      const data = await res.json();
      setSessions(data);
      if (data.length > 0 && !activeSessionId) {
        setActiveSessionId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const createSession = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/chat/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: 'New Conversation' })
      });
      if (!res.ok) throw new Error('Failed to create session');
      const session = await res.json();
      setSessions(prev => [session, ...prev]);
      setActiveSessionId(session.id);
      setMessages([]);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering active session click
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete session');
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMessages = async (sessionId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/chat/messages/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load messages');
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [token]);

  useEffect(() => {
    if (activeSessionId) {
      fetchMessages(activeSessionId);
    }
  }, [activeSessionId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSendingPrompt]);

  const handleSendPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim() || !activeSessionId || !token || isSendingPrompt) return;

    const userMsg = promptInput;
    setPromptInput('');
    setIsSendingPrompt(true);
    setErrorMsg(null);

    // Optimistically insert user bubble
    const tempUserMsg = { id: 'temp-user', role: 'user', content: userMsg, sources: [] };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await fetch(`${API_URL}/api/chat/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId: activeSessionId,
          prompt: userMsg
        })
      });

      if (!res.ok) throw new Error('Agent failed to complete');
      await res.json();

      // Replace optimistic layout or refresh messages list
      await fetchMessages(activeSessionId);
      
      // Update session title list if it was a new session
      await fetchSessions();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to generate agent response.');
    } finally {
      setIsSendingPrompt(false);
    }
  };

  // Inspect specific cited email
  const handleOpenSourceEmail = async (emailId: string) => {
    if (!token) return;
    setSelectedSourceEmail(null);
    try {
      // Find thread details or message details. Let's fetch using a specific database lookup in backend!
      // In emails.ts we have /api/threads/:id, but we also can get thread messages, and filter to emailId
      // Let's call /api/threads and get the email details!
      // To simplify, let's fetch the thread and scan for the matching message ID:
      const sourceMeta = messages
        .flatMap(m => m.sources || [])
        .find(s => s.email_id === emailId);
      
      if (!sourceMeta?.thread_id) return;

      const res = await fetch(`${API_URL}/api/emails/threads/${sourceMeta.thread_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load thread details for source');
      const data = await res.json();
      
      const matchedMsg = data.messages.find((m: any) => m.id === emailId);
      if (matchedMsg) {
        setSelectedSourceEmail(matchedMsg);
      }
    } catch (err) {
      console.error('Failed to load citation email content:', err);
    }
  };

  return (
    <div className="chat-pane">
      {/* Sessions sidebar */}
      <div className="chat-sessions-list">
        <div className="sessions-header">
          <button className="new-chat-btn" onClick={createSession}>
            <Plus size={16} />
            <span>New Chat</span>
          </button>
        </div>
        <div className="sessions-scroll">
          {sessions.map(s => (
            <div 
              key={s.id} 
              className={`session-item ${activeSessionId === s.id ? 'active' : ''}`}
              onClick={() => setActiveSessionId(s.id)}
            >
              <span className="session-title">{s.title}</span>
              <button className="session-delete-btn" onClick={(e) => deleteSession(s.id, e)}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat interface */}
      <div className="chat-center">
        {activeSessionId === null ? (
          <div className="empty-state">
            <MessageSquare className="empty-state-icon" />
            <p>Start a new conversation session to query your emails</p>
          </div>
        ) : (
          <>
            <div className="chat-messages-area">
              {messages.length === 0 && !isSendingPrompt ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  color: 'var(--text-secondary)',
                  textAlign: 'center',
                  padding: '40px',
                  lineHeight: 1.6
                }}>
                  <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '50%', marginBottom: '16px', color: 'var(--primary)' }}>
                    <Sparkles size={28} />
                  </div>
                  <h4 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Ask about your Emails
                  </h4>
                  <p style={{ maxWidth: '400px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                    Ask queries like: "Summarize all emails from Acme Corp", "Which companies rejected me?", or "What do we know about Kubernetes?"
                  </p>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`chat-bubble-row ${msg.role}`}>
                    <div className="chat-bubble">
                      <div style={{ whiteSpace: 'pre-wrap' }}>
                        {msg.content}
                      </div>

                      {/* Display Citations */}
                      {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                        <div className="sources-citation-block">
                          <div className="sources-citation-title">Sources Reference Citations:</div>
                          <div className="citation-badge-list">
                            {msg.sources.map((src: any, index: number) => (
                              <button 
                                key={src.email_id}
                                className="citation-badge"
                                onClick={() => handleOpenSourceEmail(src.email_id)}
                                title={`Open referenced email: ${src.subject}`}
                              >
                                <ExternalLink size={10} />
                                <span>[{index + 1}] {src.from.split('<')[0].trim()} - "{src.subject.length > 20 ? `${src.subject.slice(0, 18)}...` : src.subject}"</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {isSendingPrompt && (
                <div className="chat-bubble-row assistant">
                  <div className="chat-bubble" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                    <Sparkles size={14} className="syncing-spinner" />
                    <span>Agent is thinking & searching emails...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {errorMsg && (
              <div style={{
                margin: '0 32px 12px 32px',
                padding: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                fontSize: '0.85rem',
                color: '#fca5a5'
              }}>
                {errorMsg}
              </div>
            )}

            <div className="chat-input-bar">
              <form onSubmit={handleSendPrompt} className="chat-input-form">
                <input 
                  type="text" 
                  placeholder="Ask a question about your email records..." 
                  className="action-input"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  disabled={isSendingPrompt}
                />
                <button 
                  type="submit" 
                  className="btn-primary" 
                  disabled={isSendingPrompt || !promptInput.trim()}
                >
                  <Send size={14} />
                  <span>Send</span>
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Source Email Preview Modal */}
      {selectedSourceEmail && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={16} style={{ color: 'var(--primary)' }} />
                <span>Reference Source Details</span>
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
