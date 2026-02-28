import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';

export default function Header() {
  return (
    <header>
      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <Link to="/" style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-main)', marginRight: '2rem' }}>
          TDS Manual
        </Link>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{ 
            background: 'var(--bg-color)', 
            padding: '0.5rem 1rem', 
            borderRadius: '20px', 
            display: 'flex', 
            alignItems: 'center',
            width: '400px',
            border: '1px solid var(--border-color)'
          }}>
            <Search size={16} color="var(--text-muted)" style={{ marginRight: '8px' }} />
            <input 
              type="text" 
              placeholder="Search documentation (coming soon...)" 
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                width: '100%',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <Link to="/" style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 500 }}>Community</Link>
          <a href="https://github.com/gramener/tools-in-data-science-public" target="_blank" rel="noreferrer" style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 500 }}>GitHub</a>
        </div>
      </div>
    </header>
  );
}
