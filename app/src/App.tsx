    import { BrowserRouter, Routes, Route } from "react-router-dom";
    import { SolanaProvider } from "./components/wallet/WalletProvider";
    import { Navbar } from "./components/layout/Navbar";
    import { Home } from "./pages/Home";
    import { Toaster } from "sonner";


    // Pages (create empty ones for now).
    import { Swap } from "./pages/Swap";
    import { Pool } from "./pages/Pool";
    import { Liquidity } from "./pages/Liquidity";
    import { CreatePool } from "./pages/CreatePool";

    export default function App() {
      return (
        <SolanaProvider>
          <BrowserRouter>
            <div className="min-h-screen bg-[#0A0A0A] text-[#E8ECF4] relative overflow-hidden">
              {/* Subtle Grid Background */}
              <div
                className="pointer-events-none absolute inset-0 z-0"
                style={{
                  backgroundImage: 'linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
                  backgroundSize: '40px 40px'
                }}
              />

              {/* Orange Glow */}
              <div className="pointer-events-none absolute right-[-10%] top-[20%] w-[800px] h-[600px] rounded-full bg-[#f94119]/5 blur-[150px] z-0" />

              <div className="absolute top-0 w-full z-50">
                <Navbar />
              </div>
              <main className="relative z-10 min-h-screen pt-[76px] flex flex-col">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/swap" element={<Swap />} />
                  <Route path="/pool" element={<Pool />} />
                  <Route path="/liquidity" element={<Liquidity />} />
                  <Route path="/create-pool" element={<CreatePool />} />
                </Routes>
              </main>
              <Toaster theme="dark" position="bottom-right" />
            </div>
          </BrowserRouter>
        </SolanaProvider>
      );
    }
