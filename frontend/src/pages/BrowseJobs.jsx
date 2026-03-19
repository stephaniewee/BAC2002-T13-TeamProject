import React, { useState } from 'react';
import JobCard from '../components/JobCard';

const BrowseJobs = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState('all');

  // Mock data - replace with actual API calls
  const jobs = [
    {
      id: 1,
      title: 'UI Design for SaaS Dashboard',
      description: 'Create a modern dashboard UI with dark mode support',
      amount: 1500,
      milestones: 3,
      status: 'open',
      clientTier: 'GOLD',
      skills: ['Figma', 'UI Design', 'Prototyping'],
    },
    {
      id: 2,
      title: 'Smart Contract Audit',
      description: 'Audit our ERC-20 token contract for security vulnerabilities',
      amount: 3000,
      milestones: 2,
      status: 'open',
      clientTier: 'SILVER',
      skills: ['Solidity', 'Security', 'Testing'],
    },
    {
      id: 3,
      title: 'React Component Library',
      description: 'Build reusable React components with Tailwind CSS',
      amount: 2500,
      milestones: 4,
      status: 'open',
      clientTier: 'BRONZE',
      skills: ['React', 'Tailwind', 'Storybook'],
    },
    {
      id: 4,
      title: 'API Integration Service',
      description: 'Integrate third-party payment APIs into our platform',
      amount: 1200,
      milestones: 2,
      status: 'open',
      clientTier: 'NEW',
      skills: ['Node.js', 'APIs', 'Integration'],
    },
  ];

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = filterTier === 'all' || job.clientTier === filterTier;
    return matchesSearch && matchesTier;
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Browse Available Gigs</h1>
        <p className="text-gray-600">Find your next freelance opportunity and start earning USDC</p>
      </div>

      <div className="card mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Jobs</label>
            <input
              type="text"
              placeholder="Search by title, description, or skills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Client Tier</label>
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value)}
              className="input-base"
            >
              <option value="all">All Tiers</option>
              <option value="NEW">New</option>
              <option value="BRONZE">Bronze</option>
              <option value="SILVER">Silver</option>
              <option value="GOLD">Gold</option>
            </select>
          </div>
        </div>
      </div>

      {filteredJobs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg">No jobs found matching your criteria.</p>
          <p className="text-gray-500 mt-2">Try adjusting your filters or search terms.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
};

export default BrowseJobs;
