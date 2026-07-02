// devnet_test.ts
// Tests the deployed solamm program on devnet:
//   1. create two mints
//   2. init_pool
//   3. add_liquidity
//   4. swap A -> B
//   5. remove_liquidity

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccountIdempotent,
  mintTo,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const PROGRAM_ID = new PublicKey("GCuuqz4THCtS76xqQrqkvrVPsYwiWsfVvWBk6ABCJKvB");
const RPC = "https://devnet.helius-rpc.com/?api-key=ee0beb77-482c-41b4-8212-81d000709581";

function loadWallet(): Keypair {
  const raw = JSON.parse(
    fs.readFileSync(path.join(os.homedir(), ".config", "solana", "id.json"), "utf-8")
  );
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function findPda(seeds: Buffer[]): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
}

async function balance(conn: Connection, label: string, addr: PublicKey) {
  try {
    const acc = await getAccount(conn, addr);
    console.log(`  ${label}: ${acc.amount}`);
    return acc.amount;
  } catch {
    console.log(`  ${label}: account not found`);
    return 0n;
  }
}

function initPoolIx(feeBps: bigint): Buffer {
  const disc = Buffer.from([116, 233, 199, 204, 115, 159, 171, 36]);
  const arg = Buffer.alloc(8);
  arg.writeBigUInt64LE(feeBps);
  return Buffer.concat([disc, arg]);
}

function addLiquidityIx(amountA: bigint, amountB: bigint, minLp: bigint): Buffer {
  const disc = Buffer.from([181, 157, 89, 67, 143, 182, 52, 72]);
  const buf = Buffer.alloc(24);
  buf.writeBigUInt64LE(amountA, 0);
  buf.writeBigUInt64LE(amountB, 8);
  buf.writeBigUInt64LE(minLp, 16);
  return Buffer.concat([disc, buf]);
}

function removeLiquidityIx(lp: bigint, minA: bigint, minB: bigint): Buffer {
  const disc = Buffer.from([80, 85, 209, 72, 24, 206, 177, 108]);
  const buf = Buffer.alloc(24);
  buf.writeBigUInt64LE(lp, 0);
  buf.writeBigUInt64LE(minA, 8);
  buf.writeBigUInt64LE(minB, 16);
  return Buffer.concat([disc, buf]);
}

function swapIx(amountIn: bigint, minOut: bigint, aToB: boolean): Buffer {
  const disc = Buffer.from([248, 198, 158, 145, 225, 117, 135, 200]);
  const buf = Buffer.alloc(17);
  buf.writeBigUInt64LE(amountIn, 0);
  buf.writeBigUInt64LE(minOut, 8);
  buf.writeUInt8(aToB ? 1 : 0, 16);
  return Buffer.concat([disc, buf]);
}

async function send(
  conn: Connection,
  wallet: Keypair,
  data: Buffer,
  keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[]
): Promise<string> {
  const tx = new Transaction().add({ programId: PROGRAM_ID, keys, data });
  return sendAndConfirmTransaction(conn, tx, [wallet]);
}

async function main() {
  const conn = new Connection(RPC, "confirmed");
  const wallet = loadWallet();

  const sol = await conn.getBalance(wallet.publicKey);
  console.log("wallet:", wallet.publicKey.toBase58());
  console.log("balance:", (sol / 1e9).toFixed(4), "SOL\n");

  if (sol < 0.5e9) {
    console.error("not enough SOL. run: solana airdrop 2");
    process.exit(1);
  }

  // --- create mints (mint_a must be < mint_b) ---
  console.log("creating mints...");
  let mintAKp = Keypair.generate();
  let mintBKp = Keypair.generate();
  while (
    Buffer.from(mintAKp.publicKey.toBytes()).compare(
      Buffer.from(mintBKp.publicKey.toBytes())
    ) >= 0
  ) {
    mintAKp = Keypair.generate();
    mintBKp = Keypair.generate();
  }

  const mintA = await createMint(conn, wallet, wallet.publicKey, null, 6, mintAKp);
  const mintB = await createMint(conn, wallet, wallet.publicKey, null, 6, mintBKp);
  console.log("mint_a:", mintA.toBase58());
  console.log("mint_b:", mintB.toBase58());

  // --- derive PDAs ---
  const pool      = findPda([Buffer.from("pool"), mintA.toBuffer(), mintB.toBuffer()]);
  const vaultA    = findPda([Buffer.from("vault_a"), pool.toBuffer()]);
  const vaultB    = findPda([Buffer.from("vault_b"), pool.toBuffer()]);
  const lpMint    = findPda([Buffer.from("lp_mint"), pool.toBuffer()]);
  const authority = findPda([Buffer.from("authority"), pool.toBuffer()]);
  console.log("pool:", pool.toBase58());

  // --- user token accounts ---
  const userA = await createAssociatedTokenAccountIdempotent(conn, wallet, mintA, wallet.publicKey);
  const userB = await createAssociatedTokenAccountIdempotent(conn, wallet, mintB, wallet.publicKey);
  await mintTo(conn, wallet, mintA, userA, wallet, 10_000_000n);
  await mintTo(conn, wallet, mintB, userB, wallet, 10_000_000n);
  console.log("\nuser tokens minted");
  await balance(conn, "user_a", userA);
  await balance(conn, "user_b", userB);

  // --- init_pool ---
  console.log("\n[1] init_pool (fee_bps=30)");
  const sig1 = await send(conn, wallet, initPoolIx(30n), [
    { pubkey: pool,                   isSigner: false, isWritable: true  },
    { pubkey: mintA,                  isSigner: false, isWritable: false },
    { pubkey: mintB,                  isSigner: false, isWritable: false },
    { pubkey: vaultA,                 isSigner: false, isWritable: true  },
    { pubkey: vaultB,                 isSigner: false, isWritable: true  },
    { pubkey: lpMint,                 isSigner: false, isWritable: true  },
    { pubkey: authority,              isSigner: false, isWritable: false },
    { pubkey: wallet.publicKey,       isSigner: true,  isWritable: true  },
    { pubkey: SystemProgram.programId,isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID,       isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY,     isSigner: false, isWritable: false },
  ]);
  console.log("ok:", sig1);

  // --- create user LP ATA ---
  const userLp = getAssociatedTokenAddressSync(lpMint, wallet.publicKey);
  await createAssociatedTokenAccountIdempotent(conn, wallet, lpMint, wallet.publicKey);

  // --- add_liquidity ---
  console.log("\n[2] add_liquidity (1_000_000 A + 1_000_000 B)");
  const sig2 = await send(conn, wallet, addLiquidityIx(1_000_000n, 1_000_000n, 0n), [
    { pubkey: pool,             isSigner: false, isWritable: false },
    { pubkey: vaultA,           isSigner: false, isWritable: true  },
    { pubkey: vaultB,           isSigner: false, isWritable: true  },
    { pubkey: lpMint,           isSigner: false, isWritable: true  },
    { pubkey: authority,        isSigner: false, isWritable: false },
    { pubkey: wallet.publicKey, isSigner: true,  isWritable: true  },
    { pubkey: userA,            isSigner: false, isWritable: true  },
    { pubkey: userB,            isSigner: false, isWritable: true  },
    { pubkey: userLp,           isSigner: false, isWritable: true  },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ]);
  console.log("ok:", sig2);
  await balance(conn, "vault_a", vaultA);
  await balance(conn, "vault_b", vaultB);
  await balance(conn, "user_lp", userLp);

  // --- swap A -> B ---
  console.log("\n[3] swap A->B (amount_in=10_000)");
  const sig3 = await send(conn, wallet, swapIx(10_000n, 0n, true), [
    { pubkey: pool,             isSigner: false, isWritable: false },
    { pubkey: vaultA,           isSigner: false, isWritable: true  },
    { pubkey: vaultB,           isSigner: false, isWritable: true  },
    { pubkey: authority,        isSigner: false, isWritable: true  },
    { pubkey: wallet.publicKey, isSigner: true,  isWritable: false },
    { pubkey: userA,            isSigner: false, isWritable: true  },
    { pubkey: userB,            isSigner: false, isWritable: true  },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ]);
  console.log("ok:", sig3);
  await balance(conn, "user_a", userA);
  await balance(conn, "user_b", userB);  // should gain ~9871
  await balance(conn, "vault_a", vaultA);
  await balance(conn, "vault_b", vaultB);

  // --- remove_liquidity (half) ---
  const lpBal = (await getAccount(conn, userLp)).amount;
  const half  = lpBal / 2n;
  console.log("\n[4] remove_liquidity (lp_amount=" + half + ")");
  const sig4 = await send(conn, wallet, removeLiquidityIx(half, 0n, 0n), [
    { pubkey: pool,             isSigner: false, isWritable: false },
    { pubkey: vaultA,           isSigner: false, isWritable: true  },
    { pubkey: vaultB,           isSigner: false, isWritable: true  },
    { pubkey: lpMint,           isSigner: false, isWritable: true  },
    { pubkey: authority,        isSigner: false, isWritable: false },
    { pubkey: wallet.publicKey, isSigner: true,  isWritable: true  },
    { pubkey: userA,            isSigner: false, isWritable: true  },
    { pubkey: userB,            isSigner: false, isWritable: true  },
    { pubkey: userLp,           isSigner: false, isWritable: true  },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ]);
  console.log("ok:", sig4);
  await balance(conn, "user_a", userA);
  await balance(conn, "user_b", userB);
  await balance(conn, "user_lp", userLp);
  await balance(conn, "vault_a", vaultA);
  await balance(conn, "vault_b", vaultB);

  console.log("\nall done.");
  console.log("pool:", `https://explorer.solana.com/address/${pool.toBase58()}?cluster=devnet`);
}

main().catch((e) => {
  console.error("error:", e.message ?? e);
  process.exit(1);
});
