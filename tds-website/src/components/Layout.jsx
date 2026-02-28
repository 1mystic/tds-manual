import Header from './Header';
import SidebarLeft from './SidebarLeft';
import SidebarRight from './SidebarRight';
import { Outlet } from 'react-router-dom';

export default function Layout() {
    return (
        <>
            <Header />
            <div className="layout-main">
                <div className="sidebar">
                    <SidebarLeft />
                </div>
                <div className="content-area">
                    <Outlet />
                </div>
                <div className="toc-sidebar">
                    <SidebarRight />
                </div>
            </div>
        </>
    );
}
