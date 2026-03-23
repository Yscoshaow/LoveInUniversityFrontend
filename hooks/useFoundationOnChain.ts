import { useQuery } from '@tanstack/react-query';
import { createPublicClient, http, formatUnits } from 'viem';
import { base } from 'viem/chains';

// Base chain USDC contract
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const FOUNDATION_WALLET = '0x00c14Cfd3716591727bBC9233D7aA4DFbc6EA3BF' as const;
const USDC_DECIMALS = 6;

const BLOCKSCOUT_API = 'https://base.blockscout.com/api/v2';

// Create a viem public client for Base chain
const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

// ERC20 balanceOf ABI
const erc20BalanceOfAbi = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export interface OnChainTransfer {
  txHash: string;
  from: string;
  to: string;
  value: string; // formatted USDC amount
  rawValue: bigint;
  blockNumber: bigint;
  timestamp?: number;
  isIncoming: boolean; // true = someone sent TO our wallet
}

/**
 * Fetch USDC balance of the foundation wallet via viem RPC
 */
async function fetchUSDCBalance(): Promise<string> {
  const balance = await client.readContract({
    address: USDC_ADDRESS,
    abi: erc20BalanceOfAbi,
    functionName: 'balanceOf',
    args: [FOUNDATION_WALLET],
  } as unknown as Parameters<typeof client.readContract>[0]);
  return formatUnits(balance as bigint, USDC_DECIMALS);
}

interface BlockscoutTransfer {
  block_number: number;
  from: { hash: string };
  to: { hash: string };
  token: { address_hash: string; decimals: string };
  total: { decimals: string; value: string };
  transaction_hash: string;
  timestamp: string;
}

/**
 * Fetch USDC transfer history via Blockscout API
 */
async function fetchUSDCTransfers(): Promise<OnChainTransfer[]> {
  const url = `${BLOCKSCOUT_API}/addresses/${FOUNDATION_WALLET}/token-transfers?type=ERC-20&token=${USDC_ADDRESS}`;
  const response = await fetch(url);
  const data = await response.json();

  if (!data.items || !Array.isArray(data.items)) {
    return [];
  }

  return data.items.map((tx: BlockscoutTransfer) => {
    const rawValue = BigInt(tx.total.value);
    const decimals = parseInt(tx.total.decimals) || USDC_DECIMALS;
    const isIncoming = tx.to.hash.toLowerCase() === FOUNDATION_WALLET.toLowerCase();
    return {
      txHash: tx.transaction_hash,
      from: tx.from.hash,
      to: tx.to.hash,
      value: formatUnits(rawValue, decimals),
      rawValue,
      blockNumber: BigInt(tx.block_number),
      timestamp: new Date(tx.timestamp).getTime(),
      isIncoming,
    };
  });
}

/**
 * Hook: USDC balance of foundation wallet
 */
export function useFoundationBalance() {
  return useQuery({
    queryKey: ['foundation', 'onchain', 'balance'],
    queryFn: fetchUSDCBalance,
    staleTime: 60 * 1000, // 1 min
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/**
 * Hook: USDC transfer history
 */
export function useFoundationTransfers() {
  return useQuery({
    queryKey: ['foundation', 'onchain', 'transfers'],
    queryFn: fetchUSDCTransfers,
    staleTime: 2 * 60 * 1000, // 2 min
    gcTime: 10 * 60 * 1000,
  });
}

export { FOUNDATION_WALLET, USDC_ADDRESS };
