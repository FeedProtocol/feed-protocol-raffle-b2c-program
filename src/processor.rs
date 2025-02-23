use crate::{instruction::RaffleProgramInstruction, state::{ Config, InitPda, InitRaffle, Participant, Raffle, RaffleCounter, RandomNumber, RewardFeeType, Term}};
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},  entrypoint::ProgramResult,
     instruction::{AccountMeta, Instruction}, msg, program::{get_return_data, invoke, invoke_signed},
      pubkey::Pubkey, rent::Rent, system_instruction,   sysvar::{clock::Clock, Sysvar,},

};
use solana_program::program_pack::Pack;
use spl_token::state::Account;


use crate::error::RaffleProgramError::{InvalidCounter, ArithmeticError, InvalidInitializer, WritableAccount,
     ParticipantNotSigner, MaxNumberReached, InvalidWinner, InvalidFee,  InvalidRaffleState,InvalidRewardType,
     InitializerNotSigner, InvalidWinnerPDA,InvalidRaffleNo, InvalidParticipantPDA,InvalidFeeType,RNGProgramError,
    InvalidConfig, NotSignerAuth,  InvalidAuth,  InvalidRaffle, InvalidTerms, InvalidRaffleTime,InvalidWinnerNumber,
    };

use spl_associated_token_account::instruction::create_associated_token_account;


pub struct Processor;
impl Processor {
    pub fn process(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction: RaffleProgramInstruction = RaffleProgramInstruction::unpack(instruction_data)?;

        match instruction {
            RaffleProgramInstruction::InitRaffle {init_raffle}=> {
                Self::init_raffle(accounts, program_id, init_raffle)
            },
            RaffleProgramInstruction::JoinRaffle => {
                Self::join_raffle(accounts,program_id)
            },
            RaffleProgramInstruction::ChooseWinner {rng_call_limit}=> {
                Self::choose_winner(accounts, program_id, rng_call_limit)
            },
            RaffleProgramInstruction::PublishWinner => {
                Self::publish_winner(accounts, program_id)
            },
            RaffleProgramInstruction::InitCounter => {
                Self::init_raffle_counter(accounts, program_id)
            },
            RaffleProgramInstruction::ClosePDA => {
                Self::close_participant_pda(accounts)
            },
            RaffleProgramInstruction::InitTerm {data}=> {
                Self::init_term_account(accounts, program_id, data)
            },
            RaffleProgramInstruction::InitConfig => {
                Self::init_config(accounts, program_id)
            },
            RaffleProgramInstruction::SetConfig => {
                Self::set_config(accounts, program_id)
            },
            RaffleProgramInstruction::UpdateTerm {data}=> {
                Self::update_terms(accounts, program_id, data)
            },
            RaffleProgramInstruction::CollectFee => {
                Self::collect_fee(accounts, program_id)
            },
            RaffleProgramInstruction::ClaimPrize => {
                Self::claim_prize(accounts, program_id)
            },
            RaffleProgramInstruction::CollectFeeInitializer => {
                Self::collect_fee_initializer(accounts, program_id)
            },

        }
    }


    fn init_raffle(
        accounts: &[AccountInfo],program_id: &Pubkey, init_raffle:InitRaffle
    ) -> ProgramResult{


       let accounts_iter: &mut std::slice::Iter<'_, AccountInfo<'_>> = &mut accounts.iter();

       let initializer: &AccountInfo<'_> = next_account_info(accounts_iter)?;
       let initializer_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
       let raffle_pda: &AccountInfo<'_> = next_account_info(accounts_iter)?;
       let raffle_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
       let counter_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;
       let reward_mint: &AccountInfo<'_> = next_account_info(accounts_iter)?;
       let token_program: &AccountInfo<'_> = next_account_info(accounts_iter)?;
       let sysvar: &AccountInfo<'_> = next_account_info(accounts_iter)?;
       let term_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;
       let reward_type_pda: &AccountInfo<'_> = next_account_info(accounts_iter)?;
       let fee_type_pda: &AccountInfo<'_> = next_account_info(accounts_iter)?;


       let mut counter: RaffleCounter = RaffleCounter::try_from_slice(&counter_account.data.borrow())?;
       let terms: Term = Term::try_from_slice(&term_account.data.borrow())?;
       let reward_type: RewardFeeType = RewardFeeType::try_from_slice(&reward_type_pda.data.borrow())?;
       let fee_type: RewardFeeType = RewardFeeType::try_from_slice(&fee_type_pda.data.borrow())?;


       counter.number_of_raffles = counter.number_of_raffles.checked_add(1).ok_or(ArithmeticError)?;

       Self::check_accounts_init_raffle(&counter,&terms,initializer,term_account,counter_account,reward_type_pda,fee_type_pda,program_id)?;

       Self::create_raffle_pda(initializer,raffle_pda,program_id,&counter.number_of_raffles)?;

       Self::create_raffle_ata(initializer,raffle_pda,raffle_ata,reward_mint,token_program,sysvar)?;

       let mut total_rewards:u64 = 0;
       Self::check_participation_reward_type_and_sum(program_id,&reward_type,&init_raffle.rewards,reward_type_pda.key,&mut total_rewards)?;

       Self::check_participation_fee_type(program_id,&fee_type,fee_type_pda.key)?;

       Self::transfer_reward_to_raffle_pda(reward_mint,raffle_ata,initializer,initializer_ata,token_program,reward_type.decimals,total_rewards)?;

       Self::check_and_write_raffle_data(&init_raffle,&terms,initializer.key,reward_type.mint,fee_type.mint,reward_type.decimals,fee_type.decimals,counter.number_of_raffles,raffle_pda)?;


        counter.serialize(&mut &mut counter_account.data.borrow_mut()[..])?;

        Ok(())
    }

    fn join_raffle(
        accounts: &[AccountInfo],program_id: &Pubkey,
    ) -> ProgramResult{


        let accounts_iter: &mut std::slice::Iter<'_, AccountInfo<'_>> = &mut accounts.iter();
 
        let participant: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let raffle_pda: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let participant_pda: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let participation_fee_mint: &AccountInfo<'_> = next_account_info(accounts_iter)?;

        if raffle_pda.owner != program_id {return Err(InvalidRaffle.into());}
        if !participant.is_signer {return Err(ParticipantNotSigner.into());}
        if participation_fee_mint.owner != &spl_token::id() && participation_fee_mint.owner != &spl_token_2022::id(){panic!()}

        let mut raffle: Raffle = Raffle::try_from_slice(&raffle_pda.data.borrow())?;

        if participation_fee_mint.key.to_bytes() != raffle.participation_fee_mint { return Err(InvalidFeeType.into());}

        if raffle.raffle_state != 1 {return Err(InvalidRaffleState.into());}

        if raffle.is_unlimited_participant_allowed != 1{
            if raffle.participants_required <= raffle.current_number_of_participants {return Err(MaxNumberReached.into());}
        }

        let clock: Clock= Clock::get()?;
        let current_time: u64 = clock.unix_timestamp as u64;

        if raffle.raffle_time < current_time {return Err(InvalidRaffleTime.into())}


        raffle.current_number_of_participants = raffle.current_number_of_participants.checked_add(1).ok_or(ArithmeticError)?;


        Self::init_participant_pda(participant, participant_pda, raffle.multiple_participation_allowed, raffle.raffle_no, raffle.current_number_of_participants, program_id)?;

        let fee:u64 = raffle.participation_fee;
        if raffle.participation_fee_type == 1 {
            Self::transfer_participation_fee_solana(participant, raffle_pda, fee)?;
        }else{

           let participant_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
           let raffle_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
           let token_program: &AccountInfo<'_> = next_account_info(accounts_iter)?;

           Self::check_mint_and_owner(participation_fee_mint.key, participant.key, participant_ata)?;
           Self::check_mint_and_owner(participation_fee_mint.key, raffle_pda.key, raffle_ata)?;

           Self::transfer_participation_fee_token(token_program, participant, participant_ata, raffle_ata, participation_fee_mint, fee, raffle.participation_fee_decimals)?;
        }

        let participant: Participant = Participant{
            particpant_address: participant.key.to_bytes(),
            particpant_no: raffle.current_number_of_participants,
            raffle_no: raffle.raffle_no,
            entitled: 0,
            prize_claimed: 0,
            index_in_winners: 0,
        };


        raffle.serialize(&mut &mut raffle_pda.data.borrow_mut()[..])?;
        participant.serialize(&mut &mut participant_pda.data.borrow_mut()[..])?;


         Ok(())
     }

    fn choose_winner(
        accounts: &[AccountInfo],program_id: &Pubkey,rng_call_limit:RandomNumber
    ) -> ProgramResult{

        let accounts_iter: &mut std::slice::Iter<'_, AccountInfo<'_>> = &mut accounts.iter();


        let authority: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let raffle_pda: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let entropy_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let fee_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let rng_program: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let system_program: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let config: &AccountInfo<'_> = next_account_info(accounts_iter)?;


        let mut raffle: Raffle = Raffle::try_from_slice(&raffle_pda.data.borrow())?;
        let  config: Config = Config::try_from_slice(&config.data.borrow())?;

        if raffle_pda.owner != program_id {return Err(InvalidRaffle.into());}
        if !authority.is_signer {return Err(NotSignerAuth.into());}

        Self::check_authority(authority.key, config)?;


        let clock: Clock= Clock::get()?;
        let current_time: u64 = clock.unix_timestamp as u64;

        msg!("1");
        if raffle.raffle_state != 1{return Err(InvalidRaffleState.into());}

        if raffle.is_unlimited_participant_allowed == 1 {
           if raffle.raffle_time < current_time {return Err(InvalidRaffleState.into());}
        }else{
           if raffle.current_number_of_participants != raffle.participants_required && raffle.raffle_time < current_time {return Err(InvalidRaffleState.into());}
        }



        let mut attempts:u64 = 0;

        let mut winners: Vec<u64> = raffle.winners.clone();

        if raffle.current_number_of_participants == 0 {

        let initializer: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let initializer_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let raffle_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let reward_mint: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let token_program: &AccountInfo<'_> = next_account_info(accounts_iter)?;

        let total_rewards = raffle.rewards.iter().sum();
            
            Self::abort_raffle(initializer,initializer_ata,raffle_pda,raffle_ata,reward_mint,token_program,total_rewards,raffle.reward_decimals)?;
            raffle.raffle_state = 2;

        }else if raffle.current_number_of_participants == 1  {
            let winner_no:u64 = 1;
            winners.push(winner_no);

        }else{
            let count:u64;
            if raffle.current_number_of_participants < raffle.winner_count {
                count = raffle.current_number_of_participants;
            }else{
                count = raffle.winner_count;
            }

            while raffle.current_winner_count < count && attempts < rng_call_limit.random_number {

                let mut random_number:u64 = 0;
    
                Self::call_rng(authority, entropy_account, fee_account, system_program, rng_program, &mut random_number)?;
    
                let mut winner_no: u64 = random_number % raffle.current_number_of_participants;
    
                if winner_no == 0 {
                    winner_no = raffle.current_number_of_participants;
                }

                if !winners.contains(&winner_no) {
                    winners.push(winner_no);
                    raffle.current_winner_count = raffle.current_winner_count.checked_add(1).ok_or(ArithmeticError)?;

                }
                
    
    
                attempts += 1;
            }

            if count == raffle.current_winner_count {
                raffle.raffle_state = 2;
            }
        }



        raffle.serialize(&mut &mut raffle_pda.data.borrow_mut()[..])?;


        Ok(())
    }

    fn publish_winner(
        accounts: &[AccountInfo],program_id: &Pubkey
    ) -> ProgramResult{

        let accounts_iter: &mut std::slice::Iter<'_, AccountInfo<'_>> = &mut accounts.iter();

        let raffle_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;


        let mut raffle: Raffle = Raffle::try_from_slice(&raffle_account.data.borrow())?;


        if raffle_account.owner != program_id {return Err(InvalidRaffle.into());}


        if raffle.raffle_state != 2{return Err(InvalidRaffleState.into());}

        let total_loop: u64 = accounts_iter.len() as u64;



        for _x in 0..total_loop {

            let winner_pda: &AccountInfo<'_> = next_account_info(accounts_iter)?;

            let mut participant: Participant = Participant::try_from_slice(&winner_pda.data.borrow())?;

            if winner_pda.owner != program_id {return Err(InvalidWinnerPDA.into());}

            if raffle.raffle_no != participant.raffle_no{return Err(InvalidRaffleNo.into());}

            if participant.entitled != 0 {return Err(InvalidParticipantPDA.into());}

            if !raffle.winners.contains(&participant.particpant_no){return Err(InvalidParticipantPDA.into());}

            let index = raffle.winners.iter().position(|&x| x == participant.particpant_no).unwrap();

            participant.entitled = 1;
            participant.index_in_winners = index as u64;

            participant.serialize(&mut &mut winner_pda.data.borrow_mut()[..])?;

        }

        if raffle.current_number_of_participants < raffle.winner_count{

            if raffle.number_of_entitled_winners == raffle.current_number_of_participants {
                raffle.raffle_state = 3;
            }

        }else{

            if raffle.number_of_entitled_winners == raffle.winner_count {
                raffle.raffle_state = 3;
            }

        }


        raffle.serialize(&mut &mut raffle_account.data.borrow_mut()[..])?;

        Ok(())
    }

    fn claim_prize(
        accounts: &[AccountInfo],program_id: &Pubkey
    ) -> ProgramResult{

        let accounts_iter: &mut std::slice::Iter<'_, AccountInfo<'_>> = &mut accounts.iter();

        let raffle_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let raffle_account_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let winner_pda: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let winner_address: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let winner_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let reward_mint: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let token_program_id: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let sysvar: &AccountInfo<'_> = next_account_info(accounts_iter)?;


        let mut raffle: Raffle = Raffle::try_from_slice(&raffle_account.data.borrow())?;
        let mut participant: Participant = Participant::try_from_slice(&winner_pda.data.borrow())?;


        if raffle_account.owner != program_id {return Err(InvalidRaffle.into());}
        if winner_pda.owner != program_id {return Err(InvalidWinnerPDA.into());}

        if participant.entitled != 1 {return Err(InvalidParticipantPDA.into());}
        if participant.prize_claimed != 0 {return Err(InvalidParticipantPDA.into());}

        if raffle.raffle_no != participant.raffle_no{return Err(InvalidRaffleNo.into());}
        if winner_address.key.to_bytes() != participant.particpant_address {return Err(InvalidWinner.into());}
        if reward_mint.key.to_bytes() != raffle.reward_mint {return Err(InvalidWinner.into());}

        if raffle.raffle_state != 3{return Err(InvalidRaffleState.into());}

        if winner_ata.owner!=&spl_token::id() && winner_ata.owner!=&spl_token_2022::id(){

            let create_winner_ata: solana_program::instruction::Instruction = create_associated_token_account(
                winner_address.key,
                winner_address.key, 
              reward_mint.key, 
              token_program_id.key);

            invoke(&create_winner_ata,
                &[winner_address.clone(),winner_ata.clone(),reward_mint.clone(),token_program_id.clone(),sysvar.clone()])?;

        }else{
            let ata_unpacked: Account  = Account::unpack_from_slice(&winner_ata.data.borrow())?;

            if reward_mint.key != &ata_unpacked.mint {panic!()}
            if winner_address.key != &ata_unpacked.owner {panic!()}

            Self::check_mint_and_owner(reward_mint.key,winner_address.key,winner_ata)?;
          }


        let index = raffle.winners.iter().position(|&x| x == participant.particpant_no).unwrap();

        let prize_amount:u64 = raffle.rewards[index];



       let (raffle_account_address, bump) = 
       Pubkey::find_program_address(&[b"raffle", &raffle.raffle_no.to_le_bytes()], program_id);

        let transfer_token_ix = spl_token::instruction::transfer_checked(
            &token_program_id.key,
            &raffle_account_ata.key, 
            &reward_mint.key, 
            &winner_ata.key, 
            &raffle_account_address, 
            &[],prize_amount,raffle.reward_decimals)?;

        invoke_signed(
        &transfer_token_ix, 
        &[
            token_program_id.clone(),
            raffle_account_ata.clone(),
            reward_mint.clone(),
            winner_ata.clone(),
            raffle_account.clone()],
            &[&[b"raffle", &raffle.raffle_no.to_le_bytes(), &[bump]]],
        )?;


        participant.prize_claimed = 1;
        raffle.raffle_state = 4;

        raffle.serialize(&mut &mut raffle_account.data.borrow_mut()[..])?;
        participant.serialize(&mut &mut winner_pda.data.borrow_mut()[..])?;

        Ok(())
    }

    fn collect_fee_initializer(
        accounts: &[AccountInfo],program_id: &Pubkey
    ) -> ProgramResult{

        let accounts_iter: &mut std::slice::Iter<'_, AccountInfo<'_>> = &mut accounts.iter();

        let initializer: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let raffle_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let term_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;

        if !initializer.is_signer {return Err(InitializerNotSigner.into());}

        let  raffle: Raffle = Raffle::try_from_slice(&raffle_account.data.borrow())?;
        let  fee: Term = Term::try_from_slice(&term_account.data.borrow())?;

        if fee.initialized != 2 {return Err(InvalidFee.into());}

        if raffle_account.owner != program_id {return Err(InvalidRaffle.into());}
        if term_account.owner != program_id {return Err(InvalidRaffle.into());}

        if raffle.raffle_state < 2{return Err(InvalidRaffleState.into());}
        if raffle.initializer != initializer.key.to_bytes() {return Err(InvalidInitializer.into());}

        let rent: Rent = Rent::default();
        let rent_amount: u64 = rent.minimum_balance(187);

        msg!("1");
        let total_value: u64 = **raffle_account.try_borrow_lamports()?;
        msg!("2");
        let collected_value: u64 = total_value.checked_sub(rent_amount).ok_or(ArithmeticError)?;
        msg!("3");
        let collected_value_div_by_100: u64 = collected_value.checked_div(100).ok_or(ArithmeticError)?;
        msg!("4");
        let total_fee:u64 = collected_value_div_by_100.checked_mul(fee.fee_percent).ok_or(ArithmeticError)?;
        msg!("5");
        let transfer_to_initializer: u64 = collected_value.checked_sub(total_fee).ok_or(ArithmeticError)?;
        {
            msg!("total_value = {}",total_value);
            msg!("collected_value = {}",collected_value);
            msg!("collected_value_div_by_100 = {}",collected_value_div_by_100);
            msg!("total_fee = {}",total_fee);
            msg!("transfer_to_initializer = {}",transfer_to_initializer);
        }

        **raffle_account.try_borrow_mut_lamports()? -= total_fee;
        **raffle_account.try_borrow_mut_lamports()? -= transfer_to_initializer;

        **term_account.try_borrow_mut_lamports()? += total_fee;
        **initializer.try_borrow_mut_lamports()? += transfer_to_initializer;

        Ok(())
    }

    fn init_raffle_counter(
        accounts: &[AccountInfo],program_id: &Pubkey
    ) -> ProgramResult{


        let accounts_iter: &mut std::slice::Iter<'_, AccountInfo<'_>> = &mut accounts.iter();

        let initializer: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let counter_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;


        let rent: Rent = Rent::default();
        let rent_amount: u64 = rent.minimum_balance(9);


       let (counter_account_address, bump) = 
       Pubkey::find_program_address(&[b"counter" ], program_id);

        invoke_signed(
            &system_instruction::create_account(
                initializer.key,
                &counter_account_address,
                rent_amount,
                9,
                program_id,
            ),
            &[initializer.clone(), counter_account.clone()],
            &[&[b"counter", &[bump]]],
        )?;

        let counter = RaffleCounter{ 
            initialized: 1, 
            number_of_raffles: 0
         };

         counter.serialize(&mut &mut counter_account.data.borrow_mut()[..])?;


        Ok(())
    }

    fn close_participant_pda(
        accounts: &[AccountInfo]
    ) -> ProgramResult {


        let accounts_iter: &mut std::slice::Iter<'_, AccountInfo<'_>> = &mut accounts.iter();

        let authority: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let config: &AccountInfo<'_> = next_account_info(accounts_iter)?;


        let config = Config::try_from_slice(&config.data.borrow())?;
    
        Self::check_authority(authority.key, config)?;

        let total_loop: u64 = accounts_iter.len() as u64;

        for _x in 0..total_loop {

            let participant_pda: &AccountInfo<'_> = next_account_info(accounts_iter)?;

            let value = **participant_pda.try_borrow_lamports()?;

            **participant_pda.try_borrow_mut_lamports()? -= value;
            **authority.try_borrow_mut_lamports()? += value;

        }


        
        Ok(())
    }

    fn init_config(
        accounts: &[AccountInfo], program_id: &Pubkey
    ) -> ProgramResult {
    let accounts_iter: &mut std::slice::Iter<'_, AccountInfo<'_>> = &mut accounts.iter();

    let authority_1: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let authority_2: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let authority_3: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let authority_4: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let config_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;

    let (config_address, bump) = Pubkey::find_program_address( &[b"config"], program_id);

    let rent: Rent = Rent::default();
    let rent_amount: u64 = rent.minimum_balance(128);

    if config_account.owner != program_id {
        invoke_signed(
            &system_instruction::create_account(
                authority_1.key,
                &config_address,
                rent_amount,
                128,
                program_id,
            ),
            &[authority_1.clone(), config_account.clone()],
            &[&[b"config", &[bump]]],
        )?;
    }


    if !authority_1.is_signer {
        return Err(NotSignerAuth.into());
    }

    let config_data: Config = Config {
        authority_1: authority_1.key.to_bytes(),
        authority_2: authority_2.key.to_bytes(),
        authority_3: authority_3.key.to_bytes(),
        authority_4: authority_4.key.to_bytes(),
    };

    config_data.serialize(&mut &mut config_account.data.borrow_mut()[..])?;

    Ok(())
}

    fn set_config(
        accounts: &[AccountInfo], program_id: &Pubkey
    ) -> ProgramResult {
    let accounts_iter: &mut std::slice::Iter<'_, AccountInfo<'_>> = &mut accounts.iter();

    let authority: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let authority_1: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let authority_2: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let authority_3: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let authority_4: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let config_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    

    if config_account.owner != program_id {
        return Err(InvalidConfig.into());
    }
    

    let config: Config = Config::try_from_slice(&config_account.data.borrow())?;


    Self::check_authority(authority.key, config)?;
    

    if !authority.is_signer {
        return Err(NotSignerAuth.into());
    }
    

    let config_data: Config = Config {
        authority_1: authority_1.key.to_bytes(),
        authority_2: authority_2.key.to_bytes(),
        authority_3: authority_3.key.to_bytes(),
        authority_4: authority_4.key.to_bytes(),
    };
    

    config_data.serialize(&mut &mut config_account.data.borrow_mut()[..])?;

    Ok(())
}

    fn init_term_account(
    accounts: &[AccountInfo],
    program_id: &Pubkey,
    data: InitPda,
    ) -> ProgramResult {

    let accounts_iter: &mut std::slice::Iter<'_, AccountInfo<'_>> = &mut accounts.iter();

    let authority: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let term_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let config_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;

    if config_account.owner != program_id {
        return Err(InvalidConfig.into());
    }

    let config: Config = Config::try_from_slice(&config_account.data.borrow())?;


    Self::check_authority(authority.key, config)?;

    if !authority.is_signer {
        return Err(NotSignerAuth.into());
    }

    let (term_account_pubkey, bump) = Pubkey::find_program_address(&[b"term"], program_id);

    let create_ix: solana_program::instruction::Instruction =
        system_instruction::create_account(
            authority.key,
            &term_account_pubkey,
            data.lamports,
            17,
            program_id,
        );

    invoke_signed(
        &create_ix,
        &[authority.clone(), term_account.clone()],
        &[&[b"term", &[bump]]],
    )?;

    let terms: Term = Term { 
        initialized: 2,
        fee_percent: 0,
        expiration_time: 0,
        maximum_winner_count: 10,
    };

    terms.serialize(&mut &mut term_account.data.borrow_mut()[..])?;

    Ok(())
}

    fn update_terms(
    accounts: &[AccountInfo],
    program_id: &Pubkey,
    data: Term,
    ) -> ProgramResult {

    let accounts_iter: &mut std::slice::Iter<'_, AccountInfo<'_>> = &mut accounts.iter();

    let authority: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let term_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let config_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    

    if config_account.owner != program_id {
        return Err(InvalidConfig.into());
    }


    let config: Config = Config::try_from_slice(&config_account.data.borrow())?;


    Self::check_authority(authority.key, config)?;

    if !authority.is_signer {
        return Err(NotSignerAuth.into());
    }

    let terms: Term = Term{
        initialized:2,
        fee_percent: data.fee_percent,
        expiration_time: data.expiration_time,
        maximum_winner_count: data.maximum_winner_count
    };

    terms.serialize(&mut &mut term_account.data.borrow_mut()[..])?;

    Ok(())
}

    fn collect_fee(
    accounts: &[AccountInfo],
    program_id: &Pubkey,
    ) -> ProgramResult {

    let accounts_iter: &mut std::slice::Iter<'_, AccountInfo<'_>> = &mut accounts.iter();

    let authority: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let fee_collector: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let config_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;

    if config_account.owner != program_id {
        return Err(InvalidConfig.into());
    }


    let config: Config = Config::try_from_slice(&config_account.data.borrow())?;

    Self::check_authority(authority.key, config)?;

    if !authority.is_signer {
        return Err(NotSignerAuth.into());
    }

    let value: u64 = **fee_collector.lamports.borrow();

    let collected_fee: u64 = value.checked_sub(2500000).ok_or(ArithmeticError)?;

    **fee_collector.try_borrow_mut_lamports()? -= collected_fee;
    **authority.try_borrow_mut_lamports()? += collected_fee;
    
    Ok(())
   }

    fn check_authority(
        authority: &Pubkey, config: Config
    ) -> ProgramResult {
        let authority_address_1: Pubkey = Pubkey::new_from_array(config.authority_1);
        let authority_address_2: Pubkey = Pubkey::new_from_array(config.authority_2);
        let authority_address_3: Pubkey = Pubkey::new_from_array(config.authority_3);
        let authority_address_4: Pubkey = Pubkey::new_from_array(config.authority_4);
    
        let valid_authorities: [Pubkey; 4] = [
            authority_address_1,
            authority_address_2,
            authority_address_3,
            authority_address_4,
        ];
    
        if !valid_authorities.contains(authority) {
            return Err(InvalidAuth.into());
        }
    
        Ok(())
    }
    fn init_participant_pda<'a>(
        participant:&AccountInfo<'a>,
        participant_pda:&AccountInfo<'a>,
        multiple_participation_allowed:u8,
        raffle_no:u64,participant_no:u64,program_id: &Pubkey
    ) -> ProgramResult {

        let rent: Rent = Rent::default();
        let rent_amount: u64 = rent.minimum_balance(232);

        if multiple_participation_allowed != 1 {
            
            let (participant_pda_address, bump) = 
            Pubkey::find_program_address(
                &[
                b"raf", 
                &raffle_no.to_le_bytes(), 
                b"par",
                &participant.key.to_bytes()
                ], program_id);
    
    
             //raffle account created
             invoke_signed(
                 &system_instruction::create_account(
                    participant.key,
                     &participant_pda_address,
                     rent_amount,
                     232,
                     program_id,
                 ),
                 &[participant.clone(), participant_pda.clone()],
                 &[
                &[            
                 b"raf", 
                 &raffle_no.to_le_bytes(), 
                 b"par",
                 &participant.key.to_bytes(), &[bump]]
                 ],
             )?;

        }else{

            let (participant_pda_address, bump) = 
            Pubkey::find_program_address(
                &[
                b"raf", 
                &raffle_no.to_le_bytes(), 
                b"par",
                &participant_no.to_le_bytes()
                ], program_id);


             //raffle account created
             invoke_signed(
                 &system_instruction::create_account(
                    participant.key,
                     &participant_pda_address,
                     rent_amount,
                     232,
                     program_id,
                 ),
                 &[participant.clone(), participant_pda.clone()],
                 &[
                &[            
                 b"raf", 
                 &raffle_no.to_le_bytes(), 
                 b"par",
                 &participant_no.to_le_bytes(), &[bump]]
                 ],
             )?;
        }



        let participant: Participant = Participant{
            particpant_address: participant.key.to_bytes(),
            particpant_no: participant_no,
            raffle_no,
            entitled: 0,
            prize_claimed: 0,
            index_in_winners: 0,
        };


        participant.serialize(&mut &mut participant_pda.data.borrow_mut()[..])?;

        Ok(())
    }
    fn transfer_participation_fee_solana<'a>(
        participant:&AccountInfo<'a>,
        raffle_pda:&AccountInfo<'a>,
        fee:u64,
    )-> ProgramResult{

        invoke(&system_instruction::transfer(
            participant.key,
            raffle_pda.key, 
            fee), 
            &[participant.clone(),raffle_pda.clone()])?;

        Ok(())
    }
    fn transfer_participation_fee_token<'a>(
        token_program:&AccountInfo<'a>,
        participant:&AccountInfo<'a>,
        participant_ata:&AccountInfo<'a>,
        raffle_ata:&AccountInfo<'a>,
        participation_fee_mint:&AccountInfo<'a>,
        fee:u64,
        decimals:u8,
    )-> ProgramResult{


        let transfer_token_ix = spl_token::instruction::transfer_checked(
            &token_program.key,
            &participant_ata.key, 
            &participation_fee_mint.key, 
            &raffle_ata.key, 
            &participant.key, 
            &[],fee,decimals)?;

        invoke(
        &transfer_token_ix, 
        &[token_program.clone(),raffle_ata.clone(),participation_fee_mint.clone(),participant_ata.clone(),participant.clone()],
        )?;


        Ok(())
    }
    fn transfer_reward_to_raffle_pda<'a>(
        reward_mint:&AccountInfo<'a>,
        raffle_ata:&AccountInfo<'a>,
        initializer:&AccountInfo<'a>,
        initializer_ata:&AccountInfo<'a>,
        token_program:&AccountInfo<'a>,
        decimals:u8,
        total_rewards:u64,

    )-> ProgramResult{


        let transfer_token_ix = spl_token::instruction::transfer_checked(
            &token_program.key,
            &initializer_ata.key, 
            &reward_mint.key, 
            &raffle_ata.key, 
            &initializer.key, 
            &[],total_rewards,decimals)?;

        invoke(
        &transfer_token_ix, 
        &[token_program.clone(),raffle_ata.clone(),reward_mint.clone(),initializer_ata.clone(),initializer.clone()],
        )?;

        Ok(())
    }
    fn create_raffle_pda<'a>(
        initializer:&AccountInfo<'a>,
        raffle_pda:&AccountInfo<'a>,
        program_id: &Pubkey,
        raffle_no:&u64,
    )-> ProgramResult{

        let (raffle_account_address, bump) = 
        Pubkey::find_program_address(&[b"raffle", &raffle_no.to_le_bytes()], program_id);
 
         let rent: Rent = Rent::default();
         let rent_amount: u64 = rent.minimum_balance(187);
 
         //raffle account created
         invoke_signed(
             &system_instruction::create_account(
                 initializer.key,
                 &raffle_account_address,
                 rent_amount,
                 187,
                 program_id,
             ),
             &[initializer.clone(), raffle_pda.clone()],
             &[&[b"raffle", &raffle_no.to_le_bytes(), &[bump]]],
         )?;


        Ok(())
    }
    fn create_raffle_ata<'a>(
        initializer:&AccountInfo<'a>,
        raffle_pda:&AccountInfo<'a>,
        raffle_ata:&AccountInfo<'a>,
        token_mint:&AccountInfo<'a>,
        token_program:&AccountInfo<'a>,
        sysvar:&AccountInfo<'a>,
    )-> ProgramResult{
    
        let create_dex_ata: solana_program::instruction::Instruction = create_associated_token_account(
            initializer.key,
            raffle_pda.key, 
            token_mint.key, 
            token_program.key);
                
        invoke(&create_dex_ata,
              &[initializer.clone(),
              raffle_ata.clone(),
              raffle_pda.clone(),
              token_mint.clone(),
              token_program.clone(),
              sysvar.clone()])?;
        
        Ok(())
    }
    fn check_participation_fee_type(
        program_id: &Pubkey,
        fee_type: &RewardFeeType,
        fee_type_pda: &Pubkey,
    )-> ProgramResult{

        let (fee_type_pda_address, _bump) = 
        Pubkey::find_program_address(
            &[
            b"feetype", 
            &fee_type.no.to_le_bytes(), 

            ], program_id);

            if fee_type_pda != &fee_type_pda_address {
                return Err(InvalidRewardType.into());
            }


        Ok(())
    }
    fn check_participation_reward_type_and_sum(
        program_id: &Pubkey,
        reward_type: &RewardFeeType,
        rewards: &Vec<u64>,
        reward_type_pda: &Pubkey,
        total_rewards: &mut u64,
    ) -> ProgramResult {
        let (reward_type_pda_address, _bump) = Pubkey::find_program_address(
            &[b"rewtype", &reward_type.no.to_le_bytes()],
            program_id,
        );
    
        if reward_type_pda != &reward_type_pda_address {
            return Err(InvalidRewardType.into());
        }
    
        *total_rewards = rewards
            .iter()
            .try_fold(0u64, |acc, &x| acc.checked_add(x).ok_or(ArithmeticError))?;
    
        Ok(())
    }
    fn check_and_write_raffle_data<'a>(
        init_raffle:&InitRaffle,
        terms:&Term,
        initializer:&Pubkey,
        reward_mint:[u8;32],
        participation_fee_mint:[u8;32],
        reward_decimals:u8,
        participation_fee_decimals:u8,
        raffle_no:u64,
        raffle_pda:&AccountInfo<'a>
        
    )-> ProgramResult{


        //expiration time saved
        let clock: Clock= Clock::get()?;
        let current_time: u64 = clock.unix_timestamp as u64;
        let maximum_time_allowed: u64  = current_time.checked_add(terms.expiration_time).ok_or(ArithmeticError)?;
        if init_raffle.raffle_time < current_time{return Err(InvalidRaffleTime.into());}
        if init_raffle.raffle_time > maximum_time_allowed{return Err(InvalidRaffleTime.into());}
        if init_raffle.winner_count > terms.maximum_winner_count {return Err(InvalidWinnerNumber.into());}

        let n: usize = init_raffle.winner_count as usize;
        let winners: Vec<u64> = vec![0; n];

        let data: Raffle = Raffle{
            raffle_state: 1,
            reward_decimals,
            initializer: initializer.to_bytes(),
            reward_mint,
            raffle_name: init_raffle.raffle_name,
            raffle_no,
            current_number_of_participants: 0,
            participants_required:init_raffle.participants_required,
            participation_fee: init_raffle.participation_fee,
            raffle_time:init_raffle.raffle_time,
            is_unlimited_participant_allowed: init_raffle.is_unlimited_participant_allowed,
            multiple_participation_allowed: init_raffle.multiple_participation_allowed,
            participation_fee_mint,
            rewards: init_raffle.rewards.clone(),
            requirement_to_participate: init_raffle.requirement_to_participate,
            requirement_amount_token: init_raffle.requirement_amount_token,
            requirement_nft_mint: init_raffle.requirement_nft_mint,
            participation_fee_decimals,
            participation_fee_type: init_raffle.participation_fee_type,
            winners,
            winner_count:init_raffle.winner_count,
            current_winner_count: 0,
            number_of_entitled_winners: 0,
        };




        data.serialize(&mut &mut raffle_pda.data.borrow_mut()[..])?;


        Ok(())
    }
    fn check_accounts_init_raffle(
        counter:&RaffleCounter,
        terms:&Term,
        initializer:&AccountInfo,
        term_account:&AccountInfo,
        counter_account:&AccountInfo,
        reward_type_pda:&AccountInfo,
        fee_type_pda:&AccountInfo,
        program_id: &Pubkey
    )-> ProgramResult{


        if counter.initialized != 1 {return Err(InvalidCounter.into());}

        if terms.initialized != 2 {return Err(InvalidTerms.into());}

        if counter_account.owner != program_id{return Err(InvalidCounter.into());}
        if term_account.owner != program_id{return Err(InvalidTerms.into());}
        if reward_type_pda.owner != program_id{return Err(InvalidRewardType.into());}
        if fee_type_pda.owner != program_id{return Err(InvalidFeeType.into());}

        if fee_type_pda.is_writable{return Err(WritableAccount.into());}
        if reward_type_pda.is_writable{return Err(WritableAccount.into());}
        if term_account.is_writable{return Err(WritableAccount.into());}

        if !initializer.is_signer{return Err(InitializerNotSigner.into())}



        Ok(())
    }
    fn call_rng<'a>(
        authority: &AccountInfo<'a>,
        entropy_account: &AccountInfo<'a>,
        fee_account: &AccountInfo<'a>,
        system_program: &AccountInfo<'a>,
        rng_program: &AccountInfo<'a>,
        random_number: &mut u64,

    ) -> ProgramResult{

                //Creating account metas for CPI to RNG_PROGRAM
                let initializer_meta: AccountMeta = AccountMeta{ pubkey: *authority.key, is_signer: true, is_writable: true,};
                let entropy_account_meta: AccountMeta = AccountMeta{ pubkey: *entropy_account.key, is_signer: false, is_writable: true,};
                let fee_account_meta: AccountMeta = AccountMeta{ pubkey: *fee_account.key, is_signer: false, is_writable: true,};
                let system_program_meta: AccountMeta = AccountMeta{ pubkey: *system_program.key, is_signer: false, is_writable: false,};

                //Creating instruction to cpi RNG PROGRAM
                let ix:Instruction = Instruction { program_id: *rng_program.key,
                   accounts: [
                    initializer_meta,
                    entropy_account_meta,
                    fee_account_meta,
                    system_program_meta,
                   ].to_vec(), data: [100].to_vec() };

                //CPI to RNG_PROGRAM
                invoke(&ix, 
                  &[
                    authority.clone(),
                    entropy_account.clone(),
                    fee_account.clone(),
                    system_program.clone(),
                    ])?;

                let returned_data:(Pubkey, Vec<u8>)= get_return_data().unwrap();

                //Random number is returned from the RNG_PROGRAM
                let random_number_struct:RandomNumber;
                if &returned_data.0 == rng_program.key{
                    random_number_struct = RandomNumber::try_from_slice(&returned_data.1)?;
                  msg!("{}",random_number_struct.random_number);
                }else{
                    return Err(RNGProgramError.into());
                }

                *random_number = random_number_struct.random_number;

        Ok(())
    }
    fn check_mint_and_owner(
        mint: &Pubkey,owner: &Pubkey,ata:&AccountInfo
    ) -> ProgramResult {

        let ata_unpacked: spl_token::state::Account = Account::unpack_from_slice(&ata.data.borrow())?;
    
    
        if mint != &ata_unpacked.mint {panic!()}
        if owner != &ata_unpacked.owner {panic!()}
    
        Ok(())

    }
    fn check_amount(
        amount: u64, ata:&AccountInfo
    ) -> ProgramResult{

        let ata_unpacked: spl_token::state::Account = Account::unpack_from_slice(&ata.data.borrow())?;


        if amount > ata_unpacked.amount{panic!()}

        Ok(())

    }

    fn abort_raffle<'a>(
        initializer:&AccountInfo<'a>,
        initializer_ata:&AccountInfo<'a>,
        raffle_pda:&AccountInfo<'a>,
        raffle_ata:&AccountInfo<'a>,
        reward_mint:&AccountInfo<'a>,
        token_program:&AccountInfo<'a>,
        total_rewards: u64,
        decimals:u8
    ) -> ProgramResult {


        let transfer_token_ix = spl_token::instruction::transfer_checked(
            &token_program.key,
            &raffle_ata.key, 
            &reward_mint.key, 
            &initializer_ata.key, 
            &raffle_pda.key, 
            &[],total_rewards,decimals)?;

        invoke_signed(
        &transfer_token_ix, 
        &[token_program.clone(),raffle_ata.clone(),reward_mint.clone(),initializer_ata.clone(),initializer.clone()],
        &[&[]]
        )?;

        Ok(())
    }

}


//cekilis kayit acik - 1
//cekilis yapildi  - 2
//kazanan yazildi - 3
//kazanan odulu aldi - 4

