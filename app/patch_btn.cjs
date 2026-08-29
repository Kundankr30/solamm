const fs = require('fs');
const content = fs.readFileSync('src/pages/Liquidity.tsx', 'utf8');

const regex = /<Button\s+onClick=\{handleAddLiquidity\}[\s\S]*?<\/Button>/;
const match = content.match(regex);

if (!match) {
  console.log("Regex not found");
  process.exit(1);
}

const newBtn = `
            {mode === "add" ? (
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
            )}
`;

const newContent = content.replace(regex, newBtn.trim());
fs.writeFileSync('src/pages/Liquidity.tsx', newContent);
console.log("Success btn patch");
