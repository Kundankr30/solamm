mod common;

//use anchor_lang::prelude::Pubkey;
use common::{extract_anchor_error, setup, ERR_INVALID_FEE, ERR_INVALID_MINT_ORDER};

#[test]
fn test_init_pool_happy_path() {
    let mut ctx = setup();
    ctx.init_pool(30)
        .expect("init_pool should succeed with fee_bps=30");

    // Pool account must now exist.
    assert!(
        ctx.svm.get_account(&ctx.pool).is_some(),
        "pool PDA account must exist after init"
    );
    // Vault accounts must exist.
    assert!(
        ctx.svm.get_account(&ctx.vault_a).is_some(),
        "vault_a must exist"
    );
    assert!(
        ctx.svm.get_account(&ctx.vault_b).is_some(),
        "vault_b must exist"
    );

    // lp_mint must exist with supply == 0.
    assert_eq!(
        ctx.mint_supply(ctx.lp_mint),
        0,
        "lp_mint supply must be 0 right after init"
    );
}

#[test]
fn test_init_pool_fee_zero_allowed() {
    let mut ctx = setup();
    ctx.init_pool(0).expect("fee_bps=0 should be valid");
}

#[test]
fn test_init_pool_fee_9999_allowed() {
    let mut ctx = setup();
    ctx.init_pool(9999).expect("fee_bps=9999 should be valid");
}

// Failure: invalid mint order (mint_a >= mint_b)

#[test]
fn test_init_pool_invalid_mint_order_fails() {
    let mut ctx = setup();
    // Deliberately swap the order so the constraint mint_a < mint_b is violated.
    let err = ctx
        .init_pool_with_mints(ctx.mint_b, ctx.mint_a, 30)
        .unwrap_err();
    let code = extract_anchor_error(&err).expect("should contain a custom anchor error code");
    assert_eq!(
        code, ERR_INVALID_MINT_ORDER,
        "expected InvalidMintOrder ({ERR_INVALID_MINT_ORDER}), got {code}"
    );
}

// Failure: fee_bps == 10000 (exactly 100% — not allowed)

#[test]
fn test_init_pool_fee_exactly_10000_fails() {
    let mut ctx = setup();
    let err = ctx.init_pool(10_000).unwrap_err();
    let code = extract_anchor_error(&err).expect("should contain a custom anchor error code");
    assert_eq!(
        code, ERR_INVALID_FEE,
        "expected InvalidFee ({ERR_INVALID_FEE}), got {code}"
    );
}

// Failure: fee_bps > 10000 (e.g. 10001)

#[test]
fn test_init_pool_fee_over_10000_fails() {
    let mut ctx = setup();
    let err = ctx.init_pool(10_001).unwrap_err();
    let code = extract_anchor_error(&err).expect("should contain a custom anchor error code");
    assert_eq!(
        code, ERR_INVALID_FEE,
        "expected InvalidFee ({ERR_INVALID_FEE}), got {code}"
    );
}

// Failure: duplicate init (the pool PDA already exists)

#[test]
fn test_init_pool_duplicate_fails() {
    let mut ctx = setup();
    // First call must succeed.
    ctx.init_pool(30).unwrap();
    // Second call must fail — Anchor rejects re-init of an already-initialised PDA.
    let result = ctx.init_pool(30);
    assert!(
        result.is_err(),
        "second init_pool on the same mint pair must fail"
    );
}
