import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Inbox from './components/Inbox';
import ChatAgent from './components/ChatAgent';
import NewsletterDigest from './components/NewsletterDigest';
import { Mail, RefreshCw, AlertCircle } from 'lucide-react';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('jwt_token'));
  const [_userId, setUserId] = useState<string | null>(localStorage.getItem('user_id'));
  const [email, setEmail] = useState<string | null>(localStorage.getItem('user_email'));
  
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'inbox' | 'chat' | 'newsletters'>('dashboard');
  const [isSyncing, setIsSyncing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Set API base URL (VITE_API_URL can be set during Vercel deployment)
  // Dynamically resolve local network host (e.g., accessed via phone on http://<laptop-ip>:3000)
  const API_URL = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : 'https://repeatless.onrender.com');

  // Listen for Google OAuth successful messages
  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.origin !== API_URL) return;
      if (event.data?.type === 'AUTH_SUCCESS') {
        const { token: jwtToken, userId: uid, email: uEmail } = event.data;
        saveAuthSession(jwtToken, uid, uEmail);
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, []);

  // Fetch email count statistics
  const fetchStats = async (authToken = token) => {
    if (!authToken) return;
    try {
      const res = await fetch(`${API_URL}/api/emails/stats`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error('Failed to load stats');
      const data = await res.json();
      setStats(data);
      setErrorMsg(null);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setErrorMsg('Could not connect to the backend server. Please verify the backend is running.');
    }
  };

  useEffect(() => {
    if (token) {
      fetchStats();
    }
  }, [token]);

  const saveAuthSession = (jwtToken: string, uid: string, uEmail: string) => {
    localStorage.setItem('jwt_token', jwtToken);
    localStorage.setItem('user_id', uid);
    localStorage.setItem('user_email', uEmail);
    setToken(jwtToken);
    setUserId(uid);
    setEmail(uEmail);
    fetchStats(jwtToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    setToken(null);
    setUserId(null);
    setEmail(null);
    setStats(null);
    setCurrentTab('dashboard');
  };

  const handleGoogleLogin = () => {
    setErrorMsg(null);
    const width = 500;
    const height = 650;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    window.open(
      `${API_URL}/api/auth/google`,
      'Google OAuth Auth',
      `width=${width},height=${height},left=${left},top=${top}`
    );
  };

  const handleMockLogin = async () => {
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/mock-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error('Mock login request failed');
      const data = await res.json();
      saveAuthSession(data.token, data.userId, data.email);
    } catch (err) {
      console.error('Mock login failed:', err);
      setErrorMsg('Failed to initialize demo sandbox. Please check backend connection.');
    }
  };

  const handleSyncNow = async () => {
    if (isSyncing || !token) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_URL}/api/emails/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Sync failed');
      await fetchStats();
      // Reload current tab content indirectly if needed
      // By resetting active tab slightly or letting components refresh via states
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!token) {
    return (
      <div className="login-screen" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: '#0b0d19',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        color: '#f8fafc',
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.1) 0%, transparent 60%)'
      }}>
        <div className="login-box glass-card" style={{
          width: '420px',
          padding: '40px',
          textAlign: 'center',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: '16px',
          backgroundColor: 'rgba(22, 28, 54, 0.7)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7)'
        }}>
          <div style={{ display: 'inline-flex', padding: '16px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '16px', marginBottom: '20px' }}>
            <Mail size={40} className="logo-icon" />
          </div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>
            Gmail Intelligence
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: '32px' }}>
            Connect your Gmail inbox for secure, AI-driven summarization, classification, and RAG conversational assistance.
          </p>

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
              color: '#fca5a5',
              marginBottom: '24px',
              textAlign: 'left',
              lineHeight: 1.4
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button 
              onClick={handleGoogleLogin} 
              className="btn-primary" 
              style={{ justifyContent: 'center', padding: '14px', borderRadius: '8px', fontSize: '0.95rem' }}
            >
              Connect with Gmail OAuth
            </button>
            <button 
              onClick={handleMockLogin} 
              className="btn-secondary" 
              style={{ justifyContent: 'center', padding: '14px', borderRadius: '8px', fontSize: '0.95rem' }}
            >
              Start Offline Demo Sandbox
            </button>
          </div>
          <div style={{ marginTop: '24px', fontSize: '0.75rem', color: '#64748b' }}>
            Demo mode seeds test emails to review search and summaries instantly.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Sidebar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        userEmail={email || ''} 
        onLogout={handleLogout} 
      />
      
      <div className="main-content">
        <header className="top-header">
          <div className="header-title" style={{ textTransform: 'capitalize' }}>
            {currentTab === 'chat' ? 'AI Chat Agent' : currentTab === 'newsletters' ? 'Newsletter Digest' : currentTab}
          </div>
          <div className="sync-status-indicator">
            {stats && stats.lastSyncTime && (
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Synced: {new Date(stats.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button 
              className="sync-btn" 
              onClick={handleSyncNow} 
              disabled={isSyncing}
            >
              <RefreshCw size={14} className={isSyncing ? 'syncing-spinner' : ''} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </header>
        
        <div className="content-body" style={{ display: 'flex', flexDirection: 'column' }}>
          {currentTab === 'dashboard' && (
            <Dashboard stats={stats} onNavigate={setCurrentTab} />
          )}
          {currentTab === 'inbox' && (
            <Inbox token={token} API_URL={API_URL} />
          )}
          {currentTab === 'chat' && (
            <ChatAgent token={token} API_URL={API_URL} />
          )}
          {currentTab === 'newsletters' && (
            <NewsletterDigest token={token} API_URL={API_URL} />
          )}
        </div>
      </div>
    </div>
  );
}
