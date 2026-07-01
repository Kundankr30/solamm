mod common;

use common::{extract_anchor_error, setup, ERR_SLIPPAGE_EXCEEDED, ERR_ZERO_LIQUIDITY};

// Helper: initialise pool and create the user LP ATA

fn ready_pool(fee_bps: u64) -> common::TestContext {
    let mut ctx = setup();
    ctx.init_pool(fee_bps)
        .expect("init_pool failed in test setup");
    ctx.create_user_lp_ata()
        .expect("create_user_lp_ata failed in test setup");
    ctx
}

// First deposit — uses calculate_initial_lp (isqrt)

#[test]
fn test_first_deposit_lp_equals_isqrt() {
    let mut ctx = ready_pool(30);

    // isqrt(1_000_000 * 1_000_000) = isqrt(10^12) = 1_000_000
    ctx.add_liq(1_000_000, 1_000_000, 0).unwrap();

    assert_eq!(ctx.mint_supply(ctx.lp_mint), 1_000_000);
    assert_eq!(ctx.token_balance(ctx.user_lp), 1_000_000);
    assert_eq!(ctx.token_balance(ctx.vault_a), 1_000_000);
    assert_eq!(ctx.token_balance(ctx.vault_b), 1_000_000);
}

#[test]
fn test_first_deposit_uneven_lp_floor() {
    let mut ctx = ready_pool(30);

    // isqrt(4_000_000 * 9_000_000) = isqrt(36 * 10^12) = 6_000_000
    ctx.add_liq(4_000_000, 9_000_000, 0).unwrap();
    assert_eq!(ctx.mint_supply(ctx.lp_mint), 6_000_000);
}

// Subsequent balanced deposit — uses calculate_lp_tokens (min of ratios)

#[test]
fn test_second_deposit_balanced() {
    let mut ctx = ready_pool(30);

    // First deposit: 1_000_000 / 1_000_000 → LP supply = 1_000_000
    ctx.add_liq(1_000_000, 1_000_000, 0).unwrap();
    assert_eq!(ctx.mint_supply(ctx.lp_mint), 1_000_000);

    // Second balanced deposit: 100_000 / 100_000 →
    //   lp_a = 100_000 * 1_000_000 / 1_000_000 = 100_000
    //   lp_b = same = 100_000
    //   min = 100_000
    ctx.add_liq(100_000, 100_000, 0).unwrap();

    assert_eq!(ctx.mint_supply(ctx.lp_mint), 1_100_000);
    assert_eq!(ctx.token_balance(ctx.vault_a), 1_100_000);
    assert_eq!(ctx.token_balance(ctx.vault_b), 1_100_000);
}

// Subsequent imbalanced deposit — returns the smaller ratio (floor)

#[test]
fn test_second_deposit_imbalanced_uses_min_ratio() {
    let mut ctx = ready_pool(30);

    // First deposit: 1_000_000 A, 2_000_000 B
    // isqrt(1_000_000 * 2_000_000) = isqrt(2 * 10^12) ≈ 1_414_213
    ctx.add_liq(1_000_000, 2_000_000, 0).unwrap();
    let lp_supply = ctx.mint_supply(ctx.lp_mint);
    assert_eq!(lp_supply, 1_414_213);

    // Second deposit: 100_000 A, 100_000 B into reserves 1_000_000 / 2_000_000
    // lp_a = (100_000 * 1_414_213) / 1_000_000 = 141_421_300_000 / 1_000_000 = 141_421 (floor)
    // lp_b = (100_000 * 1_414_213) / 2_000_000 = 141_421_300_000 / 2_000_000 = 70_710  (floor)
    // min(141_421, 70_710) = 70_710
    ctx.add_liq(100_000, 100_000, 0).unwrap();

    assert_eq!(ctx.mint_supply(ctx.lp_mint), lp_supply + 70_710);
}

// Slippage failure: min_lp_out too high

#[test]
fn test_add_liquidity_slippage_fails() {
    let mut ctx = ready_pool(30);
    ctx.add_liq(1_000_000, 1_000_000, 0).unwrap();

    // Second deposit would yield 100_000 LP; demand 999_999 → SlippageExceeded
    let err = ctx.add_liq(100_000, 100_000, 999_999).unwrap_err();
    let code = extract_anchor_error(&err).expect("expected custom anchor error");
    assert_eq!(code, ERR_SLIPPAGE_EXCEEDED);
}

// Zero amounts on first deposit → ZeroLiquidity

#[test]
fn test_first_deposit_zero_amount_a_fails() {
    let mut ctx = ready_pool(30);
    // isqrt(0 * 1_000_000) = 0 → ZeroLiquidity
    let err = ctx.add_liq(0, 1_000_000, 0).unwrap_err();
    let code = extract_anchor_error(&err).expect("expected custom anchor error");
    assert_eq!(code, ERR_ZERO_LIQUIDITY);
}

#[test]
fn test_first_deposit_zero_amount_b_fails() {
    let mut ctx = ready_pool(30);
    let err = ctx.add_liq(1_000_000, 0, 0).unwrap_err();
    let code = extract_anchor_error(&err).expect("expected custom anchor error");
    assert_eq!(code, ERR_ZERO_LIQUIDITY);
}

// Subsequent deposit with both zero → ZeroLiquidity

#[test]
fn test_second_deposit_zero_both_amounts_fails() {
    let mut ctx = ready_pool(30);
    ctx.add_liq(1_000_000, 1_000_000, 0).unwrap();

    let err = ctx.add_liq(0, 0, 0).unwrap_err();
    let code = extract_anchor_error(&err).expect("expected custom anchor error");
    assert_eq!(code, ERR_ZERO_LIQUIDITY);
}

// min_lp_out == 0 always passes the slippage guard

#[test]
fn test_add_liquidity_min_lp_zero_always_passes() {
    let mut ctx = ready_pool(30);
    ctx.add_liq(1_000_000, 1_000_000, 0).unwrap();
    ctx.add_liq(100_000, 100_000, 0).unwrap();
    assert_eq!(ctx.mint_supply(ctx.lp_mint), 1_100_000);
}
