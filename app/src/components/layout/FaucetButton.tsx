import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { KNOWN_TOKENS } from "../../lib/tokens";
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";
import { Loader2, Droplets } from "lucide-react";

export function FaucetButton() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [isMinting, setIsMinting] = useState(false);

  // Read the secret key from env
  const secretKeyString = import.meta.env.VITE_FAUCET_SECRET_KEY;
  if (!secretKeyString) return null; // Hide if not configured

  const handleMint = async () => {
    if (!publicKey) return;
    try {
      setIsMinting(true);
      
      // Parse the keypair
      const secret = new Uint8Array(JSON.parse(secretKeyString));
      const faucetKeypair = Keypair.fromSecretKey(secret);

      const tx = new Transaction();
      
      // We will mint 1,000 tokens of each
      for (const token of KNOWN_TOKENS) {
        const mintPubkey = new PublicKey(token.address);
        const userAta = getAssociatedTokenAddressSync(mintPubkey, publicKey);
        
        // 1. Instruction to create ATA (idempotent, won't fail if it exists)
        // Payer is the faucet wallet!
        tx.add(
          createAssociatedTokenAccountIdempotentInstruction(
            faucetKeypair.publicKey, 
            userAta,
            publicKey,
            mintPubkey
          )
        );

        // 2. Instruction to mint tokens
        // 1000 * 10^decimals
        const amount = 1000 * Math.pow(10, token.decimals);
        tx.add(
          createMintToInstruction(
            mintPubkey,
            userAta,
            faucetKeypair.publicKey, // authority
            amount,
            []
          )
        );
      }

      toast.info("Airdropping 1,000 Test Tokens...");
      
      // The faucet keypair signs and pays for the transaction!
      const signature = await connection.sendTransaction(tx, [faucetKeypair], { skipPreflight: false });
      
      const latestBlockhash = await connection.getLatestBlockhash();
      const conf = await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      }, 'confirmed');

      if (conf.value.err) throw new Error("Transaction failed on-chain");

      toast.success("Tokens Airdropped!", {
        description: "Check your phantom wallet balance."
      });

    } catch (err: any) {
      console.error(err);
      toast.error("Faucet failed", { description: err.message });
    } finally {
      setIsMinting(false);
    }
  };

  if (!publicKey) return null;

  return (
    <button
      onClick={handleMint}
      disabled={isMinting}
      className="flex items-center gap-2 bg-[#1A1A1A] border border-[#333] hover:border-[#f94119] text-[#f94119] text-sm font-medium px-4 py-2 transition-all disabled:opacity-50"
      title="Get 1,000 Test Tokens (Devnet)"
    >
      {isMinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Droplets className="w-4 h-4" />}
      Faucet
    </button>
  );
}
