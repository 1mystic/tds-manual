import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function SidebarRight() {
    const [headings, setHeadings] = useState([]);
    const location = useLocation();

    useEffect(() => {
        // Wait for markdown render
        const timeout = setTimeout(() => {
            const elHeadings = document.querySelectorAll('.markdown-body h2, .markdown-body h3');
            const items = Array.from(elHeadings).map(el => ({
                id: el.id,
                text: el.innerText,
                level: el.tagName === 'H2' ? 2 : 3
            }));
            setHeadings(items);
        }, 500);

        return () => clearTimeout(timeout);
    }, [location.pathname]);

    if (headings.length === 0) return null;

    return (
        <div>
            <div className="toc-title">On this page</div>
            <nav>
                {headings.map((h, i) => (
                    <a
                        key={i}
                        href={`#${h.id}`}
                        className={`toc-link level-${h.level}`}
                        onClick={(e) => {
                            e.preventDefault();
                            document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' });
                        }}
                    >
                        {h.text}
                    </a>
                ))}
            </nav>
        </div>
    );
}
