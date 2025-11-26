import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toastTx } from '@/components/toast-tx';
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react';
import { useWalletUiSignAndSend } from '@wallet-ui/react-gill';
import { PublicKey } from '@solana/web3.js';
import { Address } from 'gill';
import {
  getCancelRaffleInstructionAsync,
  getClaimRaffleInstruction,
  getEnterRaffleInstruction,
  getExitRaffleInstruction,
  getInitializeRaffleInstructionAsync,
  getPayoutRaffleInstructionAsync,
} from '@/lib/codama/instructions';

const toAddress = (value: PublicKey): Address<string> =>
  value.toBase58() as Address<string>;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unexpected error';

const invalidateVaultQueries = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({ queryKey: ['raffle-vault-account'] });

export function useInitializeRaffleMutation({ account }: { account: UiWalletAccount }) {
  const txSigner = useWalletUiSigner({ account });
  const signAndSend = useWalletUiSignAndSend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ticketPriceLamports,
      maxTickets,
      durationSeconds,
    }: {
      ticketPriceLamports: bigint;
      maxTickets: number;
      durationSeconds?: bigint | null;
    }) => {
      const instruction = await getInitializeRaffleInstructionAsync({
        authority: txSigner,
        ticketPrice: ticketPriceLamports,
        maxTickets,
        durationSeconds: durationSeconds ?? null,
      });
      return signAndSend(instruction, txSigner);
    },
    onSuccess: (signature) => {
      toastTx(signature);
      invalidateVaultQueries(queryClient);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useEnterRaffleMutation({
  account,
  vaultAddress,
}: {
  account: UiWalletAccount;
  vaultAddress: PublicKey;
}) {
  const txSigner = useWalletUiSigner({ account });
  const signAndSend = useWalletUiSignAndSend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const instruction = getEnterRaffleInstruction({
        payer: txSigner,
        vault: toAddress(vaultAddress),
      });
      return signAndSend(instruction, txSigner);
    },
    onSuccess: (signature) => {
      toastTx(signature);
      invalidateVaultQueries(queryClient);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useExitRaffleMutation({
  account,
  vaultAddress,
}: {
  account: UiWalletAccount;
  vaultAddress: PublicKey;
}) {
  const txSigner = useWalletUiSigner({ account });
  const signAndSend = useWalletUiSignAndSend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const instruction = getExitRaffleInstruction({
        payer: txSigner,
        vault: toAddress(vaultAddress),
      });
      return signAndSend(instruction, txSigner);
    },
    onSuccess: (signature) => {
      toastTx(signature);
      invalidateVaultQueries(queryClient);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useClaimRaffleMutation({
  account,
  vaultAddress,
}: {
  account: UiWalletAccount;
  vaultAddress: PublicKey;
}) {
  const txSigner = useWalletUiSigner({ account });
  const signAndSend = useWalletUiSignAndSend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const instruction = getClaimRaffleInstruction({
        vault: toAddress(vaultAddress),
        winner: txSigner,
      });
      return signAndSend(instruction, txSigner);
    },
    onSuccess: (signature) => {
      toastTx(signature);
      invalidateVaultQueries(queryClient);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useCancelRaffleMutation({ account }: { account: UiWalletAccount }) {
  const txSigner = useWalletUiSigner({ account });
  const signAndSend = useWalletUiSignAndSend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const instruction = await getCancelRaffleInstructionAsync({
        authority: txSigner,
      });
      return signAndSend(instruction, txSigner);
    },
    onSuccess: (signature) => {
      toastTx(signature);
      invalidateVaultQueries(queryClient);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function usePayoutRaffleMutation({ account }: { account: UiWalletAccount }) {
  const txSigner = useWalletUiSigner({ account });
  const signAndSend = useWalletUiSignAndSend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const instruction = await getPayoutRaffleInstructionAsync({
        authority: txSigner,
      });
      return signAndSend(instruction, txSigner);
    },
    onSuccess: (signature) => {
      toastTx(signature);
      invalidateVaultQueries(queryClient);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}