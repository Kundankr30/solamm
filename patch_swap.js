const fs = require('fs');

let content = fs.readFileSync('app/src/pages/Swap.tsx', 'utf-8');

// Add state variables
content = content.replace(
  'const [customSlippage, setCustomSlippage] = useState("");',
  'const [customSlippage, setCustomSlippage] = useState("");\n  const [payBalance, setPayBalance] = useState("0.00");\n  const [receiveBalance, setReceiveBalance] = useState("0.00");'
);

// Add useEffect
const useEffectCode = `
  useEffect(() => {
    const fetchBalances = async () => {
      if (!publicKey) {
        setPayBalance("0.00");
        setReceiveBalance("0.00");
        return;
      }

      try {
        const payMint = new PublicKey(payToken.address);
        const receiveMint = new PublicKey(receiveToken.address);
        
        const payAta = getAssociatedTokenAddressSync(payMint, publicKey);
        const receiveAta = getAssociatedTokenAddressSync(receiveMint, publicKey);

        try {
          const pb = await connection.getTokenAccountBalance(payAta);
          setPayBalance(pb.value.uiAmountString || "0.00");
        } catch (e) {
          setPayBalance("0.00");
        }

        try {
          const rb = await connection.getTokenAccountBalance(receiveAta);
          setReceiveBalance(rb.value.uiAmountString || "0.00");
        } catch (e) {
          setReceiveBalance("0.00");
        }

      } catch (err) {
        console.error("Failed to fetch balances", err);
      }
    };

    fetchBalances();
    // Set up polling every 5 seconds
    const interval = setInterval(fetchBalances, 5000);
    return () => clearInterval(interval);
  }, [publicKey, payToken.address, receiveToken.address, connection]);
`;

content = content.replace(
  'useEffect(() => {',
  useEffectCode + '\n  useEffect(() => {'
);

// Replace Balance text
content = content.replace(
  '<span className="text-sm text-gray-500">Balance: 0.00</span>',
  '<span className="text-sm text-gray-500">Balance: {payBalance}</span>'
);
content = content.replace(
  '<span className="text-sm text-gray-500">Balance: 0.00</span>',
  '<span className="text-sm text-gray-500">Balance: {receiveBalance}</span>'
);

fs.writeFileSync('app/src/pages/Swap.tsx', content);
