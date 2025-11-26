import { useQuery } from '@tanstack/react-query';
import { useSolana } from '@/components/solana/use-solana';
import { RAFFLE_VAULT_PROGRAM_ADDRESS } from '@/lib/codama/programs';
//import { RAFFLE_VAULT_PROGRAM_ADDRESS } from '@/lib/program-ids';

export function useGetProgramAccountQuery() {
  const { client, cluster } = useSolana();

  return useQuery({
    queryKey: [
      'raffle-vault-program-account',
      { cluster }
      //{ cluster: cluster.slug ?? cluster.label ?? 'unknown' },
    ],
    enabled: Boolean(client),
    queryFn: async () =>
      client.rpc.getAccountInfo(RAFFLE_VAULT_PROGRAM_ADDRESS).send(),
  });
}