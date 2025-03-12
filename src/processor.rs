use crate::{instruction::RaffleProgramInstruction, state::{ Config, FeeCollector, InitRaffle, Participant, Raffle, RaffleCounter, RandomNumber, RewardFeeType, Rewards, Term}};
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo}, entrypoint::ProgramResult, instruction::{AccountMeta, Instruction}, msg, program::{get_return_data, invoke, invoke_signed}, pubkey::Pubkey, rent::Rent, system_instruction, system_program, sysvar::{clock::Clock, Sysvar,}
};

use solana_program::program_pack::Pack;
use spl_token::state::{Account, Mint};


use crate::error::RaffleProgramError::{InvalidCounter, ArithmeticError, InvalidInitializer, WritableAccount,InvalidMint,
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
            RaffleProgramInstruction::ClosePDA => {
                Self::close_participant_pda(accounts)
            },
            RaffleProgramInstruction::InitTerm => {
                Self::init_term_account(accounts, program_id)
            },
            RaffleProgramInstruction::InitConfig => {
                Self::init_config(accounts, program_id)
            },
            RaffleProgramInstruction::InitCounter => {
                Self::init_raffle_counter(accounts, program_id)
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
            RaffleProgramInstruction::InitFeeType {data}=> {
                Self::init_fee_type_account(accounts, program_id, data)
            },
            RaffleProgramInstruction::InitRewType {data}=> {
                Self::init_reward_type_account(accounts, program_id, data)
            },
            RaffleProgramInstruction::CollectFeeToken => {
                Self::collect_fee_token(accounts, program_id)
            },
            RaffleProgramInstruction::InitFeeCollector => {
                Self::init_fee_collector_account(accounts, program_id)
            },
            RaffleProgramInstruction::AddSolPool { rewards } => {
                Self::add_solana_to_the_reward_pool(accounts, program_id,rewards)
            },
            RaffleProgramInstruction::AddTokenPool { rewards } => {
                Self::add_tokens_to_the_reward_pool(accounts, program_id,rewards)
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
       let raffle_reward_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
       let raffle_fee_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
       let counter_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;
       let term_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;
       let reward_type_pda: &AccountInfo<'_> = next_account_info(accounts_iter)?;
       let fee_type_pda: &AccountInfo<'_> = next_account_info(accounts_iter)?;
       let reward_mint: &AccountInfo<'_> = next_account_info(accounts_iter)?;
       let reward_mint_token_program: &AccountInfo<'_> = next_account_info(accounts_iter)?;
       let fee_mint: &AccountInfo<'_> = next_account_info(accounts_iter)?;
       let fee_mint_token_program: &AccountInfo<'_> = next_account_info(accounts_iter)?;
       let sysvar: &AccountInfo<'_> = next_account_info(accounts_iter)?;



       let mut counter: RaffleCounter = RaffleCounter::try_from_slice(&counter_account.data.borrow())?;
       let terms: Term = Term::try_from_slice(&term_account.data.borrow())?;
       let reward_type: RewardFeeType = RewardFeeType::try_from_slice(&reward_type_pda.data.borrow())?;
       let fee_type: RewardFeeType = RewardFeeType::try_from_slice(&fee_type_pda.data.borrow())?;

       if reward_type.initialized != 2 {return Err(InvalidTerms.into());}
       if fee_type.initialized != 3 {return Err(InvalidTerms.into());}

       counter.number_of_raffles = counter.number_of_raffles.checked_add(1).ok_or(ArithmeticError)?;

       Self::check_accounts_init_raffle(&counter,&terms,initializer,term_account,counter_account,reward_type_pda,fee_type_pda,program_id)?;

       let mut total_rewards:u64 = 0;
       let mut participation_fee_total:u64 = 0;
       Self::check_participation_reward_type_and_sum(program_id,&reward_type,&init_raffle.rewards,&init_raffle.transfer_fee_to_pool,reward_type_pda.key,&mut total_rewards,&mut participation_fee_total,init_raffle.participation_fee)?;
       {
       msg!("{}",total_rewards);
       msg!("{}",participation_fee_total);
       }

       Self::check_participation_fee_type(program_id,&fee_type,fee_type_pda.key)?;
       msg!("5");

       Self::check_and_write_raffle_data(&init_raffle,&terms,reward_type.mint,fee_type.mint,reward_type.decimals,fee_type.decimals,counter.number_of_raffles,raffle_pda, initializer, program_id)?;

       msg!("reward_type {}",init_raffle.reward_type);
       msg!("participation_fee_type {}",init_raffle.participation_fee_type);

       if init_raffle.reward_type != 1 {

        Self::create_ata(initializer,raffle_pda,raffle_reward_ata,reward_mint,reward_mint_token_program,sysvar)?;
       }
       msg!("7");

       if init_raffle.participation_fee_type != 1 {
        if reward_type.mint != fee_type.mint {
            Self::create_ata(initializer,raffle_pda,raffle_fee_ata,fee_mint,fee_mint_token_program,sysvar)?;
        }
       }
       msg!("8");


       if reward_type.no == 1 {

            let ix = system_instruction::transfer(initializer.key, raffle_pda.key, total_rewards);

            invoke(&ix, &[initializer.clone(),raffle_pda.clone()])?;
        
       }else{

            Self::transfer_tokens_to_raffle_pda(reward_mint,raffle_reward_ata,initializer,initializer_ata,reward_mint_token_program,reward_type.decimals,total_rewards)?;
       }

       if init_raffle.requirement_to_participate == 1 {

            let raffle_reqired_token_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
            let required_token_mint: &AccountInfo<'_> = next_account_info(accounts_iter)?;
            let required_mint_token_program: &AccountInfo<'_> = next_account_info(accounts_iter)?;


            msg!("requirement_mint {:?}",Pubkey::new_from_array(init_raffle.requirement_mint).to_string());
            msg!("required_token_mint {:?}",required_token_mint.key.to_string());

            if init_raffle.requirement_mint != required_token_mint.key.to_bytes() {return Err(InvalidMint.into())}


            Self::create_ata(initializer,raffle_pda,raffle_reqired_token_ata,required_token_mint,required_mint_token_program,sysvar)?;

       }


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

        let mut raffle: Raffle = Raffle::try_from_slice(&raffle_pda.data.borrow())?;

        if participation_fee_mint.key.to_bytes() != raffle.participation_fee_mint { return Err(InvalidFeeType.into());}

        if raffle.raffle_state != 1 {return Err(InvalidRaffleState.into());}

        if raffle.is_unlimited_participant_allowed != 1{
            if raffle.participants_required <= raffle.current_number_of_participants {return Err(MaxNumberReached.into());}
        }

        let clock: Clock= Clock::get()?;
        let current_time: u64 = clock.unix_timestamp as u64;


        //user cant join raffle after raffle time is passed
        if current_time > raffle.raffle_time {return Err(InvalidRaffleTime.into())}

        raffle.current_number_of_participants = raffle.current_number_of_participants.checked_add(1).ok_or(ArithmeticError)?;
        msg!("3");


        Self::init_participant_pda(participant, participant_pda, raffle.multiple_participation_allowed, raffle.raffle_no, raffle.current_number_of_participants, program_id)?;

        let fee:u64 = raffle.participation_fee;
        if raffle.participation_fee_type == 1 {

            invoke(&system_instruction::transfer(
                participant.key,
                raffle_pda.key, 
                fee), 
                &[participant.clone(),raffle_pda.clone()])?;


        }else{

           let participant_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
           let raffle_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
           let token_program: &AccountInfo<'_> = next_account_info(accounts_iter)?;


           if participation_fee_mint.owner != &spl_token::id() && participation_fee_mint.owner != &spl_token_2022::id(){return Err(InvalidMint.into());}

           Self::check_mint_and_owner(participation_fee_mint.key, participant.key, participant_ata)?;
           Self::check_mint_and_owner(participation_fee_mint.key, raffle_pda.key, raffle_ata)?;

           msg!("participation_fee_type{}",raffle.participation_fee_type);
           msg!("participation_fee_decimals{}",raffle.participation_fee_decimals);
           msg!("participation_fee_mint {}",Pubkey::new_from_array(raffle.participation_fee_mint).to_string());

           Self::transfer_tokens_to_raffle_pda(participation_fee_mint, raffle_ata, participant, participant_ata, 
            token_program, raffle.participation_fee_decimals, fee)?;
        }


        //if required to have tokens transfer them to raffle_ata
        if raffle.requirement_to_participate == 1 {

            let requirement_mint: &AccountInfo<'_> = next_account_info(accounts_iter)?;
            let participant_requirement_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
            let raffle_requirement_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
            let req_mint_token_program: &AccountInfo<'_> = next_account_info(accounts_iter)?;

            if raffle.requirement_mint != requirement_mint.key.to_bytes(){return Err(InvalidMint.into());}


           msg!("required_token_decimals{}",raffle.required_token_decimals);
           msg!("requirement_mint {}",requirement_mint.key.to_string());

            Self::check_mint_and_owner_and_amount(&Pubkey::new_from_array(raffle.requirement_mint), participant.key, participant_requirement_ata, raffle.requirement_amount_token)?;
        
            Self::transfer_tokens_to_raffle_pda(requirement_mint, raffle_requirement_ata, participant, participant_requirement_ata, req_mint_token_program, raffle.required_token_decimals, raffle.requirement_amount_token)?;
        
        }


        if raffle.is_increasing_pool == 1 {

            for i in 0..raffle.rewards.len() {
                raffle.rewards[i] = raffle.rewards[i].checked_add(raffle.transfer_fee_to_pool[i]).ok_or(ArithmeticError)?;
            }

        }


        msg!("6");
        let participant: Participant = Participant{
            particpant_address: participant.key.to_bytes(),
            particpant_no: raffle.current_number_of_participants,
            raffle_no: raffle.raffle_no,
            entitled: 0,
            prize_claimed: 0,
            index_in_winners: 0,
        };

        msg!("7");
        raffle.serialize(&mut &mut raffle_pda.data.borrow_mut()[..])?;
        msg!("8");
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
{
        msg!("current_number_of_participants = {}",raffle.current_number_of_participants);
        msg!("participants_required = {}",raffle.participants_required);
        msg!("current_winner_count = {}",raffle.current_winner_count);
        msg!("winner_count = {}",raffle.winner_count);
        msg!("raffle_state = {}",raffle.raffle_state);
}
        if raffle.raffle_state != 1{return Err(InvalidRaffleState.into());}

        if raffle.is_unlimited_participant_allowed == 1 {
            msg!("2");
 
         //if current time is bigger than raffle time it is raffle time
           //if current_time < raffle.raffle_time {return Err(InvalidRaffleState.into());}
        }else{
            msg!("3");

           if raffle.current_number_of_participants != raffle.participants_required && current_time < raffle.raffle_time {
        msg!("4");
        return Err(InvalidRaffleState.into());}
        }


        let mut attempts:u64 = 0;

        let mut winners: Vec<u64> = raffle.winners.clone();
        winners.retain(|&x| x != 0);

        if raffle.current_number_of_participants == 0 {

            msg!("abort raffle");

        let initializer_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let raffle_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let reward_mint: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let token_program: &AccountInfo<'_> = next_account_info(accounts_iter)?;

        let total_rewards: u64 = raffle.rewards.iter().sum();

            Self::abort_raffle(initializer_ata,raffle_pda,raffle_ata,reward_mint,token_program,total_rewards,raffle.raffle_no,raffle.reward_decimals,raffle.bump)?;
            raffle.raffle_state = 3;

        }else if raffle.current_number_of_participants == 1  {

            let winner_no:u64 = 1;
            winners.push(winner_no);
            raffle.raffle_state = 2;
            raffle.current_winner_count = 1;

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
        let n: usize = raffle.winner_count as usize;
        winners.resize(n, 0);


        raffle.winners = winners;
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
            msg!("raffle no match");

            if participant.entitled != 0 {return Err(InvalidParticipantPDA.into());}
            msg!("entitled");
            if !raffle.winners.contains(&participant.particpant_no){return Err(InvalidParticipantPDA.into());}
            msg!("contains");

            let index = raffle.winners.iter().position(|&x| x == participant.particpant_no).unwrap();

            participant.entitled = 1;
            participant.index_in_winners = index as u64;

            raffle.number_of_entitled_winners = raffle.number_of_entitled_winners.checked_add(1).ok_or(ArithmeticError)?;

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


        let raffle: Raffle = Raffle::try_from_slice(&raffle_account.data.borrow())?;
        let mut participant: Participant = Participant::try_from_slice(&winner_pda.data.borrow())?;


        if raffle_account.owner != program_id {return Err(InvalidRaffle.into());}
        if winner_pda.owner != program_id {return Err(InvalidWinnerPDA.into());}
        if raffle.raffle_no != participant.raffle_no{return Err(InvalidRaffleNo.into());}
        if winner_address.key.to_bytes() != participant.particpant_address {return Err(InvalidWinner.into());}
        if raffle.raffle_state != 3{return Err(InvalidRaffleState.into());}
        if participant.prize_claimed != 0 {return Err(InvalidParticipantPDA.into());}




        if raffle.requirement_to_participate == 1{

            let raffle_req_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
            let participant_req_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
            let req_mint: &AccountInfo<'_> = next_account_info(accounts_iter)?;
            let req_mint_token_program: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    
            if raffle.requirement_mint != req_mint.key.to_bytes(){return Err(InvalidMint.into());}

       
            Self::transfer_tokens_from_raffle_pda(req_mint, raffle_req_ata, raffle_account, participant_req_ata,
                          req_mint_token_program, raffle.required_token_decimals, raffle.requirement_amount_token,raffle.raffle_no,     raffle.bump)?;
        }

        if participant.entitled == 1 {
                
            if reward_mint.key.to_bytes() != raffle.reward_mint {return Err(InvalidWinner.into());}
            let index = raffle.winners.iter().position(|&x| x == participant.particpant_no).unwrap();
            let prize_amount:u64 = raffle.rewards[index];
     

            if raffle.reward_mint == system_program::ID.to_bytes() {

                **raffle_account.try_borrow_mut_lamports()? -= prize_amount;
                **winner_address.try_borrow_mut_lamports()? += prize_amount;

        
            }else{

                if winner_ata.owner!=&spl_token::id() && winner_ata.owner!=&spl_token_2022::id(){

                    Self::create_ata(winner_address, winner_address, winner_ata, reward_mint, token_program_id, sysvar)?;
                   
                }else{
                
                    let ata_unpacked: Account  = Account::unpack_from_slice(&winner_ata.data.borrow())?;
        
                    if reward_mint.key != &ata_unpacked.mint {panic!()}
                    if winner_address.key != &ata_unpacked.owner {panic!()}
        
                    Self::check_mint_and_owner(reward_mint.key,winner_address.key,winner_ata)?;
                }

                Self::transfer_tokens_from_raffle_pda(reward_mint, raffle_account_ata, raffle_account, winner_ata, token_program_id, raffle.reward_decimals, prize_amount, raffle.raffle_no, raffle.bump)?;
           }
       }




        participant.prize_claimed = 1;

        participant.serialize(&mut &mut winner_pda.data.borrow_mut()[..])?;

        Ok(())
    }

    fn collect_fee_initializer(
        accounts: &[AccountInfo],program_id: &Pubkey
    ) -> ProgramResult{

        let accounts_iter: &mut std::slice::Iter<'_, AccountInfo<'_>> = &mut accounts.iter();

        let initializer: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let raffle_pda: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let term_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;
        let fee_collector_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;


        let  mut raffle: Raffle = Raffle::try_from_slice(&raffle_pda.data.borrow())?;
        let  terms: Term = Term::try_from_slice(&term_account.data.borrow())?;
        let  fee_collector: FeeCollector = FeeCollector::try_from_slice(&fee_collector_account.data.borrow())?;

        if terms.initialized != 2 {return Err(InvalidTerms.into());}
        if fee_collector.initialized != 3 {return Err(InvalidFee.into());}

        if raffle_pda.owner != program_id {return Err(InvalidRaffle.into());}
        if term_account.owner != program_id {return Err(InvalidRaffle.into());}
        if fee_collector_account.owner != program_id {return Err(InvalidRaffle.into());}

        if raffle.raffle_state < 2{return Err(InvalidRaffleState.into());}
        if raffle.fee_collected != 0{return Err(InvalidRaffleState.into());}
        if raffle.initializer != initializer.key.to_bytes() {return Err(InvalidInitializer.into());}

        if raffle.participation_fee_type == 1{


            let data_len: usize = raffle_pda.data_len();
            let rent: Rent = Rent::default();
            let rent_amount: u64 = rent.minimum_balance(data_len);
            let total_value: u64 = **raffle_pda.try_borrow_lamports()?;
            let mut collected_value: u64 = total_value.checked_sub(rent_amount).ok_or(ArithmeticError)?;

            if raffle.is_increasing_pool == 1 {
                let total_rewards: u64 = raffle.rewards.iter().try_fold(0u64, |acc, &x| acc.checked_add(x).ok_or(ArithmeticError))?;
                collected_value = collected_value.checked_sub(total_rewards).ok_or(ArithmeticError)?;
            }else if raffle.participation_fee_mint == raffle.reward_mint{
                let total_rewards: u64 = raffle.rewards.iter().try_fold(0u64, |acc, &x| acc.checked_add(x).ok_or(ArithmeticError))?;
                collected_value = collected_value.checked_sub(total_rewards).ok_or(ArithmeticError)?;
            }

            let collected_value_div_by_100: u64 = collected_value.checked_div(100).ok_or(ArithmeticError)?;
            let total_fee:u64 = collected_value_div_by_100.checked_mul(terms.fee_percent).ok_or(ArithmeticError)?;
            let transfer_to_initializer: u64 = collected_value.checked_sub(total_fee).ok_or(ArithmeticError)?;


            **raffle_pda.try_borrow_mut_lamports()? -= total_fee;
            **raffle_pda.try_borrow_mut_lamports()? -= transfer_to_initializer;
    
            **fee_collector_account.try_borrow_mut_lamports()? += total_fee;
            **initializer.try_borrow_mut_lamports()? += transfer_to_initializer;

        }else{

            let fee_collector_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
            let initializer_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
            let raffle_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
            let token_program: &AccountInfo<'_> = next_account_info(accounts_iter)?;
            let participation_fee_mint: &AccountInfo<'_> = next_account_info(accounts_iter)?;

            let raffle_ata_unpacked: spl_token::state::Account = Account::unpack_from_slice(&raffle_ata.data.borrow())?;
            let mut collected_value: u64 = raffle_ata_unpacked.amount;

            if raffle.is_increasing_pool == 1 {
                let total_rewards: u64 = raffle.rewards.iter().try_fold(0u64, |acc, &x| acc.checked_add(x).ok_or(ArithmeticError))?;
                collected_value = collected_value.checked_sub(total_rewards).ok_or(ArithmeticError)?;
            }else if raffle.participation_fee_mint == raffle.reward_mint{
                let total_rewards: u64 = raffle.rewards.iter().try_fold(0u64, |acc, &x| acc.checked_add(x).ok_or(ArithmeticError))?;
                collected_value = collected_value.checked_sub(total_rewards).ok_or(ArithmeticError)?;
            }

            let collected_value_div_by_100: u64 = collected_value.checked_div(100).ok_or(ArithmeticError)?;
            let total_fee:u64 = collected_value_div_by_100.checked_mul(terms.fee_percent).ok_or(ArithmeticError)?;
            let transfer_to_initializer: u64 = collected_value.checked_sub(total_fee).ok_or(ArithmeticError)?;


            Self::transfer_tokens_from_raffle_pda(participation_fee_mint, raffle_ata, raffle_pda, initializer_ata, token_program, raffle.participation_fee_decimals, transfer_to_initializer, raffle.raffle_no, raffle.bump)?;

            Self::transfer_tokens_from_raffle_pda(participation_fee_mint, raffle_ata, raffle_pda, fee_collector_ata, token_program, raffle.participation_fee_decimals, total_fee, raffle.raffle_no, raffle.bump)?;
        }

        raffle.fee_collected = 1;

        raffle.serialize(&mut &mut raffle_pda.data.borrow_mut()[..])?;


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


    let rent: Rent = Rent::default();
    let rent_amount: u64 = rent.minimum_balance(25);

    let create_ix: solana_program::instruction::Instruction =
        system_instruction::create_account(
            authority.key,
            &term_account_pubkey,
            rent_amount,
            25,
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

    fn init_fee_collector_account(
    accounts: &[AccountInfo],
    program_id: &Pubkey,
    ) -> ProgramResult {

    let accounts_iter: &mut std::slice::Iter<'_, AccountInfo<'_>> = &mut accounts.iter();

    let authority: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let fee_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let config_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;

    if config_account.owner != program_id {
        return Err(InvalidConfig.into());
    }

    let config: Config = Config::try_from_slice(&config_account.data.borrow())?;


    Self::check_authority(authority.key, config)?;

    if !authority.is_signer {
        return Err(NotSignerAuth.into());
    }

    let (term_account_pubkey, bump) = Pubkey::find_program_address(&[b"fee_collector"], program_id);

    let rent: Rent = Rent::default();
    let rent_amount: u64 = rent.minimum_balance(1);

    let create_ix: solana_program::instruction::Instruction =
        system_instruction::create_account(
            authority.key,
            &term_account_pubkey,
            rent_amount,
            1,
            program_id,
        );

    invoke_signed(
        &create_ix,
        &[authority.clone(), fee_account.clone()],
        &[&[b"fee_collector", &[bump]]],
    )?;

    let fee_collector: FeeCollector = FeeCollector { 
        initialized: 3,
    };

    fee_collector.serialize(&mut &mut fee_account.data.borrow_mut()[..])?;

    Ok(())
}
    
    fn init_fee_type_account(
    accounts: &[AccountInfo],
    program_id: &Pubkey,
    fee_type: RewardFeeType
    ) -> ProgramResult {

    let accounts_iter: &mut std::slice::Iter<'_, AccountInfo<'_>> = &mut accounts.iter();

    let authority: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let fee_type_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let fee_collector: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let fee_collector_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let token_mint: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let token_program: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let sysvar: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let config_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;

    if config_account.owner != program_id {
        return Err(InvalidConfig.into());
    }

    let config: Config = Config::try_from_slice(&config_account.data.borrow())?;


    Self::check_authority(authority.key, config)?;

    if !authority.is_signer {
        return Err(NotSignerAuth.into());
    }

    let (fee_type_pda_address, bump) = Pubkey::find_program_address(&[b"feetype", &fee_type.no.to_le_bytes(), ], program_id);

    let rent: Rent = Rent::default();
    let rent_amount: u64 = rent.minimum_balance(42);

    let create_ix: solana_program::instruction::Instruction =
        system_instruction::create_account(
            authority.key,
            &fee_type_pda_address,
            rent_amount,
            42,
            program_id,
        );


    invoke_signed(
        &create_ix,
        &[authority.clone(), fee_type_account.clone()],
        &[&[b"feetype", &fee_type.no.to_le_bytes(), &[bump]]],
    )?;

    if fee_type.no != 1{
        let create_ata: solana_program::instruction::Instruction = create_associated_token_account(
            authority.key,
            fee_collector.key, 
            token_mint.key, 
            token_program.key);
                
        invoke(&create_ata,
              &[authority.clone(),
              fee_collector.clone(),
              fee_collector_ata.clone(),
              token_mint.clone(),
              token_program.clone(),
              sysvar.clone()])?;
    }



    fee_type.serialize(&mut &mut fee_type_account.data.borrow_mut()[..])?;

    Ok(())
}
        
    fn init_reward_type_account(
    accounts: &[AccountInfo],
    program_id: &Pubkey,
    reward_type: RewardFeeType
    ) -> ProgramResult {

    let accounts_iter: &mut std::slice::Iter<'_, AccountInfo<'_>> = &mut accounts.iter();

    let authority: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let reward_type_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let config_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;

    if config_account.owner != program_id {
        return Err(InvalidConfig.into());
    }

    let config: Config = Config::try_from_slice(&config_account.data.borrow())?;


    Self::check_authority(authority.key, config)?;

    if !authority.is_signer {
        return Err(NotSignerAuth.into());
    }

    let (fee_type_pda_address, bump) = Pubkey::find_program_address(&[b"rewtype", &reward_type.no.to_le_bytes(), ], program_id);

    let rent: Rent = Rent::default();
    let rent_amount: u64 = rent.minimum_balance(42);

    let create_ix: solana_program::instruction::Instruction =
        system_instruction::create_account(
            authority.key,
            &fee_type_pda_address,
            rent_amount,
            42,
            program_id,
        );

    invoke_signed(
        &create_ix,
        &[authority.clone(), reward_type_account.clone()],
        &[&[b"rewtype", &reward_type.no.to_le_bytes(), &[bump]]],
    )?;


    reward_type.serialize(&mut &mut reward_type_account.data.borrow_mut()[..])?;

    Ok(())
}

    fn collect_fee_token(
    accounts: &[AccountInfo],
    program_id: &Pubkey,
    ) -> ProgramResult {

    let accounts_iter: &mut std::slice::Iter<'_, AccountInfo<'_>> = &mut accounts.iter();

    let authority: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let authority_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let fee_collector: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let fee_collector_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let token_program: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let participation_fee_mint: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let config_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;

    if config_account.owner != program_id {
        return Err(InvalidConfig.into());
    }


    let config: Config = Config::try_from_slice(&config_account.data.borrow())?;

    Self::check_authority(authority.key, config)?;

    if !authority.is_signer {
        return Err(NotSignerAuth.into());
    }


    let fee_collector_ata_unpacked: spl_token::state::Account = Account::unpack_from_slice(&fee_collector_ata.data.borrow())?;
    let mint_unpacked: Mint = Mint::unpack(&participation_fee_mint.data.borrow())?;

    let collected_value: u64 = fee_collector_ata_unpacked.amount;
    let decimals: u8 = mint_unpacked.decimals;


    let transfer_collected_fee_to_initializer: Instruction = spl_token::instruction::transfer_checked(
            &token_program.key,
            &fee_collector_ata.key, 
            &participation_fee_mint.key, 
            &authority_ata.key, 
            &fee_collector.key, 
            &[],collected_value,decimals)?;

    invoke_signed(
        &transfer_collected_fee_to_initializer, 
        &[token_program.clone(),authority_ata.clone(),participation_fee_mint.clone(),fee_collector_ata.clone(),fee_collector.clone()],
        &[&[b"fee_collector"]]
        )?;

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

    let rent: Rent = Rent::default();
    let rent_amount: u64 = rent.minimum_balance(1);

    let collected_fee: u64 = value.checked_sub(rent_amount).ok_or(ArithmeticError)?;

    **fee_collector.try_borrow_mut_lamports()? -= collected_fee;
    **authority.try_borrow_mut_lamports()? += collected_fee;
    
    Ok(())
   }
    
   fn add_solana_to_the_reward_pool(
        accounts: &[AccountInfo],program_id: &Pubkey,amount:Rewards
   ) -> ProgramResult{

    let accounts_iter: &mut std::slice::Iter<'_, AccountInfo<'_>> = &mut accounts.iter();

    let payer: &AccountInfo<'_> = next_account_info(accounts_iter)?;
    let raffle_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;

    if raffle_account.owner != program_id {return Err(InvalidRaffle.into());}

    let mut raffle: Raffle = Raffle::try_from_slice(&raffle_account.data.borrow())?;

    if raffle.raffle_state != 1 {return Err(InvalidRaffleState.into());}

    let total_rewards = amount.rewards.iter().try_fold(0u64, |acc, &x| acc.checked_add(x).ok_or(ArithmeticError))?;

    invoke(&system_instruction::transfer(
        payer.key,
        raffle_account.key, 
        total_rewards), 
        &[payer.clone(),raffle_account.clone()])?;

    if raffle.rewards.len() != amount.rewards.len() {return Err(ArithmeticError.into());}


    for i in 0..amount.rewards.len() {

        raffle.rewards[i] = raffle.rewards[i].checked_add(amount.rewards[i]).ok_or(ArithmeticError)?;

    }


    raffle.serialize(&mut &mut raffle_account.data.borrow_mut()[..])?;

    Ok(())
}

   fn add_tokens_to_the_reward_pool(
    accounts: &[AccountInfo],program_id: &Pubkey,amount:Rewards
   ) -> ProgramResult{

let accounts_iter: &mut std::slice::Iter<'_, AccountInfo<'_>> = &mut accounts.iter();

let payer: &AccountInfo<'_> = next_account_info(accounts_iter)?;
let payer_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
let raffle_account: &AccountInfo<'_> = next_account_info(accounts_iter)?;
let raffle_ata: &AccountInfo<'_> = next_account_info(accounts_iter)?;
let reward_token_mint: &AccountInfo<'_> = next_account_info(accounts_iter)?;
let token_program: &AccountInfo<'_> = next_account_info(accounts_iter)?;

if raffle_account.owner != program_id {return Err(InvalidRaffle.into());}

let mut raffle: Raffle = Raffle::try_from_slice(&raffle_account.data.borrow())?;

if raffle.raffle_state != 1 {return Err(InvalidRaffleState.into());}

let total_rewards = amount.rewards.iter().try_fold(0u64, |acc, &x| acc.checked_add(x).ok_or(ArithmeticError))?;

Self::transfer_tokens_to_raffle_pda(reward_token_mint, raffle_ata, payer, payer_ata, token_program, 
    raffle.reward_decimals, total_rewards)?;

if raffle.rewards.len() != amount.rewards.len() {return Err(ArithmeticError.into());}


for i in 0..amount.rewards.len() {

    raffle.rewards[i] = raffle.rewards[i].checked_add(amount.rewards[i]).ok_or(ArithmeticError)?;

}


raffle.serialize(&mut &mut raffle_account.data.borrow_mut()[..])?;

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

        msg!("init_participant_pda");
        let rent: Rent = Rent::default();
        let rent_amount: u64 = rent.minimum_balance(58);

        if multiple_participation_allowed != 1 {

        msg!("multiple_participation_allowed {}",multiple_participation_allowed);

            
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
                     58,
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
            {
                msg!("derived_adress = {}",participant_pda_address.to_string());
                msg!("derived_adress = {}",participant.key.to_string());
            }
             invoke_signed(
                 &system_instruction::create_account(
                    participant.key,
                     &participant_pda_address,
                     rent_amount,
                     58,
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



        let data: Participant = Participant{
            particpant_address: participant.key.to_bytes(),
            particpant_no: participant_no,
            raffle_no,
            entitled: 0,
            prize_claimed: 0,
            index_in_winners: 0,
        };

        {
         msg!("data length = {}",participant_pda.data.borrow().len());
        }

        msg!("serializing");
        data.serialize(&mut &mut participant_pda.data.borrow_mut()[..])?;
        msg!("serializing succesful");


        Ok(())
    }
    
    fn create_raffle_pda<'a>(
        initializer:&AccountInfo<'a>,
        raffle_pda:&AccountInfo<'a>,
        program_id: &Pubkey,
        raffle_account_address:&Pubkey,
        raffle_no:&u64,
        data_len:usize,
        bump:u8
    )-> ProgramResult{

 
         let rent: Rent = Rent::default();
         let rent_amount: u64 = rent.minimum_balance(data_len);
 
         //raffle account created
         invoke_signed(
             &system_instruction::create_account(
                 initializer.key,
                 &raffle_account_address,
                 rent_amount,
                 data_len as u64,
                 program_id,
             ),
             &[initializer.clone(), raffle_pda.clone()],
             &[&[b"raffle", &raffle_no.to_le_bytes(), &[bump]]],
         )?;


        Ok(())
    }

    fn create_ata<'a>(
        payer:&AccountInfo<'a>,
        wallet_address:&AccountInfo<'a>,
        ata:&AccountInfo<'a>,
        mint:&AccountInfo<'a>,
        token_program:&AccountInfo<'a>,
        sysvar:&AccountInfo<'a>,
    )-> ProgramResult{

        msg!("{}",token_program.key.to_string());
        msg!("{}",mint.key.to_string());
        msg!("{}",ata.key.to_string());
        msg!("{}",payer.key.to_string());
        msg!("{}",wallet_address.key.to_string());
    
        let create_ata: solana_program::instruction::Instruction = create_associated_token_account(
            payer.key,
            wallet_address.key, 
            mint.key, 
            token_program.key);
                
        invoke(&create_ata,
              &[payer.clone(),
              ata.clone(),
              wallet_address.clone(),
              mint.clone(),
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
        transfer_fee_to_pool:  &Vec<u64>,
        reward_type_pda: &Pubkey,
        total_rewards: &mut u64,
        participation_fee_total: &mut u64,
        participation_fee: u64
    ) -> ProgramResult {

        let (reward_type_pda_address, _bump) = Pubkey::find_program_address(
            &[b"rewtype", &reward_type.no.to_le_bytes()],
            program_id,
        );

        if reward_type_pda != &reward_type_pda_address {
            return Err(InvalidRewardType.into());
        }


        *total_rewards = rewards.iter().try_fold(0u64, |acc, &x| acc.checked_add(x).ok_or(ArithmeticError))?;

        *participation_fee_total = transfer_fee_to_pool.iter().try_fold(0u64, |acc, &x| acc.checked_add(x).ok_or(ArithmeticError))?;

        *participation_fee_total = participation_fee_total.checked_add(participation_fee).ok_or(ArithmeticError)?;

        Ok(())
    }

    fn check_and_write_raffle_data<'a>(
        init_raffle:&InitRaffle,
        terms:&Term,
        reward_mint:[u8;32],
        participation_fee_mint:[u8;32],
        reward_decimals:u8,
        participation_fee_decimals:u8,
        raffle_no:u64,
        raffle_pda:&AccountInfo<'a>,
        initializer:&AccountInfo<'a>,
        program_id: &Pubkey

    )-> ProgramResult{


        let clock: Clock= Clock::get()?;
        let current_time: u64 = clock.unix_timestamp as u64;
        let maximum_time_allowed: u64  = current_time.checked_add(terms.expiration_time).ok_or(ArithmeticError)?;

        if init_raffle.raffle_time < current_time{return Err(InvalidRaffleTime.into());}//no raffle in the past allowed
        if init_raffle.raffle_time > maximum_time_allowed{return Err(InvalidRaffleTime.into());}//no raffle allowed in the far future
        if init_raffle.winner_count > terms.maximum_winner_count {return Err(InvalidWinnerNumber.into());}

        let n: usize = init_raffle.winner_count as usize;
        let winners: Vec<u64> = vec![0; n];

        if winners.len() != init_raffle.rewards.len() {return Err(InvalidWinnerNumber.into());}

        let (raffle_account_address, bump) = 
        Pubkey::find_program_address(&[b"raffle", &raffle_no.to_le_bytes()], program_id);

        msg!("{:?}",reward_mint);
        msg!("{}",init_raffle.is_increasing_pool);
        msg!("{}",init_raffle.requirement_to_participate);
        msg!("{:?}",reward_mint);
        msg!("{:?}",participation_fee_mint);
        msg!("{:?}",init_raffle.requirement_mint);

        if init_raffle.is_increasing_pool == 1 {
            if reward_mint != participation_fee_mint { return Err(InvalidMint.into());}
        }



        if init_raffle.requirement_to_participate == 1 {
            if init_raffle.requirement_mint == reward_mint{return Err(InvalidMint.into());}
            if init_raffle.requirement_mint == participation_fee_mint{return Err(InvalidMint.into());}
        }



        let data: Raffle = Raffle{
            raffle_state: 1,
            reward_decimals,
            initializer: initializer.key.to_bytes(),
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
            requirement_mint: init_raffle.requirement_mint,
            participation_fee_decimals,
            participation_fee_type: init_raffle.participation_fee_type,
            winners,
            winner_count:init_raffle.winner_count,
            current_winner_count: 0,
            number_of_entitled_winners: 0,
            bump,
            required_token_decimals: init_raffle.required_token_decimals,
            is_increasing_pool: init_raffle.is_increasing_pool,
            transfer_fee_to_pool: init_raffle.transfer_fee_to_pool.clone(),
            fee_collected: 0,
        };

        let mut serialized_data: Vec<u8> = Vec::new();
        data.serialize(&mut serialized_data)?;

        Self::create_raffle_pda(initializer, raffle_pda, program_id, &raffle_account_address,&raffle_no, serialized_data.len(),bump)?;

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
    
    fn check_mint_and_owner_and_amount(
        mint: &Pubkey,owner: &Pubkey,ata:&AccountInfo,amount:u64
    ) -> ProgramResult{

        let ata_unpacked: spl_token::state::Account = Account::unpack_from_slice(&ata.data.borrow())?;

        if mint != &ata_unpacked.mint {panic!()}
        if owner != &ata_unpacked.owner {panic!()}
        if amount > ata_unpacked.amount{panic!()}

        Ok(())

    }

    fn abort_raffle<'a>(
        initializer_ata:&AccountInfo<'a>,
        raffle_pda:&AccountInfo<'a>,
        raffle_ata:&AccountInfo<'a>,
        reward_mint:&AccountInfo<'a>,
        token_program:&AccountInfo<'a>,
        total_rewards: u64,
        raffle_no:u64,
        decimals:u8,
        bump:u8
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
        &[token_program.clone(),raffle_ata.clone(),reward_mint.clone(),initializer_ata.clone(),raffle_pda.clone()],
        &[&[b"raffle", &raffle_no.to_le_bytes(),&[bump]]]
        )?;

        Ok(())
    }

    fn transfer_tokens_from_raffle_pda<'a>(
        mint:&AccountInfo<'a>,
        raffle_ata:&AccountInfo<'a>,
        raffle_pda:&AccountInfo<'a>,
        destination_ata:&AccountInfo<'a>,
        token_program:&AccountInfo<'a>,
        decimals:u8,
        amount:u64,
        raffle_no:u64,
        bump:u8

    )-> ProgramResult{

        msg!("destination_ata ata {}",destination_ata.key.to_string());
        msg!("raffle ata {}",raffle_ata.key.to_string());
        msg!("mint  {}",mint.key.to_string());
        msg!("token_program  {}",token_program.key.to_string());



        let transfer_token_ix = spl_token::instruction::transfer_checked(
            &token_program.key,
            &raffle_ata.key, 
            &mint.key, 
            &destination_ata.key, 
            &raffle_pda.key, 
            &[],amount,decimals)?;

        invoke_signed(
        &transfer_token_ix, 
        &[token_program.clone(),raffle_ata.clone(),mint.clone(),destination_ata.clone(),raffle_pda.clone()],
        &[&[b"raffle", &raffle_no.to_le_bytes(), &[bump]]],
        )?;

        Ok(())
    }
    
    fn transfer_tokens_to_raffle_pda<'a>(
        mint:&AccountInfo<'a>,
        raffle_ata:&AccountInfo<'a>,
        owner:&AccountInfo<'a>,
        owner_ata:&AccountInfo<'a>,
        token_program:&AccountInfo<'a>,
        decimals:u8,
        amount:u64,

    )-> ProgramResult{

        msg!("owner ata {}",owner_ata.key.to_string());
        msg!("owner  {}",owner.key.to_string());
        msg!("raffle ata {}",raffle_ata.key.to_string());
        msg!("mint  {}",mint.key.to_string());
        msg!("token_program  {}",token_program.key.to_string());

        let transfer_token_ix = spl_token::instruction::transfer_checked(
            &token_program.key,
            &owner_ata.key, 
            &mint.key, 
            &raffle_ata.key, 
            &owner.key, 
            &[],amount,decimals)?;

        invoke(
        &transfer_token_ix, 
        &[token_program.clone(),raffle_ata.clone(),mint.clone(),owner_ata.clone(),owner.clone()],
        )?;

        Ok(())
    }
    


}


//cekilis kayit acik - 1
//cekilis yapildi  - 2
//kazanan yazildi - 3





