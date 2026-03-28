import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { NETWORK_CONFIG, USER_ROLES } from '../constants/contracts';
import { emitTxConfirmedEvent, ensureSepoliaNetwork, getEscrowWriteContract } from '../utils/contracts';
import { metadataCidToHash, uploadMetadataToIPFS } from '../utils/ipfs';

const CheckCircleIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-green-600 mt-0.5" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.704-9.71a1 1 0 00-1.414-1.414L9 10.166 7.71 8.876a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
      clipRule="evenodd"
    />
  </svg>
);

const CREATE_FLOW_STEPS = [
  'Check Network',
  'Upload Metadata',
  'Create Milestone',
  'Confirm Creation',
  'Fund Escrow',
  'Confirm Funding',
];

const resolveCreateFlowStep = (status) => {
  if (!status) return 0;
  if (status.includes('Checking network')) return 1;
  if (status.includes('Uploading metadata')) return 2;
  if (status.includes('Creating milestone transaction')) return 3;
  if (status.includes('Waiting for milestone creation confirmation')) return 4;
  if (status.includes('Funding escrow')) return 5;
  if (status.includes('Waiting for funding confirmation')) return 6;
  if (status.includes('successfully')) return 6;
  return 0;
};

const getDraftStorageKey = (account) => `freelancechain:create-job-draft:${(account || 'unknown').toLowerCase()}`;

const BACK_FALLBACK_BY_ROLE = {
  [USER_ROLES.CLIENT]: '/my-jobs',
  [USER_ROLES.FREELANCER]: '/browse',
  [USER_ROLES.ARBITRATOR]: '/disputes',
};

const CreateJob = () => {
  const navigate = useNavigate();
  const { isConnected, connectWallet, userRole, provider, signer, account } = useWallet();
  const submitLockRef = useRef(false);
  const [formData, setFormData] = useState({
    freelancer: '',
    jobTitle: '',
    jobDescription: '',
    totalAmount: '',
    deadline: '',
    milestones: [
      { title: '', description: '', amount: '', deadline: '' },
    ],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState({ status: '', error: '', milestoneId: null, createTxHash: '', fundTxHash: '' });
  const [draftNotice, setDraftNotice] = useState({ type: '', message: '' });
  const progressPanelRef = useRef(null);
  const currentFlowStep = resolveCreateFlowStep(submitState.status);
  const showProgressPanel = Boolean(isSubmitting || submitState.status || submitState.error);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(BACK_FALLBACK_BY_ROLE[userRole] || '/my-jobs');
  };

  const scrollToProgress = () => {
    if (!progressPanelRef.current) {
      return;
    }

    progressPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (!account) {
      return;
    }

    try {
      const saved = localStorage.getItem(getDraftStorageKey(account));
      if (!saved) {
        return;
      }

      const parsed = JSON.parse(saved);
      if (parsed?.formData) {
        setFormData(parsed.formData);
        setDraftNotice({ type: 'info', message: 'Loaded your saved draft for this wallet.' });
      }
    } catch {
      setDraftNotice({ type: 'error', message: 'Could not load saved draft data.' });
    }
  }, [account]);

  useEffect(() => {
    if (isSubmitting) {
      scrollToProgress();
    }
  }, [isSubmitting]);

  const handleSaveDraft = () => {
    if (!account) {
      setDraftNotice({ type: 'error', message: 'Connect wallet first to save a draft.' });
      return;
    }

    try {
      const payload = {
        savedAt: Date.now(),
        formData,
      };
      localStorage.setItem(getDraftStorageKey(account), JSON.stringify(payload));
      setDraftNotice({ type: 'success', message: 'Draft saved locally in this browser.' });
    } catch {
      setDraftNotice({ type: 'error', message: 'Failed to save draft locally.' });
    }
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prevent duplicate on-chain posting from rapid double-click/enter submits.
    if (submitLockRef.current) {
      return;
    }
    submitLockRef.current = true;

    try {
      if (!provider || !signer) {
        throw new Error('Wallet signer not available. Reconnect MetaMask and try again.');
      }

      const firstMilestone = formData.milestones[0];
      if (!firstMilestone?.title || !firstMilestone?.description || !firstMilestone?.amount || !firstMilestone?.deadline) {
        throw new Error('Milestone title, description, amount, and deadline are required.');
      }

      if (!formData.jobTitle || !formData.jobDescription) {
        throw new Error('Job title and description are required.');
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
      const metadataPayload = {
        version: 1,
        createdAt: new Date().toISOString(),
        jobTitle: formData.jobTitle.trim(),
        jobDescription: formData.jobDescription.trim(),
        milestoneTitle: firstMilestone.title.trim(),
        milestoneDescription: firstMilestone.description.trim(),
        projectDeadline: formData.deadline,
        totalBudgetUSD: Number(formData.totalAmount),
        milestone: {
          amountUSD: Number(firstMilestone.amount),
          deadline: firstMilestone.deadline,
        },
      };

      setSubmitState({ status: 'Uploading metadata to IPFS...', error: '', milestoneId: Number(nextMilestoneId), createTxHash: '', fundTxHash: '' });
      const metadataCID = await uploadMetadataToIPFS(metadataPayload);
      const metadataHash = metadataCidToHash(metadataCID);

      setSubmitState({ status: 'Creating milestone transaction...', error: '', milestoneId: Number(nextMilestoneId), createTxHash: '', fundTxHash: '' });
      const createTx = await escrow.createMilestone(formData.freelancer, amountUSD, BigInt(deadlineTs), metadataHash, metadataCID);
      setSubmitState({ status: 'Waiting for milestone creation confirmation...', error: '', milestoneId: Number(nextMilestoneId), createTxHash: createTx.hash, fundTxHash: '' });
      await createTx.wait();

      const requiredETH = await escrow.getRequiredETH(nextMilestoneId);

      setSubmitState({ status: 'Funding escrow...', error: '', milestoneId: Number(nextMilestoneId), createTxHash: createTx.hash, fundTxHash: '' });
      const fundTx = await escrow.fundMilestone(nextMilestoneId, { value: requiredETH });
      setSubmitState({ status: 'Waiting for funding confirmation...', error: '', milestoneId: Number(nextMilestoneId), createTxHash: createTx.hash, fundTxHash: fundTx.hash });
      await fundTx.wait();

      emitTxConfirmedEvent({
        source: 'create-job',
        milestoneId: Number(nextMilestoneId),
        createTxHash: createTx.hash,
        fundTxHash: fundTx.hash,
      });

      if (account) {
        localStorage.removeItem(getDraftStorageKey(account));
      }
      setDraftNotice({ type: 'success', message: 'Draft cleared after successful on-chain posting.' });

      setSubmitState({ status: 'Milestone created and funded successfully.', error: '', milestoneId: Number(nextMilestoneId), createTxHash: createTx.hash, fundTxHash: fundTx.hash });
    } catch (error) {
      setSubmitState((prev) => ({
        ...prev,
        status: '',
        error: error?.shortMessage || error?.message || 'Transaction failed.',
      }));
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
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
        <p className="text-gray-600 mb-6">Posting a job is available for client wallets. Connect the client wallet to continue.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <button
        type="button"
        onClick={handleBack}
        className="btn-secondary mb-4"
      >
        Back
      </button>

      <h1 className="text-4xl font-bold text-gray-900 mb-2">Post a New Job</h1>
      <p className="text-gray-600 mb-8">Create one on-chain milestone with metadata and fund your escrow.</p>

      {showProgressPanel && (
        <div ref={progressPanelRef} className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Transaction Progress</h2>
            <span className="text-xs text-gray-600">
              Step {currentFlowStep || 1} / {CREATE_FLOW_STEPS.length}
            </span>
          </div>
          <div className="space-y-2">
            {CREATE_FLOW_STEPS.map((step, index) => {
              const stepNumber = index + 1;
              const isDone = currentFlowStep > stepNumber || (currentFlowStep === 6 && submitState.status.includes('successfully'));
              const isCurrent = currentFlowStep === stepNumber && !submitState.status.includes('successfully');
              return (
                <div key={step} className="flex items-center gap-3">
                  <div className={`h-6 w-6 rounded-full border text-xs font-semibold flex items-center justify-center ${isDone ? 'bg-green-500 border-green-500 text-white' : isCurrent ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-gray-100 border-gray-300 text-gray-500'}`}>
                    {stepNumber}
                  </div>
                  <p className={`text-sm ${isDone ? 'text-green-700 font-medium' : isCurrent ? 'text-blue-700 font-medium' : 'text-gray-600'}`}>
                    {step}
                  </p>
                </div>
              );
            })}
          </div>

          {(submitState.status || submitState.error || submitState.milestoneId !== null || submitState.createTxHash || submitState.fundTxHash) && (
            <div className={`mt-4 p-3 rounded-lg border ${submitState.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
              {submitState.status && <p className="text-sm font-medium text-gray-900 mb-1">{submitState.status}</p>}
              {submitState.milestoneId !== null && (
                <p className="text-xs text-gray-700 mb-1">Milestone ID: {submitState.milestoneId}</p>
              )}
              {submitState.createTxHash && (
                <p className="text-xs text-gray-700 break-all mb-1">
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
                <p className="text-xs text-gray-700 break-all mb-1">
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
        </div>
      )}

      {draftNotice.message && (
        <div className={`card mb-8 ${draftNotice.type === 'error' ? 'border border-red-200 bg-red-50' : draftNotice.type === 'success' ? 'border border-green-200 bg-green-50' : 'border border-blue-200 bg-blue-50'}`}>
          <p className={`text-sm ${draftNotice.type === 'error' ? 'text-red-700' : draftNotice.type === 'success' ? 'text-green-700' : 'text-blue-700'}`}>
            {draftNotice.message}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Job Info */}
        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Job Details</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700 mb-2">
                Job Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="jobTitle"
                name="jobTitle"
                value={formData.jobTitle}
                onChange={handleInputChange}
                placeholder="e.g., Full-Stack DApp Build"
                className="input-base"
                required
              />
            </div>

            <div>
              <label htmlFor="jobDescription" className="block text-sm font-medium text-gray-700 mb-2">
                Job Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="jobDescription"
                name="jobDescription"
                value={formData.jobDescription}
                onChange={handleInputChange}
                placeholder="Describe project scope, expected delivery, and acceptance criteria."
                className="input-base"
                rows="4"
                required
              />
            </div>

            <div>
              <label htmlFor="freelancer" className="block text-sm font-medium text-gray-700 mb-2">
                Freelancer Wallet Address <span className="text-red-500">*</span>
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="totalAmount" className="block text-sm font-medium text-gray-700 mb-2">
                  Total Budget (USDC) <span className="text-red-500">*</span>
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
                  Project Deadline <span className="text-red-500">*</span>
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
            <h2 className="text-2xl font-bold text-gray-900">Milestone</h2>
          </div>

          <div className="space-y-6">
            {formData.milestones.map((milestone, index) => (
              <div key={index} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-900">Milestone Details</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Milestone Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={milestone.title}
                      onChange={(e) => handleMilestoneChange(index, 'title', e.target.value)}
                      placeholder="e.g., Smart Contract + Frontend Delivery"
                      className="input-base"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Milestone Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={milestone.description}
                      onChange={(e) => handleMilestoneChange(index, 'description', e.target.value)}
                      placeholder="Describe the exact deliverables for this milestone."
                      className="input-base"
                      rows="3"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount (USDC) <span className="text-red-500">*</span>
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
                        Deadline <span className="text-red-500">*</span>
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
              <strong>Note:</strong> Current contract stores one on-chain milestone per post. Job and milestone metadata are uploaded to IPFS and linked on-chain.
            </p>
          </div>
        </div>

        {/* Escrow & Security */}
        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Escrow & Security</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <p className="flex items-start gap-2"><CheckCircleIcon /><span>Funds will be locked in a smart contract</span></p>
            <p className="flex items-start gap-2"><CheckCircleIcon /><span>Released to freelancer upon your milestone approval</span></p>
            <p className="flex items-start gap-2"><CheckCircleIcon /><span>Disputes can be raised if work doesn't meet expectations</span></p>
            <p className="flex items-start gap-2"><CheckCircleIcon /><span>You maintain full control until approval</span></p>
          </div>
        </div>

        {/* Submit */}
        {showProgressPanel && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={scrollToProgress}
              className="text-sm text-blue-700 hover:text-blue-800 underline"
            >
              Back to Progress
            </button>
          </div>
        )}

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
            onClick={handleSaveDraft}
            disabled={isSubmitting}
            className="flex-1 btn-secondary py-3 rounded-lg font-semibold"
          >
            {isSubmitting ? 'Saving Disabled While Posting' : 'Save Draft'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateJob;
