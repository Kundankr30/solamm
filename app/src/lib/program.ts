import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import idl from "../idl/solamm.json";
import type { WalletContextState } from "@solana/wallet-adapter-react";

export const PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_PROGRAM_ID || "6gvRLzRPYY2NBLuAX9ZeaFQw6iNF9czfGKFscfPfcgNP"
);

export function getProgram(connection: Connection, wallet: WalletContextState) {
  if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
    throw new Error("Wallet not fully connected");
  }

  const provider = new AnchorProvider(
    connection,
    {
      publicKey: wallet.publicKey,
      signTransaction: wallet.signTransaction,
      signAllTransactions: wallet.signAllTransactions,
    },
    { preflightCommitment: "confirmed" }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Program(idl as any, provider);
}
