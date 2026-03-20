import React, { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { NETWORK_CONFIG, USER_ROLES } from '../constants/contracts';
import { ensureSepoliaNetwork, getEscrowWriteContract } from '../utils/contracts';

const CreateJob = () => {
  const { isConnected, connectWallet, userRole, provider, signer } = useWallet();
  const [formData, setFormData] = useState({
    freelancer: '',
    title: '',
    description: '',
    totalAmount: '',
    deadline: '',
    milestones: [
      { title: '', description: '', amount: '', deadline: '' },
    ],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState({ status: '', error: '', milestoneId: null, createTxHash: '', fundTxHash: '' });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleMilestoneChange = (index, field, value) => {
    const newMilestones = [...formData.milestones];
    newMilestones[index][field] = value;
    setFormData(prev => ({
      ...prev,
      milestones: newMilestones,
    }));
  };

  const addMilestone = () => {
    setFormData(prev => ({
      ...prev,
      milestones: [...prev.milestones, { title: '', description: '', amount: '', deadline: '' }],
    }));
  };

  const removeMilestone = (index) => {
    setFormData(prev => ({
      ...prev,
      milestones: prev.milestones.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (!provider || !signer) {
        throw new Error('Wallet signer not available. Reconnect MetaMask and try again.');
      }

      const firstMilestone = formData.milestones[0];
      if (!firstMilestone?.amount || !firstMilestone?.deadline) {
        throw new Error('At least one milestone amount and deadline are required.');
      }

      const amountUSD = BigInt(Math.round(Number(firstMilestone.amount) * 1e8));
      if (amountUSD <= 0n) {
        throw new Error('Milestone amount must be greater than zero.');
      }

      const deadlineTs = Math.floor(new Date(firstMilestone.deadline).getTime() / 1000);
      if (!deadlineTs || deadlineTs <= Math.floor(Date.now() / 1000)) {
        throw new Error('Milestone deadline must be in the future.');
      }

      setIsSubmitting(true);
      setSubmitState({ status: 'Checking network...', error: '', milestoneId: null, createTxHash: '', fundTxHash: '' });

      await ensureSepoliaNetwork(provider);
      const escrow = getEscrowWriteContract(signer);

      const nextMilestoneId = await escrow.milestoneCount();

      setSubmitState({ status: 'Creating milestone transaction...', error: '', milestoneId: Number(nextMilestoneId), createTxHash: '', fundTxHash: '' });
      const createTx = await escrow.createMilestone(formData.freelancer, amountUSD, BigInt(deadlineTs));
      setSubmitState({ status: 'Waiting for milestone creation confirmation...', error: '', milestoneId: Number(nextMilestoneId), createTxHash: createTx.hash, fundTxHash: '' });
      await createTx.wait();

      const requiredETH = await escrow.getRequiredETH(nextMilestoneId);

      setSubmitState({ status: 'Funding escrow...', error: '', milestoneId: Number(nextMilestoneId), createTxHash: createTx.hash, fundTxHash: '' });
      const fundTx = await escrow.fundMilestone(nextMilestoneId, { value: requiredETH });
      setSubmitState({ status: 'Waiting for funding confirmation...', error: '', milestoneId: Number(nextMilestoneId), createTxHash: createTx.hash, fundTxHash: fundTx.hash });
      await fundTx.wait();

      setSubmitState({ status: 'Milestone created and funded successfully.', error: '', milestoneId: Number(nextMilestoneId), createTxHash: createTx.hash, fundTxHash: fundTx.hash });
    } catch (error) {
      setSubmitState((prev) => ({
        ...prev,
        status: '',
        error: error?.shortMessage || error?.message || 'Transaction failed.',
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Post a New Job</h1>
        <p className="text-gray-600 mb-6">Connect your wallet to post a job and start finding freelancers.</p>
        <button onClick={connectWallet} className="btn-primary px-8 py-3">Connect Wallet</button>
      </div>
    );
  }

  if (userRole !== USER_ROLES.CLIENT) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Client Role Required</h1>
        <p className="text-gray-600 mb-6">Posting a job is available for clients. Switch your role in the header for testing.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-2">Post a New Job</h1>
      <p className="text-gray-600 mb-8">Create a job with multiple milestones and fund your escrow</p>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Job Info */}
        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Job Details</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="freelancer" className="block text-sm font-medium text-gray-700 mb-2">
                Freelancer Wallet Address
              </label>
              <input
                type="text"
                id="freelancer"
                name="freelancer"
                value={formData.freelancer}
                onChange={handleInputChange}
                placeholder="0x..."
                className="input-base"
                required
              />
            </div>

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Job Title
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="e.g., UI Design for SaaS Dashboard"
                className="input-base"
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Job Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe the project, requirements, and expectations..."
                className="input-base"
                rows="6"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="totalAmount" className="block text-sm font-medium text-gray-700 mb-2">
                  Total Budget (USDC)
                </label>
                <input
                  type="number"
                  id="totalAmount"
                  name="totalAmount"
                  value={formData.totalAmount}
                  onChange={handleInputChange}
                  placeholder="1500"
                  className="input-base"
                  required
                />
              </div>

              <div>
                <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 mb-2">
                  Project Deadline
                </label>
                <input
                  type="date"
                  id="deadline"
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleInputChange}
                  className="input-base"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Milestones */}
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Milestones</h2>
            <button
              type="button"
              onClick={addMilestone}
              className="btn-secondary text-sm"
            >
              + Add Milestone
            </button>
          </div>

          <div className="space-y-6">
            {formData.milestones.map((milestone, index) => (
              <div key={index} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-900">Milestone {index + 1}</h3>
                  {formData.milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMilestone(index)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Milestone Title
                    </label>
                    <input
                      type="text"
                      value={milestone.title}
                      onChange={(e) => handleMilestoneChange(index, 'title', e.target.value)}
                      placeholder="e.g., Wireframes & User Flow"
                      className="input-base"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={milestone.description}
                      onChange={(e) => handleMilestoneChange(index, 'description', e.target.value)}
                      placeholder="What should be delivered?"
                      className="input-base"
                      rows="3"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount (USDC)
                      </label>
                      <input
                        type="number"
                        value={milestone.amount}
                        onChange={(e) => handleMilestoneChange(index, 'amount', e.target.value)}
                        placeholder="500"
                        className="input-base"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Deadline
                      </label>
                      <input
                        type="date"
                        value={milestone.deadline}
                        onChange={(e) => handleMilestoneChange(index, 'deadline', e.target.value)}
                        className="input-base"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-700">
              <strong>Budget Breakdown:</strong> Sum of milestone amounts must equal total budget
            </p>
          </div>
        </div>

        {/* Escrow & Security */}
        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Escrow & Security</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <p>✓ Funds will be locked in a smart contract</p>
            <p>✓ Released to freelancer upon your milestone approval</p>
            <p>✓ Disputes can be raised if work doesn't meet expectations</p>
            <p>✓ You maintain full control until approval</p>
          </div>
        </div>

        {(submitState.status || submitState.error) && (
          <div className={`card ${submitState.error ? 'border border-red-200 bg-red-50' : 'border border-green-200 bg-green-50'}`}>
            {submitState.status && <p className="text-sm font-medium text-gray-900 mb-2">{submitState.status}</p>}
            {submitState.milestoneId !== null && (
              <p className="text-xs text-gray-600 mb-1">Milestone ID: {submitState.milestoneId}</p>
            )}
            {submitState.createTxHash && (
              <p className="text-xs text-gray-600 break-all mb-1">
                Create tx: {submitState.createTxHash}{' '}
                <a
                  href={`${NETWORK_CONFIG.EXPLORER_URL}/tx/${submitState.createTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  View
                </a>
              </p>
            )}
            {submitState.fundTxHash && (
              <p className="text-xs text-gray-600 break-all">
                Fund tx: {submitState.fundTxHash}{' '}
                <a
                  href={`${NETWORK_CONFIG.EXPLORER_URL}/tx/${submitState.fundTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  View
                </a>
              </p>
            )}
            {submitState.error && <p className="text-sm text-red-700">{submitState.error}</p>}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 btn-primary py-3 rounded-lg font-semibold"
          >
            {isSubmitting ? 'Submitting...' : 'Post Job & Fund Escrow'}
          </button>
          <button
            type="button"
            className="flex-1 btn-secondary py-3 rounded-lg font-semibold"
          >
            Save Draft
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateJob;
