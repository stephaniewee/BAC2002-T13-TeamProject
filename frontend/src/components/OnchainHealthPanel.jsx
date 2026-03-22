import React, { useEffect, useMemo, useState } from 'react';
import { isAddress } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { CONTRACT_ADDRESSES, NETWORK_CONFIG } from '../constants/contracts';
import { getDisputeReadContract } from '../utils/contracts';

const OK = 'ok';
const WARN = 'warn';
const FAIL = 'fail';

const STATUS_STYLE = {
    [OK]: 'text-green-700 bg-green-50 border-green-200',
    [WARN]: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    [FAIL]: 'text-red-700 bg-red-50 border-red-200',
};

const statusLabel = (status) => {
    if (status === OK) return 'OK';
    if (status === WARN) return 'Warning';
    return 'Fail';
};

const addrs = [
    ['Escrow', CONTRACT_ADDRESSES.ESCROW],
    ['DisputeResolver', CONTRACT_ADDRESSES.DISPUTE_RESOLVER],
    ['ReputationSBT', CONTRACT_ADDRESSES.REPUTATION_SBT],
    ['ChainlinkPriceFeed', CONTRACT_ADDRESSES.CHAINLINK_PRICE_FEED],
];

const OnchainHealthPanel = () => {
    const { provider, account, isConnected } = useWallet();
    const [checks, setChecks] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isConnected || !provider) {
            setChecks([]);
            return;
        }

        const runChecks = async () => {
            setLoading(true);
            const nextChecks = [];

            try {
                const network = await provider.getNetwork();
                const chainMatches = Number(network.chainId) === NETWORK_CONFIG.CHAIN_ID;
                nextChecks.push({
                    label: 'Connected network',
                    status: chainMatches ? OK : FAIL,
                    detail: chainMatches
                        ? `Sepolia (${NETWORK_CONFIG.CHAIN_ID})`
                        : `Unexpected chain id ${Number(network.chainId)}`,
                });

                for (const [label, address] of addrs) {
                    if (!isAddress(address)) {
                        nextChecks.push({
                            label: `${label} address format`,
                            status: FAIL,
                            detail: `Invalid address: ${address || 'missing'}`,
                        });
                        continue;
                    }

                    const code = await provider.getCode(address);
                    const hasCode = code && code !== '0x';
                    nextChecks.push({
                        label: `${label} deployed bytecode`,
                        status: hasCode ? OK : FAIL,
                        detail: hasCode ? address : 'No contract code found at address',
                    });
                }

                try {
                    const dispute = getDisputeReadContract(provider);
                    const arbitrator = await dispute.isArbitrator(account);
                    nextChecks.push({
                        label: 'Connected wallet arbitrator role',
                        status: arbitrator ? OK : WARN,
                        detail: arbitrator
                            ? 'Wallet is arbitrator'
                            : 'Wallet is not arbitrator (expected for client/freelancer)',
                    });
                } catch (error) {
                    nextChecks.push({
                        label: 'Arbitrator role check',
                        status: WARN,
                        detail: error?.shortMessage || error?.message || 'Could not query role',
                    });
                }
            } catch (error) {
                nextChecks.push({
                    label: 'Health check runner',
                    status: FAIL,
                    detail: error?.shortMessage || error?.message || 'Health checks failed',
                });
            }

            setChecks(nextChecks);
            setLoading(false);
        };

        runChecks();
    }, [provider, account, isConnected]);

    const summary = useMemo(() => {
        const failed = checks.filter((c) => c.status === FAIL).length;
        const warned = checks.filter((c) => c.status === WARN).length;

        if (failed > 0) {
            return { label: `${failed} failed check(s)`, className: STATUS_STYLE[FAIL] };
        }

        if (warned > 0) {
            return { label: `${warned} warning(s)`, className: STATUS_STYLE[WARN] };
        }

        return { label: 'All checks passed', className: STATUS_STYLE[OK] };
    }, [checks]);

    if (!isConnected) {
        return null;
    }

    return (
        <section className="card mb-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <h2 className="text-xl font-bold text-gray-900">On-Chain Health Check</h2>
                <div className={`px-3 py-1 rounded-full text-sm font-medium border ${summary.className}`}>
                    {loading ? 'Running checks...' : summary.label}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {checks.map((check) => (
                    <div key={check.label} className={`rounded-lg border px-3 py-2 ${STATUS_STYLE[check.status]}`}>
                        <p className="text-sm font-semibold">{check.label}</p>
                        <p className="text-xs mt-1">{statusLabel(check.status)} · {check.detail}</p>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default OnchainHealthPanel;
