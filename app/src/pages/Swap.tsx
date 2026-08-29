import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ArrowDownUp, Settings, ChevronDown, Loader2 } from "lucide-react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, getMint, createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { getProgram, PROGRAM_ID } from "../lib/program";
import { toast } from "sonner";
import { KNOWN_TOKENS } from "../lib/tokens";
import { parseTokenAmount } from "../lib/utils";

const MOCK_TOKENS = KNOWN_TOKENS;

export function Swap() {
  const wallet = useWallet();
  const { connected, publicKey, sendTransaction } = wallet;
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();

  const [payAmount, setPayAmount] = useState("");
  const [receiveAmount, setReceiveAmount] = useState("");

  const [payToken, setPayToken] = useState(MOCK_TOKENS[0]);
  const [receiveToken, setReceiveToken] = useState(MOCK_TOKENS[1]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [quoteResponse, setQuoteResponse] = useState<any>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);

  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [selectingFor, setSelectingFor] = useState<"pay" | "receive">("pay");

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [slippage, setSlippage] = useState("0.5");
  const [customSlippage, setCustomSlippage] = useState("");
  const [customAddress, setCustomAddress] = useState("");
  const [isFetchingMint, setIsFetchingMint] = useState(false);
  const [insufficientLiquidity, setInsufficientLiquidity] = useState(false);

  const openTokenModal = (type: "pay" | "receive") => {
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
    if (selectingFor === "pay") {
      if (token.address === receiveToken.address) {
        setReceiveToken(payToken);
      }
      setPayToken(token);
    } else {
      if (token.address === payToken.address) {
        setPayToken(receiveToken);
      }
      setReceiveToken(token);
    }
    setIsTokenModalOpen(false);
  };

  const handleSwapTokens = () => {
    setPayToken(receiveToken);
    setReceiveToken(payToken);
    setPayAmount(receiveAmount);
    setReceiveAmount("");
  };

  // Real fetch quotes from devnet
  useEffect(() => {
    if (!payAmount || isNaN(Number(payAmount)) || Number(payAmount) <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReceiveAmount("");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuoteResponse(null);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInsufficientLiquidity(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsQuoting(false);
      return;
    }

    let active = true;

    const fetchQuote = async () => {
      setIsQuoting(true);
      try {
        const payMint = new PublicKey(payToken.address);
        const receiveMint = new PublicKey(receiveToken.address);

        const [mintA, mintB] = Buffer.compare(payMint.toBuffer(), receiveMint.toBuffer()) < 0
          ? [payMint, receiveMint]
          : [receiveMint, payMint];

        const poolPda = PublicKey.findProgramAddressSync([Buffer.from("pool"), mintA.toBuffer(), mintB.toBuffer()], PROGRAM_ID)[0];
        const vaultA = PublicKey.findProgramAddressSync([Buffer.from("vault_a"), poolPda.toBuffer()], PROGRAM_ID)[0];
        const vaultB = PublicKey.findProgramAddressSync([Buffer.from("vault_b"), poolPda.toBuffer()], PROGRAM_ID)[0];

        // Batch-fetch pool account + vault balances in a single RPC call
        const [poolAccountInfo, vaultABalance, vaultBBalance] = await Promise.all([
          connection.getAccountInfo(poolPda),
          connection.getTokenAccountBalance(vaultA),
          connection.getTokenAccountBalance(vaultB),
        ]);

        if (!active) return;

        if (!poolAccountInfo) {
          setInsufficientLiquidity(false);
          setReceiveAmount("");
          setQuoteResponse(null);
          return;
        }

        if (Number(vaultABalance.value.amount) === 0 || Number(vaultBBalance.value.amount) === 0) {
          setInsufficientLiquidity(true);
          setReceiveAmount("");
          setQuoteResponse(null);
          return;
        }
        setInsufficientLiquidity(false);

        // Decode fee_bps from pool account: 8 (discriminator) + 32*6 (pubkeys) = offset 200
        const feeBps = poolAccountInfo.data.readUIntLE(200, 8);

        const aToB = payMint.equals(mintA);

        const reserveIn = aToB ? Number(vaultABalance.value.amount) : Number(vaultBBalance.value.amount);
        const reserveOut = aToB ? Number(vaultBBalance.value.amount) : Number(vaultABalance.value.amount);

        const amountInRaw = Number(payAmount) * Math.pow(10, payToken.decimals);

        const amountInWithFee = amountInRaw * (10000 - feeBps) / 10000;
        const amountOutRaw = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);
        const uiAmountOut = amountOutRaw / Math.pow(10, receiveToken.decimals);

        const spotPrice = reserveOut / reserveIn;
        const executionPrice = amountOutRaw / amountInRaw;
        const priceImpact = spotPrice > 0 ? Math.max(0, (1 - (executionPrice / spotPrice)) * 100) : 0;

        setQuoteResponse({
          amountInRaw,
          amountOutRaw,
          poolPda,
          vaultA,
          vaultB,
          mintA,
          mintB,
          aToB,
          priceImpact
        });
        setReceiveAmount(uiAmountOut.toFixed(receiveToken.decimals));

      } catch (err) {
        if (active) {
          setQuoteResponse(null);
          setReceiveAmount("");
          setInsufficientLiquidity(false);
        }
      } finally {
        if (active) setIsQuoting(false);
      }
    };

    const timeoutId = setTimeout(fetchQuote, 500);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [payAmount, payToken, receiveToken, connection]);

  const executeSwap = async () => {
    if (!connected || !publicKey || !quoteResponse) return;

    setIsSwapping(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const program = getProgram(connection, wallet as any);

      const authority = PublicKey.findProgramAddressSync(
        [Buffer.from("authority"), quoteResponse.poolPda.toBuffer()],
        PROGRAM_ID
      )[0];

      const userTokenA = getAssociatedTokenAddressSync(quoteResponse.mintA, publicKey);
      const mintB = quoteResponse.mintB;
      const userTokenB = getAssociatedTokenAddressSync(mintB, publicKey);

      const slippageNum = Number(slippage) || 0.5;
      const minAmountOutRaw = Math.floor(quoteResponse.amountOutRaw * (1 - slippageNum / 100));

      const amountInBn = parseTokenAmount(payAmount, payToken.decimals);

      const tx = await program.methods
        .swap(
          amountInBn,
          new BN(minAmountOutRaw),
          quoteResponse.aToB
        )

        .accounts({
          pool: quoteResponse.poolPda,
          vaultA: quoteResponse.vaultA,
          vaultB: quoteResponse.vaultB,
          authority: authority,
          user: publicKey,
          userTokenA: userTokenA,
          userTokenB: userTokenB,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .transaction();

      // Ensure ATAs exist for both tokens so swaps never fail due to missing accounts
      const createAtaAIx = createAssociatedTokenAccountIdempotentInstruction(
        publicKey,
        userTokenA,
        publicKey,
        quoteResponse.mintA
      );
      const createAtaBIx = createAssociatedTokenAccountIdempotentInstruction(
        publicKey,
        userTokenB,
        publicKey,
        quoteResponse.mintB
      );
      tx.instructions.unshift(createAtaAIx, createAtaBIx);

      const signature = await sendTransaction(tx, connection);
      console.log(`Swap transaction sent: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
      toast.success("Swap successful!", {
        description: `Tx: ${signature.slice(0,8)}...${signature.slice(-8)}`,
        action: { label: "View on Explorer", onClick: () => window.open(`https://explorer.solana.com/tx/${signature}?cluster=devnet`, "_blank") }
      });

      setPayAmount("");
      setReceiveAmount("");
      setQuoteResponse(null);
    } catch (error: any) {
      console.error("Swap failed", error);
      toast.error("Swap failed", { description: error.message || "Please try again or check your wallet balance." });
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#111] border-[#222] shadow-2xl relative overflow-hidden">
        <div className="absolute top-[-100px] left-[-100px] w-[200px] h-[200px] bg-[#f94119] opacity-10 blur-[100px] rounded-full pointer-events-none" />

        <CardContent className="p-4 sm:p-6 relative z-10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white">Swap</h2>
            <Button onClick={() => setIsSettingsModalOpen(true)} variant="ghost" className="hover:bg-[#222] text-gray-400 p-2 h-auto rounded-full">
              <Settings className="w-5 h-5" />
            </Button>
          </div>

          <div className="bg-[#1A1A1A] rounded-2xl p-4 mb-2 border border-[#222] hover:border-[#333] transition-colors focus-within:border-[#f94119]/50">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-400">You Pay</span>
              <span className="text-sm text-gray-500">Balance: 0.00</span>
            </div>
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="0.0"
                className="bg-transparent text-3xl text-white outline-none w-1/2 placeholder:text-gray-600 font-medium"
              />
              <Button onClick={() => openTokenModal("pay")} variant="secondary" className="bg-[#2A2A2A] hover:bg-[#333] border border-[#333] rounded-full px-3 py-1.5 h-auto font-semibold gap-2 shadow-sm">
                <img src={payToken.icon} alt={payToken.symbol} className="w-6 h-6 rounded-full" />
                <span className="text-white text-base">{payToken.symbol}</span>
                <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />
              </Button>
            </div>
          </div>

          <div className="flex justify-center -my-3 relative z-10">
            <button
              onClick={handleSwapTokens}
              className="rounded-xl bg-[#222] border-4 border-[#111] p-2 hover:bg-[#333] hover:rotate-180 transition-all duration-300 shadow-md group"
            >
              <ArrowDownUp className="w-5 h-5 text-gray-400 group-hover:text-[#f94119]" />
            </button>
          </div>

          <div className="bg-[#1A1A1A] rounded-2xl p-4 mt-2 mb-6 border border-[#222] hover:border-[#333] transition-colors">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-400">You Receive</span>
              <span className="text-sm text-gray-500">Balance: 0.00</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center w-1/2">
                {isQuoting ? (
                  <Loader2 className="w-6 h-6 animate-spin text-[#f94119]" />
                ) : (
                  <input
                    type="text"
                    value={receiveAmount}
                    readOnly
                    placeholder="0.0"
                    className="bg-transparent text-3xl text-white outline-none w-full placeholder:text-gray-600 font-medium opacity-80 cursor-not-allowed"
                  />
                )}
              </div>
              <Button onClick={() => openTokenModal("receive")} variant="secondary" className="bg-[#2A2A2A] hover:bg-[#333] border border-[#333] rounded-full px-3 py-1.5 h-auto font-semibold gap-2 shadow-sm">
                <img src={receiveToken.icon} alt={receiveToken.symbol} className="w-6 h-6 rounded-full" />
                <span className="text-white text-base">{receiveToken.symbol}</span>
                <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />
              </Button>
            </div>
          </div>

          {!connected ? (
            <Button onClick={() => setVisible(true)} className="w-full bg-[#f94119]/10 text-[#f94119] hover:bg-[#f94119]/20 h-14 text-lg font-semibold rounded-xl border border-[#f94119]/30 transition-all">
              Connect Wallet
            </Button>
          ) : (
            <div className="flex flex-col gap-3">
              {quoteResponse && quoteResponse.priceImpact > 1 && (
                <div className={`text-sm flex justify-between px-2 ${quoteResponse.priceImpact > 5 ? "text-red-500 font-bold" : "text-yellow-500"}`}>
                  <span>Price Impact</span>
                  <span>{quoteResponse.priceImpact.toFixed(2)}%</span>
                </div>
              )}
              <Button
                onClick={executeSwap}
                disabled={!quoteResponse || isSwapping || isQuoting || (quoteResponse && quoteResponse.priceImpact > 15)}
                className="w-full bg-[#f94119] hover:bg-[#e03a16] disabled:opacity-50 disabled:cursor-not-allowed text-white h-14 text-lg font-semibold rounded-xl transition-all shadow-[0_0_20px_rgba(249,65,25,0.3)] hover:shadow-[0_0_25px_rgba(249,65,25,0.5)]"
              >
                {isSwapping ? (
                  <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Swapping...</>
                ) : isQuoting ? (
                  <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Fetching price...</>
                ) : !quoteResponse && Number(payAmount) > 0 ? (
                  insufficientLiquidity ? "Insufficient Liquidity" : "Pool Does Not Exist"
                ) : quoteResponse && quoteResponse.priceImpact > 15 ? (
                  "Price Impact Too High"
                ) : (
                  "Swap"
                )}
              </Button>
            </div>
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

      <Dialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
        <DialogContent className="bg-[#111] border-[#222] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Swap Settings</DialogTitle>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-6">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-gray-300">Max Slippage</span>
              </div>
              <div className="flex items-center gap-2">
                {["0.1", "0.5", "1.0"].map(val => (
                  <Button
                    key={val}
                    variant={slippage === val && !customSlippage ? "default" : "secondary"}
                    onClick={() => {
                      setSlippage(val);
                      setCustomSlippage("");
                    }}
                    className={slippage === val && !customSlippage
                      ? "bg-[#f94119] hover:bg-[#e03a16] text-white flex-1"
                      : "bg-[#222] hover:bg-[#333] text-gray-300 flex-1 border border-[#333]"}
                  >
                    {val}%
                  </Button>
                ))}
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={customSlippage}
                    onChange={(e) => {
                      setCustomSlippage(e.target.value);
                      if (e.target.value) setSlippage(e.target.value);
                      else setSlippage("0.5");
                    }}
                    placeholder="=p"
                    className="w-full bg-[#222] border border-[#333] rounded-md h-9 px-3 py-1 text-sm text-white focus:outline-none focus:border-[#f94119] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-gray-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
