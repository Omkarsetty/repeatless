import { Newspaper, Briefcase, DollarSign, Bell, User, Landmark, Sparkles, Send } from 'lucide-react';

interface DashboardProps {
  stats: {
    email: string;
    lastSyncTime: string | null;
    totalCount: number;
    categories: Record<string, number>;
  } | null;
  onNavigate: (tab: 'dashboard' | 'inbox' | 'chat' | 'newsletters') => void;
}

export default function Dashboard({ stats, onNavigate }: DashboardProps) {
  // Map category names to icons and styles
  const categoryConfigs: Record<string, { icon: any; colorClass: string; desc: string }> = {
    'Newsletters': {
      icon: Newspaper,
      colorClass: 'newsletters',
      desc: 'Subscription digests, blogs, and marketing newsletters.'
    },
    'Job / Recruitment': {
      icon: Briefcase,
      colorClass: 'job',
      desc: 'Job applications, interview requests, and recruiter updates.'
    },
    'Finance': {
      icon: DollarSign,
      colorClass: 'finance',
      desc: 'Bank transactions, Supabase invoices, and receipts.'
    },
    'Notifications': {
      icon: Bell,
      colorClass: 'notifications',
      desc: 'System automated alerts, OTP verification codes, and signups.'
    },
    'Personal': {
      icon: User,
      colorClass: 'personal',
      desc: 'Direct human-to-human personal emails and chats.'
    },
    'Work / Professional': {
      icon: Landmark,
      colorClass: 'work',
      desc: 'Work coordination threads, calendar notices, and project plans.'
    }
  };

  const handleCategoryClick = (categoryName: string) => {
    // Save filter in session storage so Inbox component can pick it up!
    sessionStorage.setItem('selected_category_filter', categoryName);
    onNavigate('inbox');
  };

  if (!stats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
        Loading dashboard insights...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Overview stats cards */}
      <div className="stats-grid">
        <div className="glass-card stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)' }}>
            <Sparkles size={24} />
          </div>
          <div className="stat-info">
            <h4>Intelligence Status</h4>
            <div className="stat-value" style={{ fontSize: '1.25rem' }}>Active Engine</div>
          </div>
        </div>
        
        <div className="glass-card stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-cyan)' }}>
            <Landmark size={24} />
          </div>
          <div className="stat-info">
            <h4>Total Synced Emails</h4>
            <div className="stat-value">{stats.totalCount}</div>
          </div>
        </div>

        <div className="glass-card stat-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('chat')}>
          <div className="stat-icon-wrapper" style={{ background: 'rgba(168, 85, 247, 0.1)', color: 'var(--accent-purple)' }}>
            <Send size={24} />
          </div>
          <div className="stat-info">
            <h4>Ask Agent Anything</h4>
            <div className="stat-value" style={{ fontSize: '1.1rem', color: 'var(--accent-purple)' }}>Chat Agent &rarr;</div>
          </div>
        </div>
      </div>

      {/* Category boxes list */}
      <div className="categories-container">
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 600, marginBottom: '20px' }}>
          Categorized Inbox Folders
        </h3>
        
        <div className="categories-grid">
          {Object.entries(categoryConfigs).map(([name, conf]) => {
            const IconComponent = conf.icon;
            const count = stats.categories[name] || 0;

            return (
              <div 
                key={name}
                className={`glass-card category-card ${conf.colorClass}`}
                onClick={() => handleCategoryClick(name)}
              >
                <div className="category-header">
                  <div>
                    <span className="category-title">{name}</span>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.4, paddingRight: '20px' }}>
                      {conf.desc}
                    </p>
                  </div>
                  <div style={{ color: `var(--accent-${conf.colorClass})`, padding: '4px' }}>
                    <IconComponent size={20} />
                  </div>
                </div>
                <div className="category-count">
                  {count}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
