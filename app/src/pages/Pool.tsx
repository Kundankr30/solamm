import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { NavLink } from "react-router-dom";
import { PROGRAM_ID } from "../lib/program";
import { Loader2 } from "lucide-react";
import { KNOWN_TOKENS } from "../lib/tokens";

type PoolData = {
  pair: string;
  tokenA: typeof KNOWN_TOKENS[0];
  tokenB: typeof KNOWN_TOKENS[0];
  vaultABalance: string;
  vaultBBalance: string;
  myLpBalance: string;
  exists: boolean | "rate_limited";
};

export function Pool() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const [pools, setPools] = useState<PoolData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPools = async () => {
      try {
        const pairs: [typeof KNOWN_TOKENS[0], typeof KNOWN_TOKENS[0]][] = [];
        // Generate all unique combinations
        for (let i = 0; i < KNOWN_TOKENS.length; i++) {
          for (let j = i + 1; j < KNOWN_TOKENS.length; j++) {
            pairs.push([KNOWN_TOKENS[i], KNOWN_TOKENS[j]]);
          }
        }

        const poolDataPromises = pairs.map(async ([tokenA, tokenB]) => {
          const mintAPub = new PublicKey(tokenA.address);
          const mintBPub = new PublicKey(tokenB.address);
          
          const [mint1, mint2] = Buffer.compare(mintAPub.toBuffer(), mintBPub.toBuffer()) < 0 
            ? [mintAPub, mintBPub] 
            : [mintBPub, mintAPub];

          const poolPda = PublicKey.findProgramAddressSync([Buffer.from("pool"), mint1.toBuffer(), mint2.toBuffer()], PROGRAM_ID)[0];
          const vaultA = PublicKey.findProgramAddressSync([Buffer.from("vault_a"), poolPda.toBuffer()], PROGRAM_ID)[0];
          const vaultB = PublicKey.findProgramAddressSync([Buffer.from("vault_b"), poolPda.toBuffer()], PROGRAM_ID)[0];
          const lpMint = PublicKey.findProgramAddressSync([Buffer.from("lp_mint"), poolPda.toBuffer()], PROGRAM_ID)[0];

          try {
            const [vA, vB] = await Promise.all([
              connection.getTokenAccountBalance(vaultA),
              connection.getTokenAccountBalance(vaultB),
            ]);

            let myLpBalance = "0";
            if (publicKey) {
              const userLpAta = getAssociatedTokenAddressSync(lpMint, publicKey);
              try {
                const userLp = await connection.getTokenAccountBalance(userLpAta);
                myLpBalance = Number(userLp.value.uiAmount).toLocaleString(undefined, { maximumFractionDigits: 2 });
              } catch {
                myLpBalance = "0";
              }
            }

            return {
              pair: `${tokenA.symbol}-${tokenB.symbol}`,
              tokenA,
              tokenB,
              vaultABalance: Number(vA.value.uiAmount).toLocaleString(undefined, { maximumFractionDigits: 2 }) + " " + (mint1.equals(mintAPub) ? tokenA.symbol : tokenB.symbol),
              vaultBBalance: Number(vB.value.uiAmount).toLocaleString(undefined, { maximumFractionDigits: 2 }) + " " + (mint2.equals(mintBPub) ? tokenB.symbol : tokenA.symbol),
              myLpBalance,
              exists: true
            };
          } catch (e: any) {
            // If it's a 429 Rate Limit, we want to retain the old pool state, not mark it as non-existent!
            if (e.message && e.message.includes("429")) {
              return { pair: `${tokenA.symbol}-${tokenB.symbol}`, tokenA, tokenB, vaultABalance: "", vaultBBalance: "", myLpBalance: "0", exists: "rate_limited" };
            }
            // Pool does not exist
            return { pair: `${tokenA.symbol}-${tokenB.symbol}`, tokenA, tokenB, vaultABalance: "", vaultBBalance: "", myLpBalance: "0", exists: false };
          }
        });

        const results = await Promise.all(poolDataPromises);
        
        setPools((prevPools) => {
          const newPools = prevPools.map(pool => pool); // Clone prev
          
          results.forEach(res => {
            if (res.exists === true) {
              // Update or add valid pool
              const existingIndex = newPools.findIndex(p => p.pair === res.pair);
              if (existingIndex >= 0) newPools[existingIndex] = res as typeof newPools[0];
              else newPools.push(res as typeof newPools[0]);
            } else if (res.exists === false) {
              // Definitely doesn't exist, remove it if it was there
              const existingIndex = newPools.findIndex(p => p.pair === res.pair);
              if (existingIndex >= 0) newPools.splice(existingIndex, 1);
            }
            // If res.exists === "rate_limited", we just do nothing and keep the old state!
          });
          return newPools;
        });
      } catch (err) {
        console.error("Failed to fetch pools", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPools();
    const interval = setInterval(fetchPools, 10000);
    return () => clearInterval(interval);
  }, [connection, publicKey]);

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Liquidity Pools</h1>
          <p className="text-gray-400">Earn yield by providing liquidity to the ecosystem</p>
        </div>
        <div className="flex gap-4">
          <NavLink to="/create-pool">
            <Button variant="outline" className="border-[#f94119] text-[#f94119] hover:bg-[#f94119]/10 hover:text-[#f94119] rounded-xl transition-colors">
              Create New Pool
            </Button>
          </NavLink>
        </div>
      </div>

      <Card className="bg-[#111] border-[#222] shadow-2xl overflow-hidden relative mb-8">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#f94119] opacity-5 blur-[120px] pointer-events-none" />
        
        <CardContent className="p-0 relative z-10">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-[#222] bg-[#151515]">
                  <th className="p-4 text-sm font-medium text-gray-400">Pool</th>
                  <th className="p-4 text-sm font-medium text-gray-400">Total Reserves (Live)</th>
                  <th className="p-4 text-sm font-medium text-gray-400">Fee Tier</th>
                  <th className="p-4 text-sm font-medium text-gray-400">My LP Balance</th>
                  <th className="p-4 text-sm font-medium text-gray-400 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400">
                      <div className="flex justify-center items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" /> Fetching Pools...
                      </div>
                    </td>
                  </tr>
                ) : pools.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      No liquidity pools initialized yet. Create one!
                    </td>
                  </tr>
                ) : (
                  pools.map((pool, idx) => (
                    <tr key={idx} className="border-b border-[#222] hover:bg-[#1A1A1A] transition-colors relative">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex -space-x-2">
                            <img src={pool.tokenA.icon} alt={pool.tokenA.symbol} className="w-8 h-8 rounded-full border-2 border-[#111] z-10 shadow-sm bg-[#333]" />
                            <img src={pool.tokenB.icon} alt={pool.tokenB.symbol} className="w-8 h-8 rounded-full border-2 border-[#111] z-0 shadow-sm bg-[#222]" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-white flex items-center gap-2">
                              {pool.pair}
                              <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00C853] opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00C853]"></span>
                              </span>
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-gray-300 font-medium">
                        {pool.vaultABalance}
                        <br/><span className="text-gray-500 text-sm">{pool.vaultBBalance}</span>
                      </td>
                      <td className="p-4 text-gray-300">
                        <span className="bg-[#222] border border-[#333] px-2 py-1 rounded-md text-xs">0.3%</span>
                      </td>
                      <td className="p-4">
                        <span className={`font-medium ${pool.myLpBalance !== "0" ? "text-white" : "text-gray-500"}`}>
                          {pool.myLpBalance} LP
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <NavLink to="/liquidity">
                          <Button variant="secondary" className="bg-[#f94119]/10 hover:bg-[#f94119]/20 text-[#f94119] border border-[#f94119]/30 rounded-lg h-9 font-medium">
                            Add Liquidity
                          </Button>
                        </NavLink>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
