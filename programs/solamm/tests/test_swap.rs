mod common;

use common::{
    extract_anchor_error, setup, ERR_SLIPPAGE_EXCEEDED, ERR_ZERO_AMOUNT, ERR_ZERO_LIQUIDITY,
};

// Helper: pool with 1_000_000 A / 1_000_000 B at fee_bps = 30

fn ready_pool_with_liquidity() -> common::TestContext {
    let mut ctx = setup();
    ctx.init_pool(30).unwrap();
    ctx.create_user_lp_ata().unwrap();
    ctx.add_liq(1_000_000, 1_000_000, 0).unwrap();
    ctx
}

// A → B swap: tokens move in the right direction

#[test]
fn test_swap_a_to_b_moves_tokens() {
    let mut ctx = ready_pool_with_liquidity();

    let vault_a_before = ctx.token_balance(ctx.vault_a);
    let vault_b_before = ctx.token_balance(ctx.vault_b);
    let user_a_before = ctx.token_balance(ctx.user_token_a);
    let user_b_before = ctx.token_balance(ctx.user_token_b);

    ctx.swap(10_000, 0, true).unwrap();

    let vault_a_after = ctx.token_balance(ctx.vault_a);
    let vault_b_after = ctx.token_balance(ctx.vault_b);
    let user_a_after = ctx.token_balance(ctx.user_token_a);
    let user_b_after = ctx.token_balance(ctx.user_token_b);

    // Vault A grew by amount_in.
    assert_eq!(vault_a_after, vault_a_before + 10_000);
    // Vault B shrank (paid out to user).
    assert!(
        vault_b_after < vault_b_before,
        "vault_b must decrease on A→B swap"
    );
    // User A shrunk by amount_in.
    assert_eq!(user_a_after, user_a_before - 10_000);
    // User B increased by amount_out.
    assert!(user_b_after > user_b_before, "user must receive B tokens");
    // Consistency: vault_b decrease == user_b increase.
    let amount_out = vault_b_before - vault_b_after;
    assert_eq!(user_b_after - user_b_before, amount_out);
}

// B → A swap: tokens move in the right direction

#[test]
fn test_swap_b_to_a_moves_tokens() {
    let mut ctx = ready_pool_with_liquidity();

    let vault_a_before = ctx.token_balance(ctx.vault_a);
    let vault_b_before = ctx.token_balance(ctx.vault_b);
    let user_a_before = ctx.token_balance(ctx.user_token_a);
    let user_b_before = ctx.token_balance(ctx.user_token_b);

    ctx.swap(10_000, 0, false).unwrap();

    let vault_b_after = ctx.token_balance(ctx.vault_b);
    let vault_a_after = ctx.token_balance(ctx.vault_a);

    // Vault B grew (received amount_in B tokens).
    assert_eq!(vault_b_after, vault_b_before + 10_000);
    // Vault A shrank (paid out A tokens).
    assert!(
        vault_a_after < vault_a_before,
        "vault_a must decrease on B→A swap"
    );
    // User B shrunk.
    assert_eq!(ctx.token_balance(ctx.user_token_b), user_b_before - 10_000);
    // User A increased.
    assert!(
        ctx.token_balance(ctx.user_token_a) > user_a_before,
        "user must receive A tokens"
    );
}

// Output matches the constant-product formula exactly

#[test]
fn test_swap_output_matches_formula() {
    let mut ctx = ready_pool_with_liquidity();

    // reserve_in = 1_000_000, reserve_out = 1_000_000, amount_in = 10_000, fee = 30
    // fee_multiplier = 10_000 - 30 = 9_970
    // amount_in_with_fee = 10_000 * 9_970 = 99_700_000
    // num = 1_000_000 * 99_700_000       = 99_700_000_000_000
    // den = 1_000_000 * 10_000 + 99_700_000 = 10_000_000_000 + 99_700_000 = 10_099_700_000
    // out = 99_700_000_000_000 / 10_099_700_000 = 9_871 (floor: 9871.something)
    let vault_b_before = ctx.token_balance(ctx.vault_b);
    ctx.swap(10_000, 0, true).unwrap();
    let amount_out = vault_b_before - ctx.token_balance(ctx.vault_b);
    assert_eq!(
        amount_out, 9_871,
        "output must match constant-product formula"
    );
}

// Fee-bearing swap causes k = reserve_a * reserve_b to grow

#[test]
fn test_swap_fee_grows_invariant() {
    let mut ctx = ready_pool_with_liquidity();

    let va_before = ctx.token_balance(ctx.vault_a) as u128;
    let vb_before = ctx.token_balance(ctx.vault_b) as u128;
    let k_before = va_before * vb_before;

    ctx.swap(10_000, 0, true).unwrap();

    let va_after = ctx.token_balance(ctx.vault_a) as u128;
    let vb_after = ctx.token_balance(ctx.vault_b) as u128;
    let k_after = va_after * vb_after;

    // Fee retains a portion of amount_in in the pool, so k must grow.
    assert!(
        k_after >= k_before,
        "k must not decrease after a fee-bearing swap"
    );
}

// Slippage: min_amount_out > actual output → SlippageExceeded

#[test]
fn test_swap_slippage_fails() {
    let mut ctx = ready_pool_with_liquidity();
    // Actual output = 9_871; demand 9_872 → SlippageExceeded.
    let err = ctx.swap(10_000, 9_872, true).unwrap_err();
    let code = extract_anchor_error(&err).expect("expected custom anchor error");
    assert_eq!(code, ERR_SLIPPAGE_EXCEEDED);
}

// ─────────────────────────────────────────────────────────────────────────────
// amount_in == 0 → ZeroAmount
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_swap_zero_amount_fails() {
    let mut ctx = ready_pool_with_liquidity();
    let err = ctx.swap(0, 0, true).unwrap_err();
    let code = extract_anchor_error(&err).expect("expected custom anchor error");
    assert_eq!(code, ERR_ZERO_AMOUNT);
}

// ─────────────────────────────────────────────────────────────────────────────
// Swap on empty pool → ZeroLiquidity
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_swap_empty_pool_fails() {
    let mut ctx = setup();
    ctx.init_pool(30).unwrap();
    ctx.create_user_lp_ata().unwrap();
    // Do NOT add liquidity — vaults are empty (reserve_in = reserve_out = 0).
    let err = ctx.swap(10_000, 0, true).unwrap_err();
    let code = extract_anchor_error(&err).expect("expected custom anchor error");
    assert_eq!(code, ERR_ZERO_LIQUIDITY);
}

// ─────────────────────────────────────────────────────────────────────────────
// Zero-fee pool: output matches the lossless formula
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_swap_zero_fee_exact_output() {
    let mut ctx = setup();
    ctx.init_pool(0).unwrap();
    ctx.create_user_lp_ata().unwrap();
    ctx.add_liq(1_000_000, 1_000_000, 0).unwrap();

    // fee=0 → out = reserve_out * amount_in / (reserve_in + amount_in)
    //             = 1_000_000 * 10_000 / 1_010_000 = 9_900 (floor)
    let vault_b_before = ctx.token_balance(ctx.vault_b);
    ctx.swap(10_000, 0, true).unwrap();
    let amount_out = vault_b_before - ctx.token_balance(ctx.vault_b);
    assert_eq!(amount_out, 9_900);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sequential swaps stay on the constant-product curve
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_multiple_swaps_stay_on_curve() {
    let mut ctx = ready_pool_with_liquidity();

    // Use slightly different amount_in each iteration to avoid the
    // "AlreadyProcessed" dedup that LiteSVM applies when all tx bytes are identical.
    for i in 0..5u64 {
        ctx.swap(10_000 + i, 0, true).unwrap();
    }

    // After 5 A→B swaps vault_a > vault_b (price of B in A terms increased).
    let va = ctx.token_balance(ctx.vault_a);
    let vb = ctx.token_balance(ctx.vault_b);
    assert!(
        va > vb,
        "repeated A→B swaps should shift reserves so vault_a > vault_b"
    );
}
