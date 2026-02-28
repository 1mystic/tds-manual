import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Menu } from 'lucide-react';

export default function Header({ toggleSidebar }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchIndex, setSearchIndex] = useState([]);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const modalRef = useRef(null);
  const navigate = useNavigate();

  // Close modal when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [modalRef]);

  // Load search index lazily
  const loadSearchIndex = async () => {
    if (searchIndex.length > 0) return;
    setIsLoading(true);
    try {
      const res = await fetch('/docs/_sidebar.md');
      const text = await res.text();
      const lines = text.split('\n');
      const links = [];

      lines.forEach(line => {
        const match = line.match(/\[(.*?)\]\((.*?)\)/);
        if (match && !match[2].startsWith('http')) {
          let linkTarget = match[2].split('#')[0];
          links.push({ title: match[1], file: linkTarget, path: linkTarget.replace('.md', '') });
        }
      });

      // Fetch all markdown files content
      const index = await Promise.all(links.map(async (link) => {
        try {
          const mdRes = await fetch(`/docs/${link.file}`);
          const mdText = await mdRes.text();
          return { ...link, content: mdText.toLowerCase() };
        } catch (e) {
          return null;
        }
      }));

      setSearchIndex(index.filter(Boolean));
    } catch (e) {
      console.error("Failed to load search index", e);
    }
    setIsLoading(false);
  };

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    setIsOpen(true);
    const q = query.toLowerCase();

    // Find matches
    const matches = [];
    for (const doc of searchIndex) {
      if (doc.title.toLowerCase().includes(q) || doc.content.includes(q)) {
        // finding a snippet
        const idx = doc.content.indexOf(q);
        let snippet = '';
        if (idx !== -1) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(doc.content.length, idx + 40);
          snippet = "..." + doc.content.slice(start, end).replace(/\n/g, ' ') + "...";
        }
        matches.push({ ...doc, snippet });
      }
      if (matches.length >= 8) break; // Limit results
    }
    setResults(matches);
  };

  const navigateToDoc = (path) => {
    if (path === 'README') navigate('/');
    else navigate(`/${path}`);
    setIsOpen(false);
    setSearchQuery('');
  };
  return (
    <header>
      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <button
          className="mobile-menu-btn"
          onClick={toggleSidebar}
        >
          <Menu size={24} />
        </button>
        <Link to="/" className="site-title-link" style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-main)', marginRight: '2rem', display: 'flex', alignItems: 'center' }}>
          <span className="title-full">Tools in Data Science</span>
          <span className="title-short" style={{ display: 'none' }}>TDS</span>
        </Link>
        <div className="header-search-wrapper" style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div ref={modalRef} className="search-container" style={{ position: 'relative' }}>
            <div style={{
              background: 'var(--bg-color)',
              padding: '0.5rem 1rem',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              width: '400px',
              border: '1px solid var(--border-color)',
              boxShadow: isOpen ? '0 0 0 2px var(--accent-color)' : 'none',
              transition: 'box-shadow 0.2s'
            }}>
              <Search size={16} color="var(--text-muted)" style={{ marginRight: '8px' }} />
              <input
                type="text"
                placeholder="Search documentation..."
                value={searchQuery}
                onFocus={() => { loadSearchIndex(); if (searchQuery.length >= 2) setIsOpen(true); }}
                onChange={handleSearch}
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

            {/* Search Modal */}
            {isOpen && (
              <div style={{
                position: 'absolute',
                top: '120%',
                left: 0,
                right: 0,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '0.5rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                zIndex: 1000,
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                {isLoading && searchIndex.length === 0 ? (
                  <div style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>Loading index...</div>
                ) : results.length > 0 ? (
                  results.map((r, i) => (
                    <div
                      key={i}
                      onClick={() => navigateToDoc(r.path)}
                      style={{
                        padding: '0.8rem',
                        cursor: 'pointer',
                        borderBottom: i < results.length - 1 ? '1px solid var(--border-color)' : 'none',
                        transition: 'background 0.2s',
                        borderRadius: '4px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--accent-color)' }}>{r.title}</div>
                      {r.snippet && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>{r.snippet}</div>}
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>No results found</div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '1.5rem' }}>
          <a href="https://discourse.onlinedegree.iitm.ac.in/c/courses/tds-kb/34" target="_blank" rel="noreferrer" style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 500 }}>Community</a>
          <a href="https://github.com/sanand0/tools-in-data-science-public" target="_blank" rel="noreferrer" style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 500 }}>GitHub</a>
        </div>
      </div>
    </header>
  );
}
