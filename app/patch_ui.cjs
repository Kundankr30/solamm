const fs = require('fs');
const content = fs.readFileSync('src/pages/Liquidity.tsx', 'utf8');

const regex = /<div className="flex justify-between items-center mb-6">[\s\S]*?(?={!connected \? \()/;
const match = content.match(regex);

if (!match) {
  console.log("Regex not found");
  process.exit(1);
}

const newUI = `
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white">Liquidity (Devnet)</h2>
            <Button onClick={() => setIsSettingsModalOpen(true)} variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-[#222] rounded-full">
              <Settings className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex p-1 bg-[#1A1A1A] border border-[#222] rounded-lg mb-6">
            <button 
              onClick={() => setMode("add")}
              className={\`flex-1 py-2 text-sm font-semibold rounded-md transition-colors \${mode === "add" ? "bg-[#f94119] text-white" : "text-gray-400 hover:text-white"}\`}
            >
              Add
            </button>
            <button 
              onClick={() => setMode("remove")}
              className={\`flex-1 py-2 text-sm font-semibold rounded-md transition-colors \${mode === "remove" ? "bg-[#f94119] text-white" : "text-gray-400 hover:text-white"}\`}
            >
              Remove
            </button>
          </div>

          {mode === "add" ? (
            <>
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
            </>
          ) : (
            <>
              <div className="bg-[#1A1A1A] rounded-2xl p-4 mb-2 border border-[#222] hover:border-[#333] transition-colors focus-within:border-[#444]">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-400">Pool Pair</span>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex -space-x-2">
                    <img src={tokenA.icon} alt={tokenA.symbol} className="w-8 h-8 rounded-full z-10 border-2 border-[#1A1A1A]" />
                    <img src={tokenB.icon} alt={tokenB.symbol} className="w-8 h-8 rounded-full border-2 border-[#1A1A1A]" />
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={() => openTokenModal("A")} variant="outline" className="bg-[#222] border-[#333] hover:bg-[#333] h-8 text-xs">{tokenA.symbol}</Button>
                    <Button onClick={() => openTokenModal("B")} variant="outline" className="bg-[#222] border-[#333] hover:bg-[#333] h-8 text-xs">{tokenB.symbol}</Button>
                  </div>
                </div>
              </div>

              <div className="bg-[#1A1A1A] rounded-2xl p-4 mt-2 mb-6 border border-[#222] hover:border-[#333] transition-colors focus-within:border-[#444]">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-400">LP Tokens to Burn</span>
                  <span className="text-sm text-gray-400">Bal: {myLpBalance}</span>
                </div>
                <div className="flex items-center justify-between">
                  <input
                    type="number"
                    placeholder="0"
                    value={burnAmount}
                    onChange={(e) => setBurnAmount(e.target.value)}
                    className="bg-transparent text-3xl font-medium text-white outline-none w-2/3 placeholder:text-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <Button 
                    onClick={() => setBurnAmount(myLpBalance)}
                    variant="outline" 
                    className="bg-[#2A2A2A] border-[#333] hover:bg-[#333] text-[#f94119] text-xs h-7 px-2 font-bold uppercase"
                  >
                    Max
                  </Button>
                </div>
              </div>
            </>
          )}

          `;

const newContent = content.replace(regex, newUI);
fs.writeFileSync('src/pages/Liquidity.tsx', newContent);
console.log("Success UI patch");
