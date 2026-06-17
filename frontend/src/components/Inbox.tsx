import { useState, useEffect, useRef } from 'react';
import { Mail, Send, Sparkles, AlertCircle, Plus, X } from 'lucide-react';

interface InboxProps {
  token: string | null;
  API_URL: string;
}

export default function Inbox({ token, API_URL }: InboxProps) {
  const [threads, setThreads] = useState<any[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadDetail, setThreadDetail] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Drafting replies
  const [replyPrompt, setReplyPrompt] = useState('');
  const [replyDraft, setReplyDraft] = useState('');
  const [isDraftingReply, setIsDraftingReply] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);

  // Composing new email modal
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composePrompt, setComposePrompt] = useState('');
  const [isAiComposing, setIsAiComposing] = useState(false);
  const [isSendingNew, setIsSendingNew] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const messageEndRef = useRef<HTMLDivElement>(null);

  const categories = [
    'All',
    'Newsletters',
    'Job / Recruitment',
    'Finance',
    'Notifications',
    'Personal',
    'Work / Professional'
  ];

  // Retrieve initial category filter from dashboard if set
  useEffect(() => {
    const dashboardFilter = sessionStorage.getItem('selected_category_filter');
    if (dashboardFilter) {
      setActiveCategory(dashboardFilter);
      sessionStorage.removeItem('selected_category_filter'); // Clear it
    }
  }, []);

  const fetchThreads = async () => {
    if (!token) return;
    setIsLoadingList(true);
    try {
      const catQuery = activeCategory === 'All' ? '' : `?category=${encodeURIComponent(activeCategory)}`;
      const res = await fetch(`${API_URL}/api/emails/threads${catQuery}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load threads');
      const data = await res.json();
      setThreads(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, [token, activeCategory]);

  const fetchThreadDetail = async (threadId: string) => {
    if (!token) return;
    setIsLoadingDetail(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/emails/threads/${threadId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load thread details');
      const data = await res.json();
      setThreadDetail(data);
      setShowReplyForm(false);
      setReplyPrompt('');
      setReplyDraft('');
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load thread conversations.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (selectedThreadId) {
      fetchThreadDetail(selectedThreadId);
    } else {
      setThreadDetail(null);
    }
  }, [selectedThreadId]);

  // Scroll to bottom of detail pane on message updates
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [threadDetail, showReplyForm]);

  // AI draft generators
  const handleGenerateReplyDraft = async () => {
    if (!replyPrompt || !selectedThreadId || !token) return;
    setIsDraftingReply(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/emails/reply-draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: replyPrompt,
          threadId: selectedThreadId
        })
      });
      if (!res.ok) throw new Error('Draft generation failed');
      const data = await res.json();
      setReplyDraft(data.body);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to generate reply draft with AI.');
    } finally {
      setIsDraftingReply(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyDraft || !selectedThreadId || !token) return;
    setIsSendingReply(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/emails/send-reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          threadId: selectedThreadId,
          body: replyDraft
        })
      });
      if (!res.ok) throw new Error('Failed to send reply');
      
      // Refresh current thread detail automatically
      await fetchThreadDetail(selectedThreadId);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to dispatch reply email.');
    } finally {
      setIsSendingReply(false);
    }
  };

  // AI compose for new emails
  const handleAiCompose = async () => {
    if (!composePrompt || !token) return;
    setIsAiComposing(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/emails/compose-draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ prompt: composePrompt })
      });
      if (!res.ok) throw new Error('AI compose failed');
      const data = await res.json();
      setComposeSubject(data.subject);
      setComposeBody(data.body);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to compose email draft with AI.');
    } finally {
      setIsAiComposing(false);
    }
  };

  const handleSendNewEmail = async () => {
    if (!composeTo || !composeSubject || !composeBody || !token) return;
    setIsSendingNew(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/emails/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          to: composeTo,
          subject: composeSubject,
          body: composeBody
        })
      });
      if (!res.ok) throw new Error('Failed to send email');
      const data = await res.json();
      
      // Close modal and refresh threads list
      setShowComposeModal(false);
      resetComposeFields();
      await fetchThreads();
      if (data.threadId) {
        setSelectedThreadId(data.threadId);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to dispatch email.');
    } finally {
      setIsSendingNew(false);
    }
  };

  const resetComposeFields = () => {
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
    setComposePrompt('');
  };

  // Filter threads by search bar query
  const filteredThreads = threads.filter(t => {
    const searchLower = searchQuery.toLowerCase();
    return (
      (t.subject && t.subject.toLowerCase().includes(searchLower)) ||
      (t.sender && t.sender.toLowerCase().includes(searchLower)) ||
      (t.snippet && t.snippet.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="split-layout">
      {/* Threads List Pane */}
      <div className="list-pane">
        <div className="pane-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>Threads</h4>
            <button 
              className="new-chat-btn" 
              onClick={() => setShowComposeModal(true)}
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
            >
              <Plus size={14} />
              <span>Compose</span>
            </button>
          </div>
          <input 
            type="text" 
            placeholder="Search threads..." 
            className="action-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
          />
          <div className="category-filter-bar">
            {categories.map(cat => (
              <button
                key={cat}
                className={`filter-pill ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => {
                  setActiveCategory(cat);
                  setSelectedThreadId(null);
                }}
              >
                {cat.split(' ')[0]} {/* Shorten name for space */}
              </button>
            ))}
          </div>
        </div>

        <div className="thread-list-scroll">
          {isLoadingList ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '0.9rem' }}>
              Loading threads...
            </div>
          ) : filteredThreads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '0.9rem' }}>
              No threads found.
            </div>
          ) : (
            filteredThreads.map(t => (
              <div 
                key={t.id} 
                className={`thread-item ${selectedThreadId === t.id ? 'active' : ''}`}
                onClick={() => setSelectedThreadId(t.id)}
              >
                <div className="thread-item-header">
                  <span className="thread-sender">{t.lastSender}</span>
                  <span className="thread-date">
                    {new Date(t.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="thread-subject">{t.subject}</div>
                <div className="thread-snippet">{t.snippet}</div>
                <div className="thread-pills">
                  {t.categories.map((c: string) => (
                    <span 
                      key={c} 
                      className="category-pill"
                      style={{
                        backgroundColor: c === 'Newsletters' ? 'var(--accent-cyan-bg)' : 
                                         c === 'Job / Recruitment' ? 'var(--accent-purple-bg)' :
                                         c === 'Finance' ? 'var(--accent-green-bg)' :
                                         c === 'Notifications' ? 'var(--accent-orange-bg)' :
                                         c === 'Personal' ? 'rgba(99,102,241,0.15)' : 'var(--accent-red-bg)',
                        color: c === 'Newsletters' ? 'var(--accent-cyan)' : 
                               c === 'Job / Recruitment' ? 'var(--accent-purple)' :
                               c === 'Finance' ? 'var(--accent-green)' :
                               c === 'Notifications' ? 'var(--accent-orange)' :
                               c === 'Personal' ? 'var(--primary)' : 'var(--accent-red)'
                      }}
                    >
                      {c}
                    </span>
                  ))}
                  {t.messageCount > 1 && (
                    <span className="category-pill" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                      {t.messageCount} msg
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Thread Details Pane */}
      <div className="detail-pane">
        {selectedThreadId === null ? (
          <div className="empty-state">
            <Mail className="empty-state-icon" />
            <p style={{ fontSize: '0.95rem' }}>Select a thread to view conversation details</p>
          </div>
        ) : isLoadingDetail ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#64748b' }}>
            Loading thread content...
          </div>
        ) : threadDetail ? (
          <>
            <div className="detail-header">
              <div className="detail-subject">{threadDetail.messages[0]?.subject || 'No Subject'}</div>
              
              {threadDetail.summary && (
                <div className="ai-summary-box">
                  <div className="ai-summary-title">
                    <Sparkles size={14} style={{ color: 'var(--accent-cyan)' }} />
                    <span>AI Conversation Summary</span>
                  </div>
                  <p className="ai-summary-text">{threadDetail.summary}</p>
                </div>
              )}
            </div>

            <div className="message-list-scroll">
              {threadDetail.messages.map((msg: any) => (
                <div key={msg.id} className="message-card">
                  <div className="message-card-header">
                    <div>
                      <div className="sender-name">{msg.from_address}</div>
                      <div className="recipient-list">To: {msg.to_addresses?.join(', ')}</div>
                    </div>
                    <div className="message-date">
                      {new Date(msg.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  </div>
                  <div className="message-body">
                    {msg.body_text || msg.snippet}
                  </div>
                </div>
              ))}
              <div ref={messageEndRef} />
            </div>

            {/* Compose Reply Interface */}
            <div className="action-area">
              {errorMsg && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '0.82rem',
                  color: '#fca5a5'
                }}>
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {!showReplyForm ? (
                <button 
                  className="btn-primary" 
                  onClick={() => setShowReplyForm(true)}
                  style={{ alignSelf: 'flex-start' }}
                >
                  Reply to Thread
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                  <div className="prompt-input-row">
                    <input 
                      type="text" 
                      placeholder="Instruct AI to draft reply (e.g., 'Confirm my availability for Friday 3 PM')" 
                      className="action-input"
                      value={replyPrompt}
                      onChange={(e) => setReplyPrompt(e.target.value)}
                    />
                    <button 
                      className="btn-secondary" 
                      onClick={handleGenerateReplyDraft}
                      disabled={isDraftingReply || !replyPrompt}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Sparkles size={14} className={isDraftingReply ? 'syncing-spinner' : ''} />
                      {isDraftingReply ? 'Drafting...' : 'AI Draft'}
                    </button>
                  </div>

                  <textarea
                    className="action-input form-textarea"
                    placeholder="Draft reply content..."
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    style={{ minHeight: '120px' }}
                  />

                  <div style={{ display: 'flex', gap: '12px', alignSelf: 'flex-end' }}>
                    <button 
                      className="btn-secondary" 
                      onClick={() => {
                        setShowReplyForm(false);
                        setReplyDraft('');
                        setReplyPrompt('');
                      }}
                    >
                      Cancel
                    </button>
                    <button 
                      className="btn-primary" 
                      onClick={handleSendReply}
                      disabled={isSendingReply || !replyDraft}
                    >
                      <Send size={14} />
                      {isSendingReply ? 'Sending...' : 'Send Reply'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>

      {/* Compose New Email Modal */}
      {showComposeModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Compose New Email</h3>
              <button className="modal-close-btn" onClick={() => setShowComposeModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group" style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px dashed rgba(99, 102, 241, 0.3)', borderRadius: '8px', padding: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)' }}>
                  <Sparkles size={14} />
                  <span>AI Prompt Draft Helper</span>
                </label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <input 
                    type="text" 
                    placeholder="Write a follow-up to Stripe team..." 
                    className="action-input"
                    value={composePrompt}
                    onChange={(e) => setComposePrompt(e.target.value)}
                  />
                  <button 
                    className="btn-secondary" 
                    onClick={handleAiCompose}
                    disabled={isAiComposing || !composePrompt}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {isAiComposing ? 'Writing...' : 'Draft'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>To</label>
                <input 
                  type="email" 
                  placeholder="recipient@example.com" 
                  className="form-input"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                />
              </div>
              
              <div className="form-group">
                <label>Subject</label>
                <input 
                  type="text" 
                  placeholder="Project Status Update" 
                  className="form-input"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Body</label>
                <textarea 
                  placeholder="Hi there..." 
                  className="form-input form-textarea"
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowComposeModal(false)}>
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={handleSendNewEmail}
                disabled={isSendingNew || !composeTo || !composeSubject || !composeBody}
              >
                <Send size={14} />
                {isSendingNew ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
