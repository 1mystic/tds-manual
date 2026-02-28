import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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

    useEffect(() => {
        const pageIdBase = pageId ? pageId.split('#')[0] : '';
        const filename = pageIdBase ? `${pageIdBase}.md` : 'README.md';
        fetch(`/docs/${filename}`)
            .then(res => {
                if (!res.ok) throw new Error('Not Found');
                return res.text();
            })
            .then(text => {
                // Fix image paths
                const imageFixed = text.replace(/\]\((?!http)(.*?)\)/g, '](/docs/$1)');
                setContent(imageFixed);
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

    return (
        <div className="markdown-body">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeHighlight]}
                components={{
                    h2: ({ node, ...props }) => {
                        const id = slugify(props.children[0]);
                        return <h2 id={id} {...props} />;
                    },
                    h3: ({ node, ...props }) => {
                        const id = slugify(props.children[0]);
                        return <h3 id={id} {...props} />;
                    }
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
