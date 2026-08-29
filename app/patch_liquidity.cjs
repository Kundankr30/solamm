const fs = require('fs');
const content = fs.readFileSync('src/pages/Liquidity.tsx', 'utf8');

const insertPoint = content.indexOf('return (');

const handleRemoveLiquidity = `
  const handleRemoveLiquidity = async () => {
    if (!connected || !publicKey || !burnAmount) return;

    setIsAdding(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const program = getProgram(connection, wallet as any);
      const mintAPub = new PublicKey(tokenA.address);
      const mintBPub = new PublicKey(tokenB.address);

      const [mint1, mint2] = Buffer.compare(mintAPub.toBuffer(), mintBPub.toBuffer()) < 0 
        ? [mintAPub, mintBPub] 
        : [mintBPub, mintAPub];

      const poolPda = PublicKey.findProgramAddressSync([Buffer.from("pool"), mint1.toBuffer(), mint2.toBuffer()], PROGRAM_ID)[0];
      const vaultA = PublicKey.findProgramAddressSync([Buffer.from("vault_a"), poolPda.toBuffer()], PROGRAM_ID)[0];
      const vaultB = PublicKey.findProgramAddressSync([Buffer.from("vault_b"), poolPda.toBuffer()], PROGRAM_ID)[0];
      const lpMint = PublicKey.findProgramAddressSync([Buffer.from("lp_mint"), poolPda.toBuffer()], PROGRAM_ID)[0];
      const authority = PublicKey.findProgramAddressSync([Buffer.from("authority"), poolPda.toBuffer()], PROGRAM_ID)[0];

      const userTokenA = getAssociatedTokenAddressSync(mint1, publicKey);
      const userTokenB = getAssociatedTokenAddressSync(mint2, publicKey);
      const userLp = getAssociatedTokenAddressSync(lpMint, publicKey);

      const lpAmountRaw = new BN(Number(burnAmount) * 1e6);
      const minAOut = new BN(0);
      const minBOut = new BN(0);

      const tx = await program.methods
        .removeLiquidity(lpAmountRaw, minAOut, minBOut)
        .accounts({
          pool: poolPda,
          vaultA: vaultA,
          vaultB: vaultB,
          lpMint: lpMint,
          authority: authority,
          user: publicKey,
          userTokenA: userTokenA,
          userTokenB: userTokenB,
          userLpAccount: userLp,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .transaction();

      const createAtaAIx = createAssociatedTokenAccountIdempotentInstruction(
        publicKey,
        userTokenA,
        publicKey,
        mint1
      );
      const createAtaBIx = createAssociatedTokenAccountIdempotentInstruction(
        publicKey,
        userTokenB,
        publicKey,
        mint2
      );
      tx.instructions.unshift(createAtaAIx, createAtaBIx);

      const signature = await sendTransaction(tx, connection);
      console.log(\`Remove Liquidity TX: https://explorer.solana.com/tx/\${signature}?cluster=devnet\`);
      toast.success("Liquidity removed!", {
        description: \`Tx: \${signature.slice(0,8)}...\${signature.slice(-8)}\`,
        action: { label: "View on Explorer", onClick: () => window.open(\`https://explorer.solana.com/tx/\${signature}?cluster=devnet\`, "_blank") }
      });

      setBurnAmount("");
    } catch (error: any) {
      console.error("Remove liquidity failed", error);
      toast.error("Failed to remove liquidity", { description: error.message || "Please check your balance." });
    } finally {
      setIsAdding(false);
    }
  };

`;

const newContent = content.slice(0, insertPoint) + handleRemoveLiquidity + content.slice(insertPoint);
fs.writeFileSync('src/pages/Liquidity.tsx', newContent);
console.log("Success");
