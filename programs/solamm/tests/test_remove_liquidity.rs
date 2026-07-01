mod common;

use common::{extract_anchor_error, setup, ERR_SLIPPAGE_EXCEEDED, ERR_ZERO_LIQUIDITY};

fn ready_pool_with_liquidity() -> common::TestContext {
    let mut ctx = setup();
    ctx.init_pool(30).unwrap();
    ctx.create_user_lp_ata().unwrap();
    // Deposit 1_000_000 of each → LP supply = 1_000_000
    ctx.add_liq(1_000_000, 1_000_000, 0).unwrap();
    ctx
}

// Partial withdraw — proportional share, vaults shrink

#[test]
fn test_remove_half_lp() {
    let mut ctx = ready_pool_with_liquidity();

    let user_a_before = ctx.token_balance(ctx.user_token_a);
    let user_b_before = ctx.token_balance(ctx.user_token_b);

    // Withdraw 50% of LP (500_000) → 500_000 A and 500_000 B back.
    ctx.remove_liq(500_000, 500_000, 500_000).unwrap();

    assert_eq!(ctx.mint_supply(ctx.lp_mint), 500_000);
    assert_eq!(ctx.token_balance(ctx.vault_a), 500_000);
    assert_eq!(ctx.token_balance(ctx.vault_b), 500_000);
    assert_eq!(ctx.token_balance(ctx.user_token_a), user_a_before + 500_000);
    assert_eq!(ctx.token_balance(ctx.user_token_b), user_b_before + 500_000);
}

// Full withdraw — drains both vaults

#[test]
fn test_remove_all_lp_drains_vaults() {
    let mut ctx = ready_pool_with_liquidity();

    ctx.remove_liq(1_000_000, 1_000_000, 1_000_000).unwrap();

    assert_eq!(ctx.mint_supply(ctx.lp_mint), 0);
    assert_eq!(ctx.token_balance(ctx.vault_a), 0);
    assert_eq!(ctx.token_balance(ctx.vault_b), 0);
}

// Partial withdraw with asymmetric reserves

#[test]
fn test_remove_asymmetric_reserves() {
    let mut ctx = setup();
    ctx.init_pool(0).unwrap();
    ctx.create_user_lp_ata().unwrap();

    // 1_000_000 A and 2_000_000 B → LP ≈ 1_414_213
    ctx.add_liq(1_000_000, 2_000_000, 0).unwrap();
    let supply = ctx.mint_supply(ctx.lp_mint);
    assert_eq!(supply, 1_414_213);

    // Withdraw 707_106 (≈ half) — no strict slippage guard.
    let withdraw_lp = supply / 2;
    ctx.remove_liq(withdraw_lp, 0, 0).unwrap();

    assert_eq!(ctx.mint_supply(ctx.lp_mint), supply - withdraw_lp);
}

// Slippage: min_a_out or min_b_out too high

#[test]
fn test_remove_liquidity_slippage_min_a_fails() {
    let mut ctx = ready_pool_with_liquidity();

    // 500_000 LP → a_out = 500_000; demand 500_001 → SlippageExceeded
    let err = ctx.remove_liq(500_000, 500_001, 0).unwrap_err();
    let code = extract_anchor_error(&err).expect("expected custom anchor error");
    assert_eq!(code, ERR_SLIPPAGE_EXCEEDED);
}

#[test]
fn test_remove_liquidity_slippage_min_b_fails() {
    let mut ctx = ready_pool_with_liquidity();

    let err = ctx.remove_liq(500_000, 0, 500_001).unwrap_err();
    let code = extract_anchor_error(&err).expect("expected custom anchor error");
    assert_eq!(code, ERR_SLIPPAGE_EXCEEDED);
}

// Zero lp_amount → ZeroLiquidity

#[test]
fn test_remove_zero_lp_fails() {
    let mut ctx = ready_pool_with_liquidity();

    let err = ctx.remove_liq(0, 0, 0).unwrap_err();
    let code = extract_anchor_error(&err).expect("expected custom anchor error");
    assert_eq!(code, ERR_ZERO_LIQUIDITY);
}

// Burning more LP than user holds → SPL rejects the burn

#[test]
fn test_remove_more_than_held_fails() {
    let mut ctx = ready_pool_with_liquidity();
    // User holds 1_000_000 LP; try to withdraw 2_000_000.
    assert!(
        ctx.remove_liq(2_000_000, 0, 0).is_err(),
        "burning more than held must fail"
    );
}

// Remove then re-add — pool state stays consistent

#[test]
fn test_remove_then_readd() {
    let mut ctx = ready_pool_with_liquidity();

    ctx.remove_liq(500_000, 0, 0).unwrap();
    // After half removed: vaults = 500_000, supply = 500_000
    assert_eq!(ctx.token_balance(ctx.vault_a), 500_000);
    assert_eq!(ctx.mint_supply(ctx.lp_mint), 500_000);

    // Re-add 100_000 / 100_000 into balanced 500_000/500_000 pool:
    //   lp_a = lp_b = 100_000 * 500_000 / 500_000 = 100_000
    ctx.add_liq(100_000, 100_000, 0).unwrap();
    assert_eq!(ctx.mint_supply(ctx.lp_mint), 600_000);
    assert_eq!(ctx.token_balance(ctx.vault_a), 600_000);
}
