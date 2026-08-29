    import { NavLink } from "react-router-dom";
    import { useWallet } from "@solana/wallet-adapter-react";
    import { useWalletModal } from "@solana/wallet-adapter-react-ui";
    import { FaucetButton } from "./FaucetButton";

    function WalletButton() {
      const { connected, publicKey, disconnect } = useWallet();
      const { setVisible } = useWalletModal();

      if (connected && publicKey) {
        return (
          <button
            onClick={disconnect}
            className="bg-transparent border border-[#f94119]/50 text-[#f94119] text-sm font-medium px-5 py-2 hover:bg-[#f94119]/10 transition-colors"
          >
            {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
          </button>
        );
      }

      return (
        <button
          onClick={() => setVisible(true)}
          className="bg-transparent border border-[#f94119]/50 text-[#f94119] text-sm font-medium px-5 py-2 hover:bg-[#f94119]/10 transition-colors"
        >
          Connect wallet
        </button>
      );
    }

    const links = [
      { to: "/swap", label: "Swap" },
      { to: "/pool", label: "Pools" },
      { to: "/liquidity", label: "Liquidity" },
      { to: "/create-pool", label: "Create Pool" },
    ];

    export function Navbar() {
      return (
        <nav className="flex items-center justify-between px-8 py-6 bg-transparent w-full">
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 22h20L12 2z" fill="#f94119" />
            </svg>
            <NavLink to="/" className="text-white font-semibold text-lg flex gap-1">
              SolAMM <span className="text-gray-400 font-normal">Exchange</span>
            </NavLink>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            {links.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  isActive
                    ? "text-white"
                    : "text-gray-400 hover:text-white transition-colors"
                }
              >
                {label}
              </NavLink>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <a href="https://github.com/Kundankr30/solamm" className="text-gray-400 hover:text-white transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
            </a>
            <FaucetButton />
            <WalletButton />
          </div>
        </nav>
      );
    }
