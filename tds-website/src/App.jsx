import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import MarkdownPage from './components/MarkdownPage';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* using HashRouter for easy github pages deploy without server routing config */}
          <Route index element={<MarkdownPage />} />
          <Route path="*" element={<MarkdownPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
