import { useState, useEffect } from 'react';
import Header from './Header';
import SidebarLeft from './SidebarLeft';
import SidebarRight from './SidebarRight';
import Footer from './Footer';
import { Outlet, useLocation } from 'react-router-dom';

export default function Layout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const location = useLocation();

    // Close mobile sidebar on route change
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [location.pathname]);

    return (
        <>
            <Header toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
            <div className="layout-main">
                {isSidebarOpen && (
                    <div
                        className="mobile-overlay"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}
                <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
                    <SidebarLeft />
                </div>
                <div className="content-area">
                    <Outlet />
                </div>
                <div className="toc-sidebar">
                    <SidebarRight />
                </div>
            </div>
            <Footer />
        </>
    );
}
