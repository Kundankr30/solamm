use {
    anchor_lang::{prelude::Pubkey, system_program, InstructionData, ToAccountMetas},
    anchor_spl::token,
    solana_keypair::Keypair,
    solana_signer::Signer,
};

#[test]
fn test_build_init_pool_instruction() {
    let program_id = solamm::id();
    let payer = Keypair::new();
    let mint_a = Pubkey::new_unique();
    let mint_b = Pubkey::new_unique();
    let (pool, _) =
        Pubkey::find_program_address(&[b"pool", mint_a.as_ref(), mint_b.as_ref()], &program_id);
    let (vault_a, _) = Pubkey::find_program_address(&[b"vault_a", pool.as_ref()], &program_id);
    let (vault_b, _) = Pubkey::find_program_address(&[b"vault_b", pool.as_ref()], &program_id);
    let (lp_mint, _) = Pubkey::find_program_address(&[b"lp_mint", pool.as_ref()], &program_id);
    let (authority, _) = Pubkey::find_program_address(&[b"authority", pool.as_ref()], &program_id);

    let data = solamm::instruction::InitPool { fee_bps: 30 }.data();
    let accounts = solamm::accounts::InitPool {
        pool,
        mint_a,
        mint_b,
        vault_a,
        vault_b,
        lp_mint,
        authority,
        payer: payer.pubkey(),
        system_program: system_program::ID,
        token_program: token::ID,
        rent: Pubkey::new_unique(),
    }
    .to_account_metas(None);

    assert!(!data.is_empty());
    assert_eq!(accounts.len(), 11);
}
