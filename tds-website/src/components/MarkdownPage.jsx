import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import 'highlight.js/styles/atom-one-dark.css';

// Slugify function for heading IDs
const slugify = (str) =>
    String(str)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

export default function MarkdownPage() {
    const params = useParams();
    const pageId = params['*'];
    const [content, setContent] = useState('Loading...');
    const [nav, setNav] = useState({ prev: null, next: null });

    useEffect(() => {
        window.scrollTo(0, 0);
        const pageIdBase = pageId ? pageId.split('#')[0] : '';
        const currentPath = pageIdBase ? `/${pageIdBase}` : '/';

        // Fetch sidebar navigation array
        fetch('/docs/_sidebar.md')
            .then(res => res.text())
            .then(text => {
                const lines = text.split('\n');
                const links = [];
                lines.forEach(line => {
                    const match = line.match(/\[(.*?)\]\((.*?)\)/);
                    if (match && !match[2].startsWith('http')) {
                        let linkTarget = match[2].split('#')[0].replace('.md', '');
                        if (linkTarget === 'README') linkTarget = '';
                        links.push({ title: match[1], path: `/${linkTarget}` });
                    }
                });

                const currentIndex = links.findIndex(l => l.path === currentPath);
                if (currentIndex >= 0) {
                    setNav({
                        prev: currentIndex > 0 ? links[currentIndex - 1] : null,
                        next: currentIndex < links.length - 1 ? links[currentIndex + 1] : null
                    });
                } else {
                    setNav({ prev: null, next: null });
                }
            })
            .catch(err => console.error(err));

        const filename = pageIdBase ? `${pageIdBase}.md` : 'README.md';
        fetch(`/docs/${filename}`)
            .then(res => {
                if (!res.ok) throw new Error('Not Found');
                return res.text();
            })
            .then(text => {
                setContent(text);
            })
            .catch(() => setContent('# 404\nPage not found.'));
    }, [pageId]);

    useEffect(() => {
        if (window.location.hash.includes('#')) {
            const id = window.location.hash.split('#').pop();
            const el = document.getElementById(id);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        }
    }, [content]);

    const extractText = (children) => {
        if (typeof children === 'string') return children;
        if (Array.isArray(children)) return children.map(extractText).join('');
        if (children && children.props && children.props.children) return extractText(children.props.children);
        return '';
    };

    return (
        <div className="markdown-body">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeHighlight]}
                components={{
                    h2: ({ node, ...props }) => {
                        const id = slugify(extractText(props.children));
                        return <h2 id={id} {...props} />;
                    },
                    h3: ({ node, ...props }) => {
                        const id = slugify(extractText(props.children));
                        return <h3 id={id} {...props} />;
                    },
                    img: ({ node, ...props }) => {
                        let src = props.src;
                        if (src && !src.startsWith('http') && !src.startsWith('/docs/')) {
                            src = `/docs/${src}`;
                        }
                        return <img {...props} src={src} />;
                    },
                    a: ({ node, ...props }) => {
                        const href = props.href || '';
                        if (href.startsWith('http')) {
                            return <a target="_blank" rel="noreferrer" {...props} />;
                        }
                        if (href.startsWith('#')) {
                            return <a {...props} onClick={(e) => {
                                e.preventDefault();
                                document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
                            }} />;
                        }

                        // Internal relative markdown links
                        let target = href.replace('.md', '');
                        let finalPath = '';
                        if (target.startsWith('/')) {
                            finalPath = target;
                        } else {
                            const currentDir = pageId ? pageId.split('/').slice(0, -1).join('/') : '';
                            finalPath = currentDir ? `/${currentDir}/${target}` : `/${target}`;
                        }
                        return <Link to={finalPath} {...props} />;
                    }
                }}
            >
                {content}
            </ReactMarkdown>

            <div className="page-navigation">
                {nav.prev ? (
                    <Link to={nav.prev.path} className="nav-btn prev">
                        &larr; Previous<br />
                        <span className="nav-title">{nav.prev.title}</span>
                    </Link>
                ) : <div className="nav-spacer"></div>}

                {nav.next ? (
                    <Link to={nav.next.path} className="nav-btn next">
                        Next &rarr;<br />
                        <span className="nav-title">{nav.next.title}</span>
                    </Link>
                ) : <div className="nav-spacer"></div>}
            </div>
        </div>
    );
}
