import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ArrowLeft, ChevronDown, Plus, Loader2 } from "lucide-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { NavLink, useNavigate } from "react-router-dom";
import { getProgram, PROGRAM_ID } from "../lib/program";
import { toast } from "sonner";
import { KNOWN_TOKENS } from "../lib/tokens";

export function CreatePool() {
  const wallet = useWallet();
  const { connected, publicKey, sendTransaction } = wallet;
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();
  const navigate = useNavigate();
  
  const [tokenA, setTokenA] = useState(KNOWN_TOKENS[0]);
  const [tokenB, setTokenB] = useState(KNOWN_TOKENS[1]);
  
  const [customAddress, setCustomAddress] = useState("");
  
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [selectingFor, setSelectingFor] = useState<"A" | "B">("A");
  const [isCreating, setIsCreating] = useState(false);
  const [feeBps, setFeeBps] = useState("30"); // default 0.3%

  const openTokenModal = (type: "A" | "B") => {
    setSelectingFor(type);
    setIsTokenModalOpen(true);
  };

  const handleSelectToken = (token: typeof KNOWN_TOKENS[0]) => {
    if (selectingFor === "A") {
      if (token.address === tokenB.address) setTokenB(tokenA);
      setTokenA(token);
    } else {
      if (token.address === tokenA.address) setTokenA(tokenB);
      setTokenB(token);
    }
    setIsTokenModalOpen(false);
  };

  const handleCustomTokenSubmit = () => {
    try {
      new PublicKey(customAddress);
      const customToken = { symbol: "CUSTOM", name: "Custom Token", address: customAddress, decimals: 6, icon: "https://s2.coinmarketcap.com/static/img/coins/64x64/1.png" };
      handleSelectToken(customToken);
      setCustomAddress("");
    } catch {
      toast.error("Invalid Solana Address");
    }
  };

  const handleCreatePool = async () => {
    if (!connected || !publicKey) return;
    
    setIsCreating(true);
    try {
      const program = getProgram(connection, wallet as any);
      
      const mintAPubkey = new PublicKey(tokenA.address);
      const mintBPubkey = new PublicKey(tokenB.address);
      
      const [mint1, mint2] = Buffer.compare(mintAPubkey.toBuffer(), mintBPubkey.toBuffer()) < 0 
        ? [mintAPubkey, mintBPubkey] 
        : [mintBPubkey, mintAPubkey];
      
      const poolPda = PublicKey.findProgramAddressSync([Buffer.from("pool"), mint1.toBuffer(), mint2.toBuffer()], PROGRAM_ID)[0];
      const vaultA = PublicKey.findProgramAddressSync([Buffer.from("vault_a"), poolPda.toBuffer()], PROGRAM_ID)[0];
      const vaultB = PublicKey.findProgramAddressSync([Buffer.from("vault_b"), poolPda.toBuffer()], PROGRAM_ID)[0];
      const lpMint = PublicKey.findProgramAddressSync([Buffer.from("lp_mint"), poolPda.toBuffer()], PROGRAM_ID)[0];
      const authority = PublicKey.findProgramAddressSync([Buffer.from("authority"), poolPda.toBuffer()], PROGRAM_ID)[0];

      // Check if pool already exists
      const poolInfo = await connection.getAccountInfo(poolPda);
      if (poolInfo) {
        toast.error("Pool already exists for this pair!");
        setIsCreating(false);
        return;
      }

      const tx = await program.methods
        .initPool(new BN(Number(feeBps)))
        .accounts({
          pool: poolPda,
          mintA: mint1,
          mintB: mint2,
          vaultA: vaultA,
          vaultB: vaultB,
          lpMint: lpMint,
          authority: authority,
          payer: publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          // rent is automatically handled by Anchor 0.29+ usually, but we might need SYSVAR_RENT
        })
        .transaction();

      const signature = await sendTransaction(tx, connection);
      console.log(`Create Pool TX: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
      toast.success("Pool Created Successfully!", {
        description: `Tx: ${signature.slice(0,8)}...${signature.slice(-8)}`,
        action: { label: "View on Explorer", onClick: () => window.open(`https://explorer.solana.com/tx/${signature}?cluster=devnet`, "_blank") }
      });
      
      // Redirect to pool page after a short delay
      setTimeout(() => navigate("/pool"), 2000);
      
    } catch (err: any) {
      console.error("Create Pool failed:", err);
      toast.error("Transaction failed", { description: err.message || "See console for details." });
    } finally {
      setIsCreating(false);
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
            <h2 className="text-xl font-semibold text-white">Create New Pool</h2>
          </div>

          <div className="text-sm text-gray-400 mb-6 p-3 bg-[#1A1A1A] border border-[#222] rounded-lg">
            Initialize a new liquidity pool on Devnet. You will pay the SOL rent to open the vault accounts.
          </div>

          {/* Token A */}
          <div className="bg-[#1A1A1A] rounded-2xl p-4 mb-2 border border-[#222] hover:border-[#333] transition-colors">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-400">First Token</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-mono truncate w-1/2">{tokenA.address}</span>
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

          {/* Token B */}
          <div className="bg-[#1A1A1A] rounded-2xl p-4 mt-2 mb-6 border border-[#222] hover:border-[#333] transition-colors">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-400">Second Token</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-mono truncate w-1/2">{tokenB.address}</span>
              <Button onClick={() => openTokenModal("B")} variant="secondary" className="bg-[#2A2A2A] hover:bg-[#333] border border-[#333] rounded-full px-3 py-1.5 h-auto font-semibold gap-2 shadow-sm">
                <img src={tokenB.icon} alt={tokenB.symbol} className="w-6 h-6 rounded-full" />
                <span className="text-white text-base">{tokenB.symbol}</span>
                <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />
              </Button>
            </div>
          </div>

          {/* Fee Tier */}
          <div className="mb-6">
             <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-gray-300">Fee Tier (Bps)</span>
             </div>
             <div className="flex gap-2">
               {["10", "30", "100"].map(fee => (
                 <Button 
                   key={fee}
                   onClick={() => setFeeBps(fee)}
                   className={`flex-1 ${feeBps === fee ? "bg-[#f94119] text-white hover:bg-[#e03a16]" : "bg-[#222] text-gray-400 hover:bg-[#333] border border-[#333]"}`}
                 >
                   {Number(fee) / 100}%
                 </Button>
               ))}
             </div>
          </div>

          {!connected ? (
            <Button onClick={() => setVisible(true)} className="w-full bg-[#f94119]/10 text-[#f94119] hover:bg-[#f94119]/20 h-14 text-lg font-semibold rounded-xl border border-[#f94119]/30 transition-all">
              Connect Wallet
            </Button>
          ) : (
            <Button 
              onClick={handleCreatePool}
              disabled={isCreating || tokenA.address === tokenB.address}
              className="w-full bg-[#f94119] hover:bg-[#e03a16] disabled:opacity-50 disabled:cursor-not-allowed text-white h-14 text-lg font-semibold rounded-xl transition-all shadow-[0_0_20px_rgba(249,65,25,0.3)] hover:shadow-[0_0_25px_rgba(249,65,25,0.5)]"
            >
              {isCreating ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Initializing...</> : "Initialize Pool"}
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
                  <span className="text-xs text-gray-400 font-mono">{token.address.slice(0,12)}...</span>
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
                <Button onClick={handleCustomTokenSubmit} className="bg-[#333] hover:bg-[#444] text-white">Add</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
