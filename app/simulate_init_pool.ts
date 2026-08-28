import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";

const PROGRAM_ID = new PublicKey("6gvRLzRPYY2NBLuAX9ZeaFQw6iNF9czfGKFscfPfcgNP");

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync("/home/kundan-kumar/.config/solana/id.json", "utf-8")))
  );
  
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  const idl = JSON.parse(fs.readFileSync("./src/idl/solamm.json", "utf-8"));
  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  // Use SOL and BONK
  const mintAPubkey = new PublicKey("3viDYdV3ks8tSrGyfURhrsUzVMPbvjbn5nWUhN4nZSYk");
  const mintBPubkey = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

  const [mint1, mint2] = Buffer.compare(mintAPubkey.toBuffer(), mintBPubkey.toBuffer()) < 0 
    ? [mintAPubkey, mintBPubkey] 
    : [mintBPubkey, mintAPubkey];

  const poolPda = PublicKey.findProgramAddressSync([Buffer.from("pool"), mint1.toBuffer(), mint2.toBuffer()], PROGRAM_ID)[0];
  const vaultA = PublicKey.findProgramAddressSync([Buffer.from("vault_a"), poolPda.toBuffer()], PROGRAM_ID)[0];
  const vaultB = PublicKey.findProgramAddressSync([Buffer.from("vault_b"), poolPda.toBuffer()], PROGRAM_ID)[0];
  const lpMint = PublicKey.findProgramAddressSync([Buffer.from("lp_mint"), poolPda.toBuffer()], PROGRAM_ID)[0];
  const authority = PublicKey.findProgramAddressSync([Buffer.from("authority"), poolPda.toBuffer()], PROGRAM_ID)[0];

  try {
    const tx = await program.methods
      .initPool(new anchor.BN(30))
      .accounts({
        pool: poolPda,
        mintA: mint1,
        mintB: mint2,
        vaultA: vaultA,
        vaultB: vaultB,
        lpMint: lpMint,
        authority: authority,
        payer: walletKeypair.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .transaction();

    // Get blockhash
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = walletKeypair.publicKey;
    tx.sign(walletKeypair);

    const sim = await connection.simulateTransaction(tx);
    console.log(sim.value.logs);
    if (sim.value.err) {
      console.error("Simulation error:", sim.value.err);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
