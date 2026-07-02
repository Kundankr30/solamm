#![allow(dead_code)]

use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
/// Shared test harness for solamm LiteSVM integration tests.
///
/// Every integration test file includes this module via `mod common;` and then
/// uses `common::setup()` to get a `TestContext` ready with:
///   - a running LiteSVM instance with the solamm .so loaded
///   - two canonical mints (mint_a < mint_b)
///   - a funded payer with 10_000_000 tokens on each side
use anchor_lang::{prelude::Pubkey, system_program, InstructionData, ToAccountMetas};
use anchor_spl::token;
use litesvm::types::FailedTransactionMetadata;
use litesvm::LiteSVM;
use solana_keypair::Keypair;
use solana_message::Message;
use solana_signer::Signer;
use solana_transaction::Transaction;

// ─────────────────────────────────────────────────────────────────────────────
// Anchor error code constants (starts at 6000 per the Anchor framework).
// Ordering must match enum AmmCode in src/error.rs:
//   ZeroAmount         = 6000
//   ZeroLiquidity      = 6001
//   InsufficientLiquid = 6002
//   MathOverflow       = 6003
//   InvalidMintOrder   = 6004
//   InvalidFee         = 6005
//   SlippageExceeded   = 6006
// ─────────────────────────────────────────────────────────────────────────────
pub const ERR_ZERO_AMOUNT: u32 = 6000;
pub const ERR_ZERO_LIQUIDITY: u32 = 6001;
pub const ERR_INSUFFICIENT_LIQUIDITY: u32 = 6002;
pub const ERR_MATH_OVERFLOW: u32 = 6003;
pub const ERR_INVALID_MINT_ORDER: u32 = 6004;
pub const ERR_INVALID_FEE: u32 = 6005;
pub const ERR_SLIPPAGE_EXCEEDED: u32 = 6006;

// ─────────────────────────────────────────────────────────────────────────────
// TestResult type: helpers return this, tests can use `.unwrap()` / `.unwrap_err()`
// ─────────────────────────────────────────────────────────────────────────────
pub type TestResult = std::result::Result<(), FailedTransactionMetadata>;

/// Extract the custom Anchor error code from a failed transaction.
/// Returns `None` if the failure is not an `InstructionError::Custom` variant.
pub fn extract_anchor_error(fail: &FailedTransactionMetadata) -> Option<u32> {
    // TransactionError::InstructionError(_, InstructionError::Custom(code))
    // We pattern-match on the string representation to avoid importing
    // solana_transaction_error as a direct dependency.
    // Instead, we use the `err` field directly via Debug format comparison
    // or match on the underlying variant using the publicly visible fields.
    //
    // FailedTransactionMetadata.err is TransactionError (from solana_transaction_error).
    // We can pattern-match on it via the re-exported type in litesvm's dependency tree.
    // Since TransactionError is not re-exported by litesvm, use format-based extraction:
    let s = format!("{:?}", fail.err);
    // Example: `InstructionError(0, Custom(6001))`
    if let Some(start) = s.find("Custom(") {
        let rest = &s[start + 7..];
        if let Some(end) = rest.find(')') {
            return rest[..end].parse::<u32>().ok();
        }
    }
    None
}

// ─────────────────────────────────────────────────────────────────────────────
// TestContext
// ─────────────────────────────────────────────────────────────────────────────
pub struct TestContext {
    pub svm: LiteSVM,
    pub payer: Keypair,
    /// mint_a < mint_b (enforced during setup)
    pub mint_a: Pubkey,
    pub mint_b: Pubkey,
    // Pool PDAs
    pub pool: Pubkey,
    pub vault_a: Pubkey,
    pub vault_b: Pubkey,
    pub lp_mint: Pubkey,
    pub authority: Pubkey,
    // User token accounts
    pub user_token_a: Pubkey,
    pub user_token_b: Pubkey,
    /// User LP token account — must be created via create_user_lp_ata() after init_pool
    pub user_lp: Pubkey,
}

// ─────────────────────────────────────────────────────────────────────────────
// setup()
// ─────────────────────────────────────────────────────────────────────────────
pub fn setup() -> TestContext {
    let mut svm = LiteSVM::new();

    // Load compiled program (.so). Check SOLAMM_SO env var first, then fall
    // back to the conventional Anchor build output path.
    let so_path = std::env::var("SOLAMM_SO").unwrap_or_else(|_| {
        // CARGO_MANIFEST_DIR points to programs/solamm; go up two levels to
        // reach the workspace root, then into the Anchor deploy directory.
        let manifest_dir = env!("CARGO_MANIFEST_DIR");
        let workspace_root = std::path::Path::new(manifest_dir)
            .parent()
            .and_then(|p| p.parent())
            .expect("Could not determine workspace root from CARGO_MANIFEST_DIR");
        workspace_root
            .join("target/deploy/solamm.so")
            .to_string_lossy()
            .into_owned()
    });
    svm.add_program_from_file(solamm::id(), &so_path)
        .expect("Failed to load solamm.so — run `anchor build` first");

    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 100_000_000_000).unwrap(); // 100 SOL

    // ── Create two mints with mint_a < mint_b ─────────────────────────────────
    let (mint_a_kp, mint_b_kp) = loop {
        let a = Keypair::new();
        let b = Keypair::new();
        if a.pubkey() < b.pubkey() {
            break (a, b);
        }
    };
    let mint_a: Pubkey = mint_a_kp.pubkey();
    let mint_b: Pubkey = mint_b_kp.pubkey();

    // Allocate and initialise both mints.
    let mint_space = spl_token_mint_len();
    let mint_rent = svm.minimum_balance_for_rent_exemption(mint_space);

    let create_mint_a = system_create_account(&payer.pubkey(), &mint_a, mint_rent, mint_space);
    let create_mint_b = system_create_account(&payer.pubkey(), &mint_b, mint_rent, mint_space);
    let init_mint_a = spl_init_mint2(&mint_a, &payer.pubkey(), 6);
    let init_mint_b = spl_init_mint2(&mint_b, &payer.pubkey(), 6);

    send_setup(
        &mut svm,
        &payer,
        &[create_mint_a, create_mint_b, init_mint_a, init_mint_b],
        &[&payer, &mint_a_kp, &mint_b_kp],
    );

    // ── Derive pool PDAs ──────────────────────────────────────────────────────
    let prog = solamm::id();
    let (pool, _) =
        Pubkey::find_program_address(&[b"pool", mint_a.as_ref(), mint_b.as_ref()], &prog);
    let (vault_a, _) = Pubkey::find_program_address(&[b"vault_a", pool.as_ref()], &prog);
    let (vault_b, _) = Pubkey::find_program_address(&[b"vault_b", pool.as_ref()], &prog);
    let (lp_mint, _) = Pubkey::find_program_address(&[b"lp_mint", pool.as_ref()], &prog);
    let (authority, _) = Pubkey::find_program_address(&[b"authority", pool.as_ref()], &prog);

    // ── Create user ATAs for mint_a and mint_b ────────────────────────────────
    let user_token_a = ata_address(&payer.pubkey(), &mint_a);
    let user_token_b = ata_address(&payer.pubkey(), &mint_b);
    let user_lp = ata_address(&payer.pubkey(), &lp_mint);

    send_setup(
        &mut svm,
        &payer,
        &[
            create_ata(&payer.pubkey(), &payer.pubkey(), &mint_a),
            create_ata(&payer.pubkey(), &payer.pubkey(), &mint_b),
        ],
        &[&payer],
    );

    // ── Mint tokens to user ───────────────────────────────────────────────────
    send_setup(
        &mut svm,
        &payer,
        &[
            spl_mint_to(&mint_a, &user_token_a, &payer.pubkey(), 10_000_000),
            spl_mint_to(&mint_b, &user_token_b, &payer.pubkey(), 10_000_000),
        ],
        &[&payer],
    );

    TestContext {
        svm,
        payer,
        mint_a,
        mint_b,
        pool,
        vault_a,
        vault_b,
        lp_mint,
        authority,
        user_token_a,
        user_token_b,
        user_lp,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// TestContext: program instruction helpers
// ─────────────────────────────────────────────────────────────────────────────
impl TestContext {
    // ── init_pool ─────────────────────────────────────────────────────────────

    pub fn init_pool(&mut self, fee_bps: u64) -> TestResult {
        self.init_pool_with_mints(self.mint_a, self.mint_b, fee_bps)
    }

    pub fn init_pool_with_mints(
        &mut self,
        mint_a: Pubkey,
        mint_b: Pubkey,
        fee_bps: u64,
    ) -> TestResult {
        let prog = solamm::id();
        let (pool, _) =
            Pubkey::find_program_address(&[b"pool", mint_a.as_ref(), mint_b.as_ref()], &prog);
        let (vault_a, _) = Pubkey::find_program_address(&[b"vault_a", pool.as_ref()], &prog);
        let (vault_b, _) = Pubkey::find_program_address(&[b"vault_b", pool.as_ref()], &prog);
        let (lp_mint, _) = Pubkey::find_program_address(&[b"lp_mint", pool.as_ref()], &prog);
        let (authority, _) = Pubkey::find_program_address(&[b"authority", pool.as_ref()], &prog);

        let ix = make_ix(
            prog,
            solamm::instruction::InitPool { fee_bps }.data(),
            solamm::accounts::InitPool {
                pool,
                mint_a,
                mint_b,
                vault_a,
                vault_b,
                lp_mint,
                authority,
                payer: self.payer.pubkey(),
                system_program: system_program::ID,
                token_program: token::ID,
                rent: anchor_lang::prelude::rent::id(),
            }
            .to_account_metas(None),
        );
        self.send(&[ix], vec![self.payer.insecure_clone()])
    }

    // ── Create user LP ATA (call once after init_pool) ────────────────────────
    pub fn create_user_lp_ata(&mut self) -> TestResult {
        let lp_mint = self.lp_mint;
        let payer = self.payer.pubkey();
        let ix = create_ata(&payer, &payer, &lp_mint);
        self.send(&[ix], vec![self.payer.insecure_clone()])
    }

    // ── add_liquidity ─────────────────────────────────────────────────────────
    pub fn add_liq(&mut self, amount_a: u64, amount_b: u64, min_lp_out: u64) -> TestResult {
        let ix = make_ix(
            solamm::id(),
            solamm::instruction::AddLiquidity {
                amount_a,
                amount_b,
                min_lp_out,
            }
            .data(),
            solamm::accounts::AddLiquidity {
                pool: self.pool,
                vault_a: self.vault_a,
                vault_b: self.vault_b,
                lp_mint: self.lp_mint,
                authority: self.authority,
                user: self.payer.pubkey(),
                user_token_a: self.user_token_a,
                user_token_b: self.user_token_b,
                user_lp_account: self.user_lp,
                token_program: token::ID,
            }
            .to_account_metas(None),
        );
        self.send(&[ix], vec![self.payer.insecure_clone()])
    }

    // ── remove_liquidity ──────────────────────────────────────────────────────
    pub fn remove_liq(&mut self, lp_amount: u64, min_a_out: u64, min_b_out: u64) -> TestResult {
        let ix = make_ix(
            solamm::id(),
            solamm::instruction::RemoveLiquidity {
                lp_amount,
                min_a_out,
                min_b_out,
            }
            .data(),
            solamm::accounts::RemoveLiquidity {
                pool: self.pool,
                vault_a: self.vault_a,
                vault_b: self.vault_b,
                lp_mint: self.lp_mint,
                authority: self.authority,
                user: self.payer.pubkey(),
                user_token_a: self.user_token_a,
                user_token_b: self.user_token_b,
                user_lp_account: self.user_lp,
                token_program: token::ID,
            }
            .to_account_metas(None),
        );
        self.send(&[ix], vec![self.payer.insecure_clone()])
    }

    // ── swap ──────────────────────────────────────────────────────────────────
    pub fn swap(&mut self, amount_in: u64, min_amount_out: u64, a_to_b: bool) -> TestResult {
        let ix = make_ix(
            solamm::id(),
            solamm::instruction::Swap {
                amount_in,
                min_amount_out,
                a_to_b,
            }
            .data(),
            solamm::accounts::Swap {
                pool: self.pool,
                vault_a: self.vault_a,
                vault_b: self.vault_b,
                authority: self.authority,
                user: self.payer.pubkey(),
                user_token_a: self.user_token_a,
                user_token_b: self.user_token_b,
                token_program: token::ID,
            }
            .to_account_metas(None),
        );
        self.send(&[ix], vec![self.payer.insecure_clone()])
    }

    // ── Low-level send ────────────────────────────────────────────────────────
    pub fn send(&mut self, ixs: &[Instruction], signers: Vec<Keypair>) -> TestResult {
        let bh = self.svm.latest_blockhash();
        let refs: Vec<&Keypair> = signers.iter().collect();
        let msg = Message::new(ixs, Some(&self.payer.pubkey()));
        let tx = Transaction::new(&refs, msg, bh);
        self.svm.send_transaction(tx).map(|_| ())
    }

    // ── Account balance readers ───────────────────────────────────────────────
    pub fn token_balance(&self, addr: Pubkey) -> u64 {
        use anchor_spl::token::spl_token::state::Account as Tk;
        use solana_program_pack::Pack;
        let raw = self
            .svm
            .get_account(&addr)
            .expect("token account not found");
        Tk::unpack(&raw.data).expect("not a token account").amount
    }

    pub fn mint_supply(&self, mint: Pubkey) -> u64 {
        use anchor_spl::token::spl_token::state::Mint as Mk;
        use solana_program_pack::Pack;
        let raw = self.svm.get_account(&mint).expect("mint not found");
        Mk::unpack(&raw.data).expect("not a mint").supply
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SPL helpers (inline, avoiding spl-token as a direct dep)
// ─────────────────────────────────────────────────────────────────────────────

fn spl_token_mint_len() -> usize {
    use anchor_spl::token::spl_token::state::Mint;
    use solana_program_pack::Pack;
    Mint::LEN
}

/// Build a `SystemProgram::create_account` instruction.
fn system_create_account(from: &Pubkey, to: &Pubkey, lamports: u64, space: usize) -> Instruction {
    // SystemInstruction::CreateAccount = variant 0
    let mut data = Vec::with_capacity(52);
    data.extend_from_slice(&0u32.to_le_bytes()); // variant
    data.extend_from_slice(&lamports.to_le_bytes()); // lamports
    data.extend_from_slice(&(space as u64).to_le_bytes()); // space
    data.extend_from_slice(&anchor_spl::token::ID.to_bytes()); // owner = spl_token
    Instruction {
        program_id: system_program::ID,
        accounts: vec![AccountMeta::new(*from, true), AccountMeta::new(*to, true)],
        data,
    }
}

/// Build an SPL-Token `InitializeMint2` instruction.
fn spl_init_mint2(mint: &Pubkey, authority: &Pubkey, decimals: u8) -> Instruction {
    use anchor_spl::token::spl_token;
    spl_token::instruction::initialize_mint2(&spl_token::ID, mint, authority, None, decimals)
        .expect("initialize_mint2 failed")
}

/// Build an SPL-Token `MintTo` instruction.
fn spl_mint_to(mint: &Pubkey, dest: &Pubkey, auth: &Pubkey, amount: u64) -> Instruction {
    use anchor_spl::token::spl_token;
    spl_token::instruction::mint_to(&spl_token::ID, mint, dest, auth, &[], amount)
        .expect("mint_to failed")
}

// ─────────────────────────────────────────────────────────────────────────────
// ATA helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Derive the canonical Associated Token Account address.
pub fn ata_address(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    anchor_spl::associated_token::get_associated_token_address(owner, mint)
}

/// Build a `CreateAssociatedTokenAccount` instruction.
fn create_ata(funding: &Pubkey, owner: &Pubkey, mint: &Pubkey) -> Instruction {
    use anchor_spl::associated_token::spl_associated_token_account;
    spl_associated_token_account::instruction::create_associated_token_account(
        funding,
        owner,
        mint,
        &anchor_spl::token::ID,
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

fn make_ix(program_id: Pubkey, data: Vec<u8>, accounts: Vec<AccountMeta>) -> Instruction {
    Instruction {
        program_id,
        accounts,
        data,
    }
}

/// Send instructions in a single transaction; panics on failure (setup paths only).
fn send_setup(svm: &mut LiteSVM, payer: &Keypair, ixs: &[Instruction], signers: &[&Keypair]) {
    let bh = svm.latest_blockhash();
    let msg = Message::new(ixs, Some(&payer.pubkey()));
    let tx = Transaction::new(signers, msg, bh);
    svm.send_transaction(tx).expect("setup transaction failed");
}
