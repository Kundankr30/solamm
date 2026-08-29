import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, AccountLayout } from "@solana/spl-token";
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
  feeBps: number;
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
        const pairs = [];
        
        for (let i = 0; i < KNOWN_TOKENS.length; i++) {
          for (let j = i + 1; j < KNOWN_TOKENS.length; j++) {
            const tA = KNOWN_TOKENS[i];
            const tB = KNOWN_TOKENS[j];
            const mintAPub = new PublicKey(tA.address);
            const mintBPub = new PublicKey(tB.address);
            
            const [mint1, mint2] = Buffer.compare(mintAPub.toBuffer(), mintBPub.toBuffer()) < 0 
              ? [mintAPub, mintBPub] 
              : [mintBPub, mintAPub];

            const poolPda = PublicKey.findProgramAddressSync([Buffer.from("pool"), mint1.toBuffer(), mint2.toBuffer()], PROGRAM_ID)[0];
            const vaultA = PublicKey.findProgramAddressSync([Buffer.from("vault_a"), poolPda.toBuffer()], PROGRAM_ID)[0];
            const vaultB = PublicKey.findProgramAddressSync([Buffer.from("vault_b"), poolPda.toBuffer()], PROGRAM_ID)[0];
            const lpMint = PublicKey.findProgramAddressSync([Buffer.from("lp_mint"), poolPda.toBuffer()], PROGRAM_ID)[0];
            const userLpAta = publicKey ? getAssociatedTokenAddressSync(lpMint, publicKey) : null;
            
            pairs.push({ tokenA: tA, tokenB: tB, mint1, mint2, poolPda, vaultA, vaultB, lpMint, userLpAta });
          }
        }

        const pubkeysToFetch: PublicKey[] = [];
        pairs.forEach(p => {
          pubkeysToFetch.push(p.poolPda, p.vaultA, p.vaultB);
          if (p.userLpAta) pubkeysToFetch.push(p.userLpAta);
        });

        // 1 SINGLE RPC CALL FOR ALL ACCOUNTS!
        const accountInfos = await connection.getMultipleAccountsInfo(pubkeysToFetch);
        
        let index = 0;
        const results = pairs.map(p => {
          const poolInfo = accountInfos[index++];
          const vaultAInfo = accountInfos[index++];
          const vaultBInfo = accountInfos[index++];
          const userLpInfo = p.userLpAta ? accountInfos[index++] : null;

          if (!poolInfo || !vaultAInfo || !vaultBInfo) {
            return { pair: `${p.tokenA.symbol}-${p.tokenB.symbol}`, tokenA: p.tokenA, tokenB: p.tokenB, vaultABalance: "", vaultBBalance: "", myLpBalance: "0", feeBps: 30, exists: false as const };
          }

          // Decode fee_bps from pool account: 8 (discriminator) + 32*6 (pubkeys) = offset 200
          const feeBps = poolInfo.data.readUIntLE(200, 8);

          const vaultAData = AccountLayout.decode(vaultAInfo.data);
          const vaultBData = AccountLayout.decode(vaultBInfo.data);
          
          const aDecimals = p.mint1.equals(new PublicKey(p.tokenA.address)) ? p.tokenA.decimals : p.tokenB.decimals;
          const bDecimals = p.mint2.equals(new PublicKey(p.tokenB.address)) ? p.tokenB.decimals : p.tokenA.decimals;

          const vAUi = Number(vaultAData.amount) / Math.pow(10, aDecimals);
          const vBUi = Number(vaultBData.amount) / Math.pow(10, bDecimals);

          let myLpBalance = "0";
          if (userLpInfo) {
            const userLpData = AccountLayout.decode(userLpInfo.data);
            // Assuming 6 decimals for LP tokens
            myLpBalance = (Number(userLpData.amount) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 });
          }

          return {
            pair: `${p.tokenA.symbol}-${p.tokenB.symbol}`,
            tokenA: p.tokenA,
            tokenB: p.tokenB,
            vaultABalance: vAUi.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " " + (p.mint1.equals(new PublicKey(p.tokenA.address)) ? p.tokenA.symbol : p.tokenB.symbol),
            vaultBBalance: vBUi.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " " + (p.mint2.equals(new PublicKey(p.tokenB.address)) ? p.tokenB.symbol : p.tokenA.symbol),
            myLpBalance,
            feeBps,
            exists: true as const
          };
        });

        setPools(results.filter(p => p.exists));
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
                        <span className="bg-[#222] border border-[#333] px-2 py-1 rounded-md text-xs">{(pool.feeBps / 100).toFixed(pool.feeBps % 100 === 0 ? 0 : 1)}%</span>
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
