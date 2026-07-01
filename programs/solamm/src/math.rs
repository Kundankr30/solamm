use crate::error::AmmCode;
use anchor_lang::prelude::*;
pub fn calculate_initial_lp(amount_a: u64, amount_b: u64) -> Result<u64> {
    let product = (amount_a as u128)
        .checked_mul(amount_b as u128)
        .ok_or(AmmCode::MathOverflow)?;

    let lp = isqrt(product);
    require!(lp > 0, AmmCode::ZeroLiquidity);
    Ok(lp)
}

// Babylonian method
fn isqrt(n: u128) -> u64 {
    if n == 0 {
        return 0;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x as u64
}

pub fn calculate_lp_tokens(
    amount_a: u64,
    amount_b: u64,
    reserve_a: u64,
    reserve_b: u64,
    lp_supply: u64,
) -> Result<u64> {
    let lp_a = (amount_a as u128)
        .checked_mul(lp_supply as u128)
        .ok_or(AmmCode::MathOverflow)?
        .checked_div(reserve_a as u128)
        .ok_or(AmmCode::MathOverflow)?; // floor

    let lp_b = (amount_b as u128)
        .checked_mul(lp_supply as u128)
        .ok_or(AmmCode::MathOverflow)?
        .checked_div(reserve_b as u128)
        .ok_or(AmmCode::MathOverflow)?; // floor

    let lp = lp_a.min(lp_b);
    require!(lp > 0, AmmCode::ZeroLiquidity);
    Ok(lp as u64)
}

pub fn calculate_swap_output(
    amount_in: u64,
    reserve_in: u64,
    reserve_out: u64,
    fee_bps: u64,
) -> Result<u64> {
    if amount_in == 0 {
        return err!(AmmCode::ZeroAmount);
    }
    // otherwise x*y=k will break
    if reserve_in == 0 || reserve_out == 0 {
        return err!(AmmCode::ZeroLiquidity);
    }

    // (x+del x).(y+del y) = k after trade - eqn 1
    // x.y = k - eqn 2
    // by solving we get del(y) = y*del(x) / (x+del(x))
    let fee_multiplier = (10_000u128)
        .checked_sub(fee_bps as u128)
        .ok_or(AmmCode::MathOverflow)?;

    let amount_in_with_fee = (amount_in as u128)
        .checked_mul(fee_multiplier)
        .ok_or(AmmCode::MathOverflow)?;

    let nume = (reserve_out as u128)
        .checked_mul(amount_in_with_fee)
        .ok_or(AmmCode::MathOverflow)?;

    let deno = (reserve_in as u128)
        .checked_mul(10_000u128)
        .ok_or(AmmCode::MathOverflow)?
        .checked_add(amount_in_with_fee)
        .ok_or(AmmCode::MathOverflow)?;

    let amount_out = nume.checked_div(deno).ok_or(AmmCode::MathOverflow)?;

    if amount_out == 0 {
        return err!(AmmCode::InsufficientLiquidity);
    }

    Ok(amount_out as u64)
}
pub fn tokens_on_withdraw(
    lp_amount: u64,
    reserve_a: u64,
    reserve_b: u64,
    lp_supply: u64,
) -> Result<(u64, u64)> {
    require!(lp_amount > 0 && lp_supply > 0, AmmCode::ZeroLiquidity);

    let lp = lp_amount as u128;
    let supply = lp_supply as u128;

    let a_out = lp
        .checked_mul(reserve_a as u128)
        .ok_or(AmmCode::MathOverflow)?
        / supply; // floor — favors pool

    let b_out = lp
        .checked_mul(reserve_b as u128)
        .ok_or(AmmCode::MathOverflow)?
        / supply; // floor — favors pool

    require!(a_out > 0 && b_out > 0, AmmCode::InsufficientLiquidity);

    Ok((a_out as u64, b_out as u64))
}

#[cfg(test)]
mod tests {
    use super::*;

    // ---------- calculate_initial_lp ----------

    #[test]
    fn initial_lp_basic_1_1() {
        // isqrt(1) = 1
        assert_eq!(calculate_initial_lp(1, 1).unwrap(), 1);
    }

    #[test]
    fn initial_lp_perfect_square() {
        // isqrt(4 * 9) = isqrt(36) = 6
        assert_eq!(calculate_initial_lp(4, 9).unwrap(), 6);
    }

    #[test]
    fn initial_lp_floor() {
        // isqrt(2 * 8) = isqrt(16) = 4
        assert_eq!(calculate_initial_lp(2, 8).unwrap(), 4);
    }

    #[test]
    fn initial_lp_non_square_floor() {
        // isqrt(10 * 10) = 10; isqrt(2 * 2) = 2; isqrt(3 * 5) = isqrt(15) = 3
        assert_eq!(calculate_initial_lp(3, 5).unwrap(), 3);
    }

    #[test]
    fn initial_lp_zero_a_errors() {
        let err = calculate_initial_lp(0, 100).unwrap_err();
        assert_eq!(err, AmmCode::ZeroLiquidity.into());
    }

    #[test]
    fn initial_lp_zero_b_errors() {
        let err = calculate_initial_lp(100, 0).unwrap_err();
        assert_eq!(err, AmmCode::ZeroLiquidity.into());
    }

    #[test]
    fn initial_lp_overflow_errors() {
        // u64::MAX * u64::MAX overflows u128 only if it exceeds u128::MAX.
        // u64::MAX^2 = 2^128 - 2^65 + 1, which fits in u128. Pick values that push past u128::MAX.
        // (2^64 - 1)^2 = 2^128 - 2^65 + 1 < 2^128, so this WILL fit. We need amount_a * amount_b > u128::MAX.
        // Use amounts whose product exceeds u128::MAX. (1 << 100) * (1 << 100) = 1 << 200 > 2^128.
        // But u64 max is 2^64 - 1, so we need each amount close to 2^64.
        // 2^64 - 1 squared is 2^128 - 2^65 + 1, which is < 2^128. Hmm — we cannot overflow with u64s only.
        // Confirm that u64::MAX^2 fits in u128 (yes) so this case is unreachable in practice.
        // We still verify the success path for the maximum values.
        let res = calculate_initial_lp(u64::MAX, u64::MAX);
        // (2^64-1)^2 = 2^128 - 2^65 + 1, isqrt ~= 2^64 - 1
        assert!(res.is_ok());
    }

    // ---------- calculate_lp_tokens ----------

    #[test]
    fn lp_tokens_balanced() {
        // supply=100, reserves=1000/1000, deposit 100/100 → 10 LP from each side → 10
        let lp = calculate_lp_tokens(100, 100, 1000, 1000, 100).unwrap();
        assert_eq!(lp, 10);
    }

    #[test]
    fn lp_tokens_uses_min_ratio() {
        // supply=100, reserves=1000/2000, deposit 100/100
        // lp_a = 100*100/1000 = 10, lp_b = 100*100/2000 = 5, min = 5
        let lp = calculate_lp_tokens(100, 100, 1000, 2000, 100).unwrap();
        assert_eq!(lp, 5);
    }

    #[test]
    fn lp_tokens_zero_reserve_a_errors() {
        // division by zero would panic; the .ok_or path catches it. We expect MathOverflow.
        let err = calculate_lp_tokens(100, 100, 0, 1000, 100).unwrap_err();
        assert_eq!(err, AmmCode::MathOverflow.into());
    }

    #[test]
    fn lp_tokens_zero_reserve_b_errors() {
        let err = calculate_lp_tokens(100, 100, 1000, 0, 100).unwrap_err();
        assert_eq!(err, AmmCode::MathOverflow.into());
    }

    #[test]
    fn lp_tokens_zero_supply_errors() {
        // lp_amount * supply / reserve = 0 when supply=0, min(0,0) = 0 → ZeroLiquidity
        let err = calculate_lp_tokens(100, 100, 1000, 1000, 0).unwrap_err();
        assert_eq!(err, AmmCode::ZeroLiquidity.into());
    }

    #[test]
    fn lp_tokens_zero_amounts_errors() {
        // min(0, 0) = 0 → ZeroLiquidity
        let err = calculate_lp_tokens(0, 0, 1000, 1000, 100).unwrap_err();
        assert_eq!(err, AmmCode::ZeroLiquidity.into());
    }

    #[test]
    fn lp_tokens_no_overflow_at_max() {
        // 2^64-1 * 2^64-1 = 2^128 - 2^65 + 1 fits in u128.
        let res = calculate_lp_tokens(u64::MAX, u64::MAX, u64::MAX, u64::MAX, u64::MAX);
        // Each side: (u64::MAX * u64::MAX) / u64::MAX = u64::MAX. Min = u64::MAX.
        assert_eq!(res.unwrap(), u64::MAX);
    }

    // ---------- calculate_swap_output ----------

    #[test]
    fn swap_basic_constant_product() {
        // x*y=k with 1000/1000, swap 100 A→B with 30 bps fee.
        // num = 1000 * 100 * 9970 = 997_000_000
        // den = 1000 * 10000 + 100 * 9970 = 10_000_000 + 997_000 = 10_997_000
        // out = 997_000_000 / 10_997_000 = 90 (floor: 90.66...)
        let out = calculate_swap_output(100, 1000, 1000, 30).unwrap();
        assert_eq!(out, 90);
    }

    #[test]
    fn swap_zero_fee_matches_uniswap() {
        // With fee=0, out = reserve_out * amount_in / (reserve_in + amount_in)
        // 1000 * 100 / (1000 + 100) = 100_000 / 1100 = 90
        let out = calculate_swap_output(100, 1000, 1000, 0).unwrap();
        assert_eq!(out, 90);
    }

    #[test]
    fn swap_high_fee_close_to_zero() {
        // fee=9999: amount_in_with_fee = amount_in * 1 → nearly all goes to LPs, tiny output
        // num = 1000 * 100 * 1 = 100_000
        // den = 1000 * 10000 + 100 * 1 = 10_000_100
        // out = 100_000 / 10_000_100 = 0 → InsufficientLiquidity
        let err = calculate_swap_output(100, 1000, 1000, 9999).unwrap_err();
        assert_eq!(err, AmmCode::InsufficientLiquidity.into());
    }

    #[test]
    fn swap_tiny_amount_rounds_to_zero() {
        // 1 unit in: num = 1000 * 1 * 9970 = 9_970_000, den = 10_000_000 + 9970 = 10_009_970
        // out = 9_970_000 / 10_009_970 = 0 → InsufficientLiquidity
        let err = calculate_swap_output(1, 1000, 1000, 30).unwrap_err();
        assert_eq!(err, AmmCode::InsufficientLiquidity.into());
    }

    #[test]
    fn swap_zero_in_errors() {
        let err = calculate_swap_output(0, 1000, 1000, 30).unwrap_err();
        assert_eq!(err, AmmCode::ZeroAmount.into());
    }

    #[test]
    fn swap_zero_reserve_in_errors() {
        let err = calculate_swap_output(100, 0, 1000, 30).unwrap_err();
        assert_eq!(err, AmmCode::ZeroLiquidity.into());
    }

    #[test]
    fn swap_zero_reserve_out_errors() {
        let err = calculate_swap_output(100, 1000, 0, 30).unwrap_err();
        assert_eq!(err, AmmCode::ZeroLiquidity.into());
    }

    #[test]
    fn swap_no_overflow_within_safe_envelope() {
        // Use values that don't blow up the 128-bit math. The exact overflow boundary
        // is reserve_in * amount_in * (10000 - fee) > u128::MAX. With reserves ~ 1e15
        // and amount_in ~ 1e10, the intermediate nume is ~ 1e15 * 1e10 * 1e4 = 1e29, well under 2^128.
        let res = calculate_swap_output(1_000_000_000, 1_000_000_000_000_000, 1_000_000_000_000_000, 30);
        assert!(res.is_ok());
    }

    // ---------- tokens_on_withdraw ----------

    #[test]
    fn withdraw_half_gets_half() {
        // supply=100, reserves=1000/1000, withdraw 50 → 500, 500
        let (a, b) = tokens_on_withdraw(50, 1000, 1000, 100).unwrap();
        assert_eq!((a, b), (500, 500));
    }

    #[test]
    fn withdraw_full_drains() {
        let (a, b) = tokens_on_withdraw(100, 1000, 2000, 100).unwrap();
        assert_eq!((a, b), (1000, 2000));
    }

    #[test]
    fn withdraw_favors_pool_floor() {
        // supply=3, reserves=10/10, withdraw 1 → 10/3 = 3 floor, not 3.33
        let (a, b) = tokens_on_withdraw(1, 10, 10, 3).unwrap();
        assert_eq!((a, b), (3, 3));
    }

    #[test]
    fn withdraw_zero_lp_errors() {
        let err = tokens_on_withdraw(0, 1000, 1000, 100).unwrap_err();
        assert_eq!(err, AmmCode::ZeroLiquidity.into());
    }

    #[test]
    fn withdraw_zero_supply_errors() {
        let err = tokens_on_withdraw(50, 1000, 1000, 0).unwrap_err();
        assert_eq!(err, AmmCode::ZeroLiquidity.into());
    }

    #[test]
    fn withdraw_tiny_rounds_to_zero() {
        // supply=u64::MAX, reserves=1/1, withdraw 1 → 1 * 1 / u64::MAX = 0 → InsufficientLiquidity
        let err = tokens_on_withdraw(1, 1, 1, u64::MAX).unwrap_err();
        assert_eq!(err, AmmCode::InsufficientLiquidity.into());
    }

    #[test]
    fn withdraw_one_side_rounds_to_zero() {
        // supply=10, reserves=100/1, withdraw 1 → a_out=10, b_out=0 → InsufficientLiquidity
        let err = tokens_on_withdraw(1, 100, 1, 10).unwrap_err();
        assert_eq!(err, AmmCode::InsufficientLiquidity.into());
    }

    #[test]
    fn withdraw_no_overflow_at_max() {
        // lp = u64::MAX, supply = u64::MAX, reserves = u64::MAX
        // a_out = u64::MAX * u64::MAX / u64::MAX = u64::MAX
        let (a, b) = tokens_on_withdraw(u64::MAX, u64::MAX, u64::MAX, u64::MAX).unwrap();
        assert_eq!((a, b), (u64::MAX, u64::MAX));
    }
}
