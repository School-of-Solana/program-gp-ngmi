import { useQuery } from '@tanstack/react-query';
import { Address } from 'gill';
import { PublicKey } from '@solana/web3.js';
import { fetchMaybeVault } from '@/lib/codama/accounts';
import { deriveVaultPda } from '@/lib/derive-vault-pda';
import { useSolana } from '@/components/solana/use-solana';

export function useVaultAccountQuery(authority: PublicKey | null) {
  const { client, cluster } = useSolana();

  return useQuery({
    queryKey: [
      'raffle-vault-account',
      {
        cluster,  //cluster: cluster.slug ?? cluster.label ?? 'unknown',
        authority: authority?.toBase58() ?? 'none',
      },
    ],
    enabled: Boolean(authority && client),
    queryFn: async () => {
      const [vaultPda] = deriveVaultPda(authority!);
      const account = await fetchMaybeVault(
        client.rpc,
        vaultPda.toBase58() as Address<string>
      );
      return { vaultPda, account };
    },
  });
}