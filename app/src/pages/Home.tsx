import { ArrowUpRight, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Home() {
  return (
    <div className="flex-1 w-full flex flex-col justify-center items-center relative z-10">
      <div className="container mx-auto px-8 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-8 items-center min-h-[calc(100vh-100px)] py-12">
        {/* Left Column */}
        <div className="flex flex-col justify-center max-w-xl">
          <div className="flex items-center gap-4 text-[#a3a3a3] text-xs font-semibold tracking-[0.2em] mb-12 uppercase">
            <div className="h-[1px] w-8 bg-[#f94119]"></div>
            For DeFi Traders & LPs
          </div>

          <h1 className="text-6xl md:text-7xl font-bold leading-[1.1] mb-8 text-white tracking-tight">
            One click.<br />
            Every token.<br />
            Every swap<br />
            <span className="text-[#f94119]">instant.</span>
          </h1>

          <p className="text-[#a3a3a3] text-lg leading-relaxed mb-12 max-w-md">
            SolAMM aggregates the best liquidity pools on Solana, ensuring the best rates for your swaps, and hands each trader a seamless experience.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
            <Button size="lg" className="h-14 px-8 text-sm font-semibold tracking-wider bg-gradient-to-r from-[#f94119] to-[#d63211] hover:from-[#d63211] hover:to-[#c22d10] text-white w-full sm:w-auto uppercase rounded-none transition-all shadow-[0_0_20px_rgba(249,65,25,0.2)] border-0">
              Start Swapping
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 text-sm font-semibold tracking-wider border-[#333333] hover:bg-[#1a1a1a] text-white w-full sm:w-auto uppercase rounded-none bg-transparent">
              <Terminal className="mr-2 h-4 w-4 text-[#a3a3a3]" />
              Explore Pools
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[10px] md:text-xs text-[#737373] tracking-widest uppercase">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#f94119]"></div>
              Human-Approved
            </div>
            <span className="text-[#333]">|</span>
            <span>SHA-256 Audited</span>
            <span className="text-[#333]">|</span>
            <span>MIT Open-Core</span>
          </div>
        </div>

        {/* Right Column - Mock Dashboard */}
        <div className="w-full flex justify-center lg:justify-end">
          <div className="w-full max-w-lg bg-[#0d0f12] border border-[#1f242d] rounded-sm overflow-hidden shadow-2xl font-mono text-xs">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f242d] bg-[#111418]">
              <div className="flex items-center gap-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 22h20L12 2z" fill="#f94119" />
                </svg>
                <span className="text-[#8b949e]">console.solamm.dev / queue</span>
              </div>
              <div className="flex items-center gap-2 text-[#8b949e]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#f94119]"></div>
                LIVE
              </div>
            </div>

            {/* Filter tags */}
            <div className="flex gap-2 p-4 border-b border-[#1f242d]">
              <div className="px-2 py-1 bg-[#1a1f26] border border-[#2d333b] text-[#8b949e] rounded-sm">Token: <span className="text-white">All</span></div>
              <div className="px-2 py-1 bg-[#1a1f26] border border-[#2d333b] text-[#8b949e] rounded-sm">Slippage: <span className="text-white">Any</span></div>
            </div>

            {/* Table */}
            <div className="w-full text-left border-collapse">
              <div className="grid grid-cols-12 px-4 py-3 text-[#8b949e] border-b border-[#1f242d] uppercase text-[10px] tracking-wider">
                <div className="col-span-3">Pool</div>
                <div className="col-span-4">Volume (24h)</div>
                <div className="col-span-2">Fee</div>
                <div className="col-span-3">Status</div>
              </div>

              <div className="grid grid-cols-12 px-4 py-4 border-b border-[#1f242d] items-center hover:bg-[#15191f] transition-colors">
                <div className="col-span-3 flex items-center gap-2 text-white">
                  <div className="w-1.5 h-1.5 bg-[#4e46e5]"></div>
                  SOL / USDC
                </div>
                <div className="col-span-4 text-white">$12.4M</div>
                <div className="col-span-2">
                  <div className="px-1.5 py-0.5 border border-[#4e46e5]/30 text-[#4e46e5] inline-block text-[10px]">0.01%</div>
                </div>
                <div className="col-span-3 flex items-center gap-2 text-[#8b949e] text-[10px]">
                  <div className="w-1.5 h-1.5 bg-[#46a758] rounded-full"></div>
                  OPTIMIZED
                </div>
              </div>

              <div className="grid grid-cols-12 px-4 py-4 border-b border-[#1f242d] items-center hover:bg-[#15191f] transition-colors">
                <div className="col-span-3 flex items-center gap-2 text-white">
                  <div className="w-1.5 h-1.5 bg-[#8b5cf6]"></div>
                  RAY / SOL
                </div>
                <div className="col-span-4 text-white">$840K</div>
                <div className="col-span-2">
                  <div className="px-1.5 py-0.5 border border-[#8b5cf6]/30 text-[#8b5cf6] inline-block text-[10px]">0.05%</div>
                </div>
                <div className="col-span-3 flex items-center gap-2 text-[#8b949e] text-[10px]">
                  <div className="w-1.5 h-1.5 bg-[#e3b341] rounded-full"></div>
                  HIGH APR
                </div>
              </div>

              <div className="grid grid-cols-12 px-4 py-4 border-b border-[#1f242d] items-center hover:bg-[#15191f] transition-colors">
                <div className="col-span-3 flex items-center gap-2 text-white">
                  <div className="w-1.5 h-1.5 bg-[#f97316]"></div>
                  BONK / SOL
                </div>
                <div className="col-span-4 text-white">$4.2M</div>
                <div className="col-span-2">
                  <div className="px-1.5 py-0.5 border border-[#f97316]/30 text-[#f97316] inline-block text-[10px]">0.03%</div>
                </div>
                <div className="col-span-3 flex items-center gap-2 text-[#8b949e] text-[10px]">
                  <div className="w-1.5 h-1.5 bg-[#f94119] rounded-full"></div>
                  VOLATILE
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#0d0f12] text-[#6e7681] text-[10px] tracking-widest uppercase">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#f94119] rounded-full"></div>
                STREAM ACTIVE
              </div>
              <div>JUPITER · RAYDIUM</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
