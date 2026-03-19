import React from 'react';
import { useWallet } from '../hooks/useWallet';

const Home = () => {
  const { isConnected, connectWallet } = useWallet();

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
        <div className="max-w-2xl mx-auto text-center text-white px-6">
          <h1 className="text-5xl font-bold mb-6">FreelanceChain</h1>
          <h2 className="text-2xl font-semibold mb-4">Decentralized Freelance Platform</h2>
          <p className="text-lg mb-8 opacity-90">
            Connect with freelancers and clients trustlessly through smart contracts.
            No middleman. No hidden fees. Instant payments.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-6">
              <div className="text-3xl mb-3">💰</div>
              <h3 className="font-semibold mb-2">Secure Escrow</h3>
              <p className="text-sm opacity-80">Your funds are protected by smart contracts</p>
            </div>
            <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-6">
              <div className="text-3xl mb-3">🏆</div>
              <h3 className="font-semibold mb-2">Reputation System</h3>
              <p className="text-sm opacity-80">Soulbound tokens prove your track record</p>
            </div>
            <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-6">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="font-semibold mb-2">Instant Settlement</h3>
              <p className="text-sm opacity-80">Get paid immediately upon completion</p>
            </div>
          </div>

          <button
            onClick={connectWallet}
            className="btn-primary bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 text-lg font-semibold rounded-lg"
          >
            Connect MetaMask to Get Started
          </button>

          <div className="mt-12 text-sm opacity-75">
            <p>Currently running on Sepolia Testnet</p>
            <p>Make sure you have testnet ETH and USDC</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's what's happening with your jobs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <div className="card">
          <p className="text-gray-600 text-sm mb-2">Active Jobs</p>
          <p className="text-3xl font-bold text-gray-900">3</p>
        </div>
        <div className="card">
          <p className="text-gray-600 text-sm mb-2">Pending Disputes</p>
          <p className="text-3xl font-bold text-gray-900">0</p>
        </div>
        <div className="card">
          <p className="text-gray-600 text-sm mb-2">Total Earned</p>
          <p className="text-3xl font-bold text-gray-900">5,420 USDC</p>
        </div>
        <div className="card">
          <p className="text-gray-600 text-sm mb-2">Reputation Tier</p>
          <p className="text-3xl font-bold text-yellow-600">Gold ★</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Activity</h2>
          <div className="space-y-4">
            <div className="card border-l-4 border-l-green-500">
              <div className="flex justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Logo Design</h3>
                  <p className="text-sm text-gray-600">Milestone approved by client</p>
                </div>
                <span className="text-sm font-semibold text-green-600">+500 USDC</span>
              </div>
            </div>
            <div className="card border-l-4 border-l-blue-500">
              <div className="flex justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Website Redesign</h3>
                  <p className="text-sm text-gray-600">You applied to this job</p>
                </div>
                <span className="text-sm text-gray-500">2 days ago</span>
              </div>
            </div>
            <div className="card border-l-4 border-l-yellow-500">
              <div className="flex justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Mobile App Design</h3>
                  <p className="text-sm text-gray-600">Waiting for your submission</p>
                </div>
                <span className="text-sm text-yellow-600">Pending</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
          <div className="space-y-3">
            <button className="w-full btn-primary py-3 rounded-lg font-semibold">
              Post a New Job
            </button>
            <button className="w-full btn-secondary py-3 rounded-lg font-semibold">
              Browse Available Gigs
            </button>
            <button className="w-full btn-secondary py-3 rounded-lg font-semibold">
              View My Profile
            </button>
            <button className="w-full btn-secondary py-3 rounded-lg font-semibold">
              Check Disputes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
