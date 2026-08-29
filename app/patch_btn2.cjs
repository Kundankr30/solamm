const fs = require('fs');
const content = fs.readFileSync('src/pages/Liquidity.tsx', 'utf8');

const regex = /<CardContent className="p-4 sm:p-6 relative z-10">[\s\S]*?<\/CardContent>/;
const match = content.match(regex);

if (match) {
  let newContent = match[0].replace(
    /\{!connected \? \([\s\S]*?\)\s*:\s*mode === "add" \? \([\s\S]*?\}\)/,
    `{!connected ? (
            <Button onClick={() => setVisible(true)} className="w-full bg-[#f94119]/10 text-[#f94119] hover:bg-[#f94119]/20 h-14 text-lg font-semibold rounded-xl border border-[#f94119]/30 transition-all">
              Connect Wallet
            </Button>
          ) : mode === "add" ? (
            <Button
              onClick={handleAddLiquidity}
              disabled={isAdding || !amountA || !amountB || !poolExists}
              className="w-full bg-[#f94119] hover:bg-[#e03a16] disabled:opacity-50 disabled:cursor-not-allowed text-white h-14 text-lg font-semibold rounded-xl transition-all shadow-[0_0_20px_rgba(249,65,25,0.3)] hover:shadow-[0_0_25px_rgba(249,65,25,0.5)]"
            >
              {!poolExists ? "Pool Does Not Exist" : isAdding ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Supplying...</> : "Supply"}
            </Button>
          ) : (
            <Button
              onClick={handleRemoveLiquidity}
              disabled={isAdding || !burnAmount || !poolExists || Number(burnAmount) <= 0 || Number(burnAmount) > Number(myLpBalance)}
              className="w-full bg-[#f94119] hover:bg-[#e03a16] disabled:opacity-50 disabled:cursor-not-allowed text-white h-14 text-lg font-semibold rounded-xl transition-all shadow-[0_0_20px_rgba(249,65,25,0.3)] hover:shadow-[0_0_25px_rgba(249,65,25,0.5)]"
            >
              {!poolExists ? "Pool Does Not Exist" : Number(burnAmount) > Number(myLpBalance) ? "Insufficient LP Balance" : isAdding ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Removing...</> : "Remove Liquidity"}
            </Button>
          )}`
  );
  fs.writeFileSync('src/pages/Liquidity.tsx', content.replace(regex, newContent));
}
