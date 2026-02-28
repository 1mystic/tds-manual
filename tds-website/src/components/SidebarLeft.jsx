import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

export default function SidebarLeft() {
    const [navItems, setNavItems] = useState([]);

    useEffect(() => {
        fetch('/docs/_sidebar.md')
            .then(res => res.text())
            .then(text => {
                const lines = text.split('\n');
                const items = [];
                let currentSection = { title: 'Tools in Data Science', links: [] };

                lines.forEach(line => {
                    if (!line.trim()) return;

                    // Match main sections: - [Title](link.md)
                    const mainMatch = line.match(/^- \[(.*?)\]\((.*?)\)/);
                    if (mainMatch) {
                        if (currentSection.links.length > 0 || currentSection.title) {
                            items.push(currentSection);
                        }
                        const linkTarget = mainMatch[2] === 'README.md' ? '/' : `/${mainMatch[2].replace('.md', '')}`;
                        currentSection = {
                            title: mainMatch[1],
                            mainLink: linkTarget,
                            links: []
                        };
                    } else {
                        // Match sub sections:   - [Title](link.md)
                        const subMatch = line.match(/^  - \[(.*?)\]\((.*?)\)/);
                        if (subMatch) {
                            const linkTarget = `/${subMatch[2].replace('.md', '')}`;
                            currentSection.links.push({
                                title: subMatch[1],
                                link: linkTarget
                            });
                        }
                    }
                });
                if (currentSection.title) items.push(currentSection);
                setNavItems(items);
            });
    }, []);

    return (
        <nav>
            {navItems.map((section, idx) => (
                <div key={idx} className="nav-section">
                    {section.mainLink ? (
                        <NavLink
                            to={section.mainLink}
                            className={({ isActive }) => `nav-section-title nav-link ${isActive ? 'active' : ''}`}
                            end={section.mainLink === '/'}
                        >
                            {section.title}
                        </NavLink>
                    ) : (
                        <div className="nav-section-title">{section.title}</div>
                    )}

                    {section.links.length > 0 && (
                        <div className="nav-links-container">
                            {section.links.map((link, lidx) => (
                                <NavLink
                                    key={lidx}
                                    to={link.link}
                                    className={({ isActive }) => `nav-link sub-link ${isActive ? 'active' : ''}`}
                                >
                                    {link.title}
                                </NavLink>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </nav>
    );
}
