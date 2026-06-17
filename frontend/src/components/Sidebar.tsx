import { LayoutDashboard, Inbox, MessageSquare, Newspaper, LogOut, MailCheck } from 'lucide-react';

interface SidebarProps {
  currentTab: 'dashboard' | 'inbox' | 'chat' | 'newsletters';
  setCurrentTab: (tab: 'dashboard' | 'inbox' | 'chat' | 'newsletters') => void;
  userEmail: string;
  onLogout: () => void;
}

export default function Sidebar({ currentTab, setCurrentTab, userEmail, onLogout }: SidebarProps) {
  const getInitials = (email: string) => {
    if (!email) return 'U';
    return email.charAt(0).toUpperCase();
  };

  return (
    <aside className="sidebar">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', flex: 1 }}>
        <div className="logo-section">
          <MailCheck className="logo-icon" />
          <span className="logo-text">MailIntel AI</span>
        </div>
        
        <nav className="nav-links">
          <button 
            className={`nav-item ${currentTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentTab('dashboard')}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>
          
          <button 
            className={`nav-item ${currentTab === 'inbox' ? 'active' : ''}`}
            onClick={() => setCurrentTab('inbox')}
          >
            <Inbox size={18} />
            <span>Inbox & Threads</span>
          </button>
          
          <button 
            className={`nav-item ${currentTab === 'chat' ? 'active' : ''}`}
            onClick={() => setCurrentTab('chat')}
          >
            <MessageSquare size={18} />
            <span>AI Chat Agent</span>
          </button>
          
          <button 
            className={`nav-item ${currentTab === 'newsletters' ? 'active' : ''}`}
            onClick={() => setCurrentTab('newsletters')}
          >
            <Newspaper size={18} />
            <span>Newsletter Digest</span>
          </button>
        </nav>
      </div>

      <div className="user-profile">
        <div className="user-avatar">
          {getInitials(userEmail)}
        </div>
        <div className="user-info">
          <div className="user-email" title={userEmail}>
            {userEmail}
          </div>
        </div>
        <button className="logout-btn" onClick={onLogout} title="Log Out">
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
}
