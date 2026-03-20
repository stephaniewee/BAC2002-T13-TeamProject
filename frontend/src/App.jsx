import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WalletProvider } from './contexts/WalletContext';
import { useWallet } from './hooks/useWallet';
import { USER_ROLES } from './constants/contracts';
import Header from './components/Header';
import Home from './pages/Home';
import BrowseJobs from './pages/BrowseJobs';
import JobDetail from './pages/JobDetail';
import CreateJob from './pages/CreateJob';
import Disputes from './pages/Disputes';
import MyJobs from './pages/MyJobs';

const RoleGate = ({ allowedRoles, children, title }) => {
  const { isConnected, userRole } = useWallet();

  if (!isConnected) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="card text-center py-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Wallet Required</h2>
          <p className="text-gray-600">Connect MetaMask to access this page.</p>
        </div>
      </div>
    );
  }

  if (!allowedRoles.includes(userRole)) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="card text-center py-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Role Access Restricted</h2>
          <p className="text-gray-600 mb-3">{title} is not available for your current role.</p>
          <p className="text-sm text-gray-500">Switch role from the header if you are testing flows.</p>
        </div>
      </div>
    );
  }

  return children;
};

function App() {
  return (
    <WalletProvider>
      <Router>
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-1 bg-gray-50">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route
                path="/browse"
                element={(
                  <RoleGate
                    title="Browse Jobs"
                    allowedRoles={[USER_ROLES.FREELANCER, USER_ROLES.CLIENT, USER_ROLES.ARBITRATOR]}
                  >
                    <BrowseJobs />
                  </RoleGate>
                )}
              />
              <Route path="/jobs/:id" element={<JobDetail />} />
              <Route
                path="/my-jobs"
                element={(
                  <RoleGate
                    title="My Jobs"
                    allowedRoles={[USER_ROLES.CLIENT, USER_ROLES.FREELANCER, USER_ROLES.ARBITRATOR]}
                  >
                    <MyJobs />
                  </RoleGate>
                )}
              />
              <Route
                path="/create-job"
                element={(
                  <RoleGate title="Create Job" allowedRoles={[USER_ROLES.CLIENT]}>
                    <CreateJob />
                  </RoleGate>
                )}
              />
              <Route
                path="/disputes"
                element={(
                  <RoleGate
                    title="Disputes"
                    allowedRoles={[USER_ROLES.CLIENT, USER_ROLES.FREELANCER, USER_ROLES.ARBITRATOR]}
                  >
                    <Disputes />
                  </RoleGate>
                )}
              />
            </Routes>
          </main>
        </div>
      </Router>
    </WalletProvider>
  );
}

export default App;
