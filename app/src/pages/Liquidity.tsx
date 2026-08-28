import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Plus, Settings, ChevronDown, ArrowLeft, Loader2 } from "lucide-react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID, getMint } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { Card, CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { NavLink } from "react-router-dom";
import { getProgram, PROGRAM_ID } from "../lib/program";
import { toast } from "sonner";
import { KNOWN_TOKENS } from "../lib/tokens";

const MOCK_TOKENS = KNOWN_TOKENS;

export function Liquidity() {
  const wallet = useWallet();
  const { connected, publicKey, sendTransaction } = wallet;
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();

  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);

  const [tokenA, setTokenA] = useState(MOCK_TOKENS[0]);
  const [tokenB, setTokenB] = useState(MOCK_TOKENS[1]);

  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [selectingFor, setSelectingFor] = useState<"A" | "B">("A");
  const [customAddress, setCustomAddress] = useState("");
  const [isFetchingMint, setIsFetchingMint] = useState(false);

  const openTokenModal = (type: "A" | "B") => {
    setSelectingFor(type);
    setIsTokenModalOpen(true);
  };

  const handleCustomTokenSubmit = async () => {
    try {
      const pubkey = new PublicKey(customAddress);
      setIsFetchingMint(true);
      const mint = await getMint(connection, pubkey);
      const customToken = { 
        symbol: "CUSTOM", 
        name: "Custom Token", 
        address: customAddress, 
        decimals: mint.decimals, 
        icon: "https://s2.coinmarketcap.com/static/img/coins/64x64/1.png" 
      };
      handleSelectToken(customToken);
      setCustomAddress("");
    } catch (err) {
      toast.error("Invalid Solana Address or Mint Not Found");
    } finally {
      setIsFetchingMint(false);
    }
  };

  const handleSelectToken = (token: typeof MOCK_TOKENS[0]) => {
    if (selectingFor === "A") {
      if (token.address === tokenB.address) setTokenB(tokenA);
      setTokenA(token);
    } else {
      if (token.address === tokenA.address) setTokenA(tokenB);
      setTokenB(token);
    }
    setIsTokenModalOpen(false);
  };

  useEffect(() => {
    // Fetch ratio
    const fetchRatio = async () => {
      try {
        const mintAPub = new PublicKey(tokenA.address);
        const mintBPub = new PublicKey(tokenB.address);
        
        const [mint1, mint2] = Buffer.compare(mintAPub.toBuffer(), mintBPub.toBuffer()) < 0 
          ? [mintAPub, mintBPub] 
          : [mintBPub, mintAPub];

        const poolPda = PublicKey.findProgramAddressSync([Buffer.from("pool"), mint1.toBuffer(), mint2.toBuffer()], PROGRAM_ID)[0];
        const vaultA = PublicKey.findProgramAddressSync([Buffer.from("vault_a"), poolPda.toBuffer()], PROGRAM_ID)[0];
        const vaultB = PublicKey.findProgramAddressSync([Buffer.from("vault_b"), poolPda.toBuffer()], PROGRAM_ID)[0];

        const vaultABal = await connection.getTokenAccountBalance(vaultA);
        const vaultBBal = await connection.getTokenAccountBalance(vaultB);

        if (Number(vaultABal.value.amount) > 0) {
          const ratio1To2 = Number(vaultBBal.value.amount) / Number(vaultABal.value.amount);
          // If tokenA is mint1, ratio is mint2/mint1. If tokenA is mint2, ratio is mint1/mint2.
          setRatio(mint1.equals(mintAPub) ? ratio1To2 : 1 / ratio1To2);
        } else {
          setRatio(null);
        }
      } catch (e) {
        setRatio(null);
      }
    };
    fetchRatio();
  }, [connection, tokenA.address, tokenB.address]);

  const handleAmountAChange = (val: string) => {
    setAmountA(val);
    if (ratio && val && !isNaN(Number(val))) {
      setAmountB((Number(val) * ratio).toFixed(6));
    } else if (!val) {
      setAmountB("");
    }
  };

  const handleAmountBChange = (val: string) => {
    setAmountB(val);
    if (ratio && val && !isNaN(Number(val))) {
      setAmountA((Number(val) / ratio).toFixed(6));
    } else if (!val) {
      setAmountA("");
    }
  };

  const handleAddLiquidity = async () => {
    if (!connected || !publicKey || !amountA || !amountB) return;

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

      // AmountA and AmountB also need to be passed in the correct order to the program!
      const amount1Raw = new BN(Number(mint1.equals(mintAPub) ? amountA : amountB) * Math.pow(10, mint1.equals(mintAPub) ? tokenA.decimals : tokenB.decimals));
      const amount2Raw = new BN(Number(mint2.equals(mintBPub) ? amountB : amountA) * Math.pow(10, mint2.equals(mintBPub) ? tokenB.decimals : tokenA.decimals));
      const minLp = new BN(0); // 0 slippage check for simplified demo

      const tx = await program.methods
        .addLiquidity(amount1Raw, amount2Raw, minLp)
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

      // Create ATA instruction for LP token
      const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
        publicKey,
        userLp,
        publicKey,
        lpMint
      );
      tx.instructions.unshift(createAtaIx);

      const signature = await sendTransaction(tx, connection);
      console.log(`Add Liquidity TX: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
      toast.success("Liquidity added!", {
        description: `Tx: ${signature.slice(0,8)}...${signature.slice(-8)}`,
        action: { label: "View on Explorer", onClick: () => window.open(`https://explorer.solana.com/tx/${signature}?cluster=devnet`, "_blank") }
      });

      setAmountA("");
      setAmountB("");
    } catch (err: any) {
      console.error("Add Liquidity failed:", err);
      toast.error("Transaction failed", { description: err.message || "See console for details." });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mb-4 flex items-center">
        <NavLink to="/pool" className="text-gray-400 hover:text-white flex items-center gap-2 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Pools
        </NavLink>
      </div>

      <Card className="w-full max-w-md bg-[#111] border-[#222] shadow-2xl relative overflow-hidden">
        <div className="absolute top-[-100px] left-[-100px] w-[200px] h-[200px] bg-[#f94119] opacity-10 blur-[100px] rounded-full pointer-events-none" />

        <CardContent className="p-4 sm:p-6 relative z-10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white">Add Liquidity (Devnet)</h2>
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-[#222] rounded-full">
              <Settings className="w-5 h-5" />
            </Button>
          </div>

          <div className="text-sm text-gray-400 mb-6 p-3 bg-[#1A1A1A] border border-[#222] rounded-lg">
            Tip: By adding liquidity you'll earn 0.3% of all trades on this pair proportional to your share of the pool.
          </div>

          <div className="bg-[#1A1A1A] rounded-2xl p-4 mb-2 border border-[#222] hover:border-[#333] transition-colors focus-within:border-[#444]">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-400">First Token</span>
            </div>
            <div className="flex items-center justify-between">
              <input
                type="number"
                placeholder="0"
                value={amountA}
                onChange={(e) => handleAmountAChange(e.target.value)}
                className="bg-transparent text-3xl font-medium text-white outline-none w-1/2 placeholder:text-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <Button onClick={() => openTokenModal("A")} variant="secondary" className="bg-[#2A2A2A] hover:bg-[#333] border border-[#333] rounded-full px-3 py-1.5 h-auto font-semibold gap-2 shadow-sm">
                <img src={tokenA.icon} alt={tokenA.symbol} className="w-6 h-6 rounded-full" />
                <span className="text-white text-base">{tokenA.symbol}</span>
                <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />
              </Button>
            </div>
          </div>

          <div className="flex justify-center -my-3 relative z-10">
            <div className="rounded-lg bg-[#222] border-4 border-[#111] p-1 shadow-md">
              <Plus className="w-5 h-5 text-gray-400" />
            </div>
          </div>

          <div className="bg-[#1A1A1A] rounded-2xl p-4 mt-2 mb-6 border border-[#222] hover:border-[#333] transition-colors focus-within:border-[#444]">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-400">Second Token</span>
            </div>
            <div className="flex items-center justify-between">
              <input
                type="number"
                placeholder="0"
                value={amountB}
                onChange={(e) => handleAmountBChange(e.target.value)}
                className="bg-transparent text-3xl font-medium text-white outline-none w-1/2 placeholder:text-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <Button onClick={() => openTokenModal("B")} variant="secondary" className="bg-[#2A2A2A] hover:bg-[#333] border border-[#333] rounded-full px-3 py-1.5 h-auto font-semibold gap-2 shadow-sm">
                <img src={tokenB.icon} alt={tokenB.symbol} className="w-6 h-6 rounded-full" />
                <span className="text-white text-base">{tokenB.symbol}</span>
                <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />
              </Button>
            </div>
          </div>

          {!connected ? (
            <Button onClick={() => setVisible(true)} className="w-full bg-[#f94119]/10 text-[#f94119] hover:bg-[#f94119]/20 h-14 text-lg font-semibold rounded-xl border border-[#f94119]/30 transition-all">
              Connect Wallet
            </Button>
          ) : (
            <Button
              onClick={handleAddLiquidity}
              disabled={isAdding || !amountA || !amountB}
              className="w-full bg-[#f94119] hover:bg-[#e03a16] disabled:opacity-50 disabled:cursor-not-allowed text-white h-14 text-lg font-semibold rounded-xl transition-all shadow-[0_0_20px_rgba(249,65,25,0.3)] hover:shadow-[0_0_25px_rgba(249,65,25,0.5)]"
            >
              {isAdding ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Supplying...</> : "Supply"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={isTokenModalOpen} onOpenChange={setIsTokenModalOpen}>
        <DialogContent className="bg-[#111] border-[#222] text-white">
          <DialogHeader>
            <DialogTitle>Select a token</DialogTitle>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-2">
            {KNOWN_TOKENS.map((token) => (
              <button
                key={token.address}
                onClick={() => handleSelectToken(token)}
                className="flex items-center gap-3 w-full p-3 hover:bg-[#222] rounded-xl transition-colors text-left"
              >
                <img src={token.icon} alt={token.symbol} className="w-8 h-8 rounded-full" />
                <div className="flex flex-col items-start">
                  <span className="font-semibold text-white">{token.symbol}</span>
                  <span className="text-xs text-gray-400">{token.name}</span>
                </div>
              </button>
            ))}
            <div className="mt-4 pt-4 border-t border-[#333]">
              <span className="text-sm text-gray-400 mb-2 block">Or paste custom Mint Address:</span>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  placeholder="Paste Solana address..." 
                  className="flex-1 bg-[#222] border border-[#333] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#f94119]"
                />
                <Button onClick={handleCustomTokenSubmit} disabled={isFetchingMint} className="bg-[#333] hover:bg-[#444] text-white">
                  {isFetchingMint ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
