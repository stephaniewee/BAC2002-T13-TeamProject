import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WalletProvider } from './contexts/WalletContext';
import Header from './components/Header';
import Home from './pages/Home';
import BrowseJobs from './pages/BrowseJobs';
import JobDetail from './pages/JobDetail';
import CreateJob from './pages/CreateJob';
import Disputes from './pages/Disputes';

function App() {
  return (
    <WalletProvider>
      <Router>
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-1 bg-gray-50">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/browse" element={<BrowseJobs />} />
              <Route path="/jobs/:id" element={<JobDetail />} />
              <Route path="/create-job" element={<CreateJob />} />
              <Route path="/disputes" element={<Disputes />} />
            </Routes>
          </main>
        </div>
      </Router>
    </WalletProvider>
  );
}

export default App;
