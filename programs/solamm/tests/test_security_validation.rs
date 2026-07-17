mod common;

use common::setup;
use anchor_lang::InstructionData;
use anchor_lang::ToAccountMetas;
use anchor_lang::solana_program::instruction::Instruction;
use solana_keypair::Keypair;
use solana_signer::Signer;

fn ready_pool_with_liquidity() -> common::TestContext {
    let mut ctx = setup();
    ctx.init_pool(30).unwrap();
    ctx.create_user_lp_ata().unwrap();
    ctx.add_liq(1_000_000, 1_000_000, 0).unwrap();
    ctx
}

#[test]
fn test_remove_liquidity_unauthorized_token_a_owner_fails() {
    let mut ctx = ready_pool_with_liquidity();
    let attacker = Keypair::new();

    // Create ATA for attacker
    let attacker_token_a = anchor_spl::associated_token::get_associated_token_address(
        &attacker.pubkey(),
        &ctx.mint_a,
    );
    let create_ata_ix = anchor_spl::associated_token::spl_associated_token_account::instruction::create_associated_token_account(
        &ctx.payer.pubkey(),
        &attacker.pubkey(),
        &ctx.mint_a,
        &anchor_spl::token::ID,
    );
    ctx.send(&[create_ata_ix], vec![ctx.payer.insecure_clone()]).unwrap();

    let ix = Instruction {
        program_id: solamm::id(),
        data: solamm::instruction::RemoveLiquidity {
            lp_amount: 500_000,
            min_a_out: 0,
            min_b_out: 0,
        }
        .data(),
        accounts: solamm::accounts::RemoveLiquidity {
            pool: ctx.pool,
            vault_a: ctx.vault_a,
            vault_b: ctx.vault_b,
            lp_mint: ctx.lp_mint,
            authority: ctx.authority,
            user: ctx.payer.pubkey(),
            user_token_a: attacker_token_a, // MALICIOUS token account (attacker-owned)
            user_token_b: ctx.user_token_b,
            user_lp_account: ctx.user_lp,
            token_program: anchor_spl::token::ID,
        }
        .to_account_metas(None),
    };

    let result = ctx.send(&[ix], vec![ctx.payer.insecure_clone()]);
    assert!(result.is_err(), "Expected remove_liquidity to fail with unauthorized user_token_a owner");
}

#[test]
fn test_swap_unauthorized_token_a_owner_fails() {
    let mut ctx = ready_pool_with_liquidity();
    let attacker = Keypair::new();

    // Create ATA for attacker
    let attacker_token_a = anchor_spl::associated_token::get_associated_token_address(
        &attacker.pubkey(),
        &ctx.mint_a,
    );
    let create_ata_ix = anchor_spl::associated_token::spl_associated_token_account::instruction::create_associated_token_account(
        &ctx.payer.pubkey(),
        &attacker.pubkey(),
        &ctx.mint_a,
        &anchor_spl::token::ID,
    );
    ctx.send(&[create_ata_ix], vec![ctx.payer.insecure_clone()]).unwrap();

    let ix = Instruction {
        program_id: solamm::id(),
        data: solamm::instruction::Swap {
            amount_in: 10_000,
            min_amount_out: 0,
            a_to_b: true,
        }
        .data(),
        accounts: solamm::accounts::Swap {
            pool: ctx.pool,
            vault_a: ctx.vault_a,
            vault_b: ctx.vault_b,
            authority: ctx.authority,
            user: ctx.payer.pubkey(),
            user_token_a: attacker_token_a, // MALICIOUS token account (attacker-owned)
            user_token_b: ctx.user_token_b,
            token_program: anchor_spl::token::ID,
        }
        .to_account_metas(None),
    };

    let result = ctx.send(&[ix], vec![ctx.payer.insecure_clone()]);
    assert!(result.is_err(), "Expected swap to fail with unauthorized user_token_a owner");
}

#[test]
fn test_add_liquidity_unauthorized_token_b_owner_fails() {
    let mut ctx = ready_pool_with_liquidity();
    let attacker = Keypair::new();

    // Create ATA for attacker
    let attacker_token_b = anchor_spl::associated_token::get_associated_token_address(
        &attacker.pubkey(),
        &ctx.mint_b,
    );
    let create_ata_ix = anchor_spl::associated_token::spl_associated_token_account::instruction::create_associated_token_account(
        &ctx.payer.pubkey(),
        &attacker.pubkey(),
        &ctx.mint_b,
        &anchor_spl::token::ID,
    );
    ctx.send(&[create_ata_ix], vec![ctx.payer.insecure_clone()]).unwrap();

    let ix = Instruction {
        program_id: solamm::id(),
        data: solamm::instruction::AddLiquidity {
            amount_a: 100_000,
            amount_b: 100_000,
            min_lp_out: 0,
        }
        .data(),
        accounts: solamm::accounts::AddLiquidity {
            pool: ctx.pool,
            vault_a: ctx.vault_a,
            vault_b: ctx.vault_b,
            lp_mint: ctx.lp_mint,
            authority: ctx.authority,
            user: ctx.payer.pubkey(),
            user_token_a: ctx.user_token_a,
            user_token_b: attacker_token_b, // MALICIOUS token account (attacker-owned)
            user_lp_account: ctx.user_lp,
            token_program: anchor_spl::token::ID,
        }
        .to_account_metas(None),
    };

    let result = ctx.send(&[ix], vec![ctx.payer.insecure_clone()]);
    assert!(result.is_err(), "Expected add_liquidity to fail with unauthorized user_token_b owner");
}

#[test]
fn test_swap_invalid_token_a_mint_fails() {
    let mut ctx = ready_pool_with_liquidity();

    // Create a new random mint
    let malicious_mint_kp = Keypair::new();
    let malicious_mint = malicious_mint_kp.pubkey();
    
    // Rent calculation
    let mint_space = 82; // SPL Token Mint length
    let mint_rent = ctx.svm.minimum_balance_for_rent_exemption(mint_space);
    
    // Instruction to create and init mint
    let create_account_ix = anchor_lang::solana_program::system_instruction::create_account(
        &ctx.payer.pubkey(),
        &malicious_mint,
        mint_rent,
        mint_space as u64,
        &anchor_spl::token::ID,
    );
    let init_mint_ix = anchor_spl::token::spl_token::instruction::initialize_mint2(
        &anchor_spl::token::ID,
        &malicious_mint,
        &ctx.payer.pubkey(),
        None,
        6,
    ).unwrap();
    
    // Create ATA for user
    let malicious_token_a = anchor_spl::associated_token::get_associated_token_address(
        &ctx.payer.pubkey(),
        &malicious_mint,
    );
    let create_ata_ix = anchor_spl::associated_token::spl_associated_token_account::instruction::create_associated_token_account(
        &ctx.payer.pubkey(),
        &ctx.payer.pubkey(),
        &malicious_mint,
        &anchor_spl::token::ID,
    );
    
    ctx.send(
        &[create_account_ix, init_mint_ix, create_ata_ix],
        vec![ctx.payer.insecure_clone(), malicious_mint_kp],
    ).unwrap();

    let ix = Instruction {
        program_id: solamm::id(),
        data: solamm::instruction::Swap {
            amount_in: 10_000,
            min_amount_out: 0,
            a_to_b: true,
        }
        .data(),
        accounts: solamm::accounts::Swap {
            pool: ctx.pool,
            vault_a: ctx.vault_a,
            vault_b: ctx.vault_b,
            authority: ctx.authority,
            user: ctx.payer.pubkey(),
            user_token_a: malicious_token_a, // MALICIOUS mint
            user_token_b: ctx.user_token_b,
            token_program: anchor_spl::token::ID,
        }
        .to_account_metas(None),
    };

    let result = ctx.send(&[ix], vec![ctx.payer.insecure_clone()]);
    assert!(result.is_err(), "Expected swap to fail with invalid user_token_a mint");
}
