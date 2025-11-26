import { PublicKey } from "@solana/web3.js";

export const TEMPRAFFLE_VAULT_PROGRAM_ADDRESS = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID!
);