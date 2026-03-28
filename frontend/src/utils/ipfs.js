import { id } from 'ethers';

const DEFAULT_GATEWAY = 'https://ipfs.io/ipfs/';

const getGatewayBase = () => {
    const configured = (import.meta.env.VITE_IPFS_GATEWAY || '').trim();
    if (!configured) {
        return DEFAULT_GATEWAY;
    }

    return configured.endsWith('/') ? configured : `${configured}/`;
};

const normalizeCid = (cid) => String(cid || '').trim();

const metadataCache = new Map();

export const metadataCidToHash = (cid) => {
    const normalized = normalizeCid(cid);
    if (!normalized) {
        return id('');
    }

    return id(normalized);
};

export const buildIpfsUrl = (cid) => `${getGatewayBase()}${normalizeCid(cid)}`;

export const fetchMetadataFromCID = async (cid) => {
    const normalized = normalizeCid(cid);
    if (!normalized) {
        return null;
    }

    if (metadataCache.has(normalized)) {
        return metadataCache.get(normalized);
    }

    const response = await fetch(buildIpfsUrl(normalized));
    if (!response.ok) {
        throw new Error(`Unable to fetch metadata from IPFS (status ${response.status}).`);
    }

    const data = await response.json();
    metadataCache.set(normalized, data);
    return data;
};

export const uploadMetadataToIPFS = async (metadata) => {
    const pinataJwt = (import.meta.env.VITE_PINATA_JWT || '').trim();
    if (!pinataJwt) {
        throw new Error('VITE_PINATA_JWT is missing. Configure it to upload metadata.');
    }

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${pinataJwt}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            pinataMetadata: {
                name: metadata?.jobTitle || 'freelancechain-metadata',
            },
            pinataContent: metadata,
        }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.IpfsHash) {
        const reason = payload?.error?.details || payload?.error || payload?.message || 'Unknown Pinata error';
        throw new Error(`IPFS upload failed: ${reason}`);
    }

    return payload.IpfsHash;
};
