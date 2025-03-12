import { PublicKey } from "@solana/web3.js";
import { raffle_program } from "./accounts";
import { connection } from "./connection";
import { deserialize_config_account_data, deserialize_fee_and_reward_type_account_data, deserialize_participation_account_data, 
  deserialize_raffle_account_data, deserialize_term_account_data, numberToLEBytes8 } from "./utils";

import baseX from "base-x";
import { getMint } from "@solana/spl-token";
import { RewardFeeTypeSchema, RewardFeeType, CounterSchema, Counter } from "./models";

import * as borsh from "borsh";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const bs58 = baseX(BASE58);



export const get_all_active_raffles = async() => {

    const one = bs58.encode([1]);


    const account = await connection.getProgramAccounts(
        raffle_program,
        {
          filters: [

            {
              memcmp: {
                encoding:"base58",
                offset: 32, 
                bytes: one,
              },
            },
    
          ],
        }
      );

      console.log(account.length)
      
}

export const get_all_finalized_raffles = async() => {

    const three = bs58.encode([3]);


    const account = await connection.getProgramAccounts(
        raffle_program,
        {
          filters: [

            {
              memcmp: {
                offset: 32, 
                bytes: three,
              },
            },
    
          ],
        }
      );
      
}

export const get_all_finalized_raffles_with_unpublished_winners = async() => {

    const two = bs58.encode([2]);


    const account = await connection.getProgramAccounts(
        raffle_program,
        {
          filters: [

            {
              memcmp: {
                offset: 32, 
                bytes: two,
              },
            },
    
          ],
        }
      );
      
}

export const get_raffle_by_raffle_no = async(raffle_no:bigint) => {

    const le_bytes = numberToLEBytes8(raffle_no)

    console.log(le_bytes)

    const no = bs58.encode(le_bytes);


    const account = await connection.getProgramAccounts(
        raffle_program,
        {
          filters: [

            {
              memcmp: {
                offset: 99, 
                bytes: no,
              },
            },
    
          ],
        }
      );

    const raffle = deserialize_raffle_account_data(account[0].account);

    console.log("raffle no = " + raffle.raffle_no.toString())
    console.log("raffle state = " + raffle.raffle_state.toString())
    console.log("current_number_of_participants = " + raffle.current_number_of_participants.toString())
    console.log("participants_required = " + raffle.participants_required.toString())
    console.log("current_winner_count = " + raffle.current_winner_count.toString())
    console.log("winner_count = " + raffle.winner_count.toString())
    console.log("number_of_entitled_winners = " + raffle.number_of_entitled_winners.toString())
    console.log("participation_fee = " + raffle.participation_fee.toString())
    console.log("initializer = " + new PublicKey(raffle.initializer).toBase58())
    console.log("is_unlimited_participant_allowed = " +raffle.is_unlimited_participant_allowed)
    console.log("winners = " + raffle.winners.toString())
    console.log("rewards = " + raffle.rewards.toString())

    return raffle;
}

export const get_all_raffles_organized_by_this_address = async(initializer:PublicKey) => {

    const account = await connection.getProgramAccounts(
        raffle_program,
        {
          filters: [

            {
              memcmp: {
                offset: 0, 
                bytes: initializer.toString(),
              },
            },
    
          ],
        }
      );
      
}

export const get_all_active_raffles_organized_by_this_address = async(initializer:PublicKey) => {

    const one = bs58.encode([1]);


    const account = await connection.getProgramAccounts(
        raffle_program,
        {
          filters: [

            {
              memcmp: {
                offset: 0, 
                bytes: initializer.toString(),
              },
            },
            {
              memcmp: {
                offset: 32, 
                bytes: one,
              },
            },
    
          ],
        }
      );
      
}

export const get_all_finalized_raffles_organized_by_this_address = async(initializer:PublicKey) => {

    const three = bs58.encode([3]);


    const account = await connection.getProgramAccounts(
        raffle_program,
        {
          filters: [

            {
              memcmp: {
                offset: 0, 
                bytes: initializer.toString(),
              },
            },
            {
              memcmp: {
                offset: 32, 
                bytes: three,
              },
            },
    
          ],
        }
      );
      
}

export const get_all_finalized_raffles_organized_with_unpublished_winners_by_this_address = async(initializer:PublicKey) => {

    const two = bs58.encode([2]);


    const account = await connection.getProgramAccounts(
        raffle_program,
        {
          filters: [

            {
              memcmp: {
                offset: 0, 
                bytes: initializer.toString(),
              },
            },
            {
              memcmp: {
                offset: 32, 
                bytes: two,
              },
            },
    
          ],
        }
      );
      
}

export const get_all_participation_accounts_by_this_address = async(initializer:PublicKey) => {

    const account = await connection.getProgramAccounts(
        raffle_program,
        {
          filters: [
            {
              dataSize: 58,
            },
            {
              memcmp: {
                offset: 0, 
                bytes: initializer.toString(),
              },
            },
    
          ],
        }
      );

}

export const get_all_participation_accounts_by_raffle_no = async(raffle_no:bigint) => {

    const le_bytes = numberToLEBytes8(raffle_no)

    const no = bs58.encode(le_bytes);

    const publickeys:PublicKey[] = [];

    const accounts = await connection.getProgramAccounts(
        raffle_program,
        {
          filters: [
            {
              dataSize: 48,
            },
            {
              memcmp: {
                offset: 40, 
                bytes: no,
              },
            },
    
          ],
        }
      );

      console.log(accounts.length)

      for (let index = 0; index < accounts.length; index++) {
        publickeys.push(accounts[index].pubkey);
        
      }

    return publickeys;

}

export const get_participation_account_by_raffle_no_and_winner_no = async(raffle_no:bigint,participant_no:bigint) => {

  const raffle_no_le_bytes = numberToLEBytes8(raffle_no)
  const participant_no_le_bytes = numberToLEBytes8(participant_no)

  const raffle = bs58.encode(raffle_no_le_bytes);
  const participantNo = bs58.encode(participant_no_le_bytes);


  const account = await connection.getProgramAccounts(
      raffle_program,
      {
        filters: [
          {
            dataSize: 58,
          },
          {
            memcmp: {
              offset: 32, 
              bytes: participantNo,
            },
          },
          {
            memcmp: {
              offset: 40, 
              bytes: raffle,
            },
          },
  
        ],
      }
    );

    console.log(account.length)
    const participation = deserialize_participation_account_data(account[0].account)

    console.log("raffle no = " + participation.raffle_no.toString())
    console.log("participant no = " + participation.particpant_no.toString())
    console.log("entitled = " + participation.entitled.toString())
    console.log("index_in_winners = " + participation.index_in_winners.toString())
    console.log("prize claimed = " + participation.prize_claimed.toString())
    console.log("participant address = " + new PublicKey(participation.particpant_address).toBase58())

    return participation;
}

export const get_participation_pda_by_raffle_no_and_winner_no = async (raffle_no:bigint,participant_no:bigint) => {
  const raffle_no_le_bytes = numberToLEBytes8(raffle_no)
  const participant_no_le_bytes = numberToLEBytes8(participant_no)

  const raffle = bs58.encode(raffle_no_le_bytes);
  const participantNo = bs58.encode(participant_no_le_bytes);


  const account = await connection.getProgramAccounts(
      raffle_program,
      {
        filters: [
          {
            dataSize: 58,
          },
          {
            memcmp: {
              offset: 32, 
              bytes: participantNo,
            },
          },
          {
            memcmp: {
              offset: 40, 
              bytes: raffle,
            },
          },
  
        ],
      }
    );

    console.log(account.length)

    return account[0].pubkey;
}

export const get_raffle_counter = async() => {

    const counter_account = PublicKey.findProgramAddressSync([Buffer.from("counter")],raffle_program)[0]

    const account = await connection.getAccountInfo(counter_account)
    const counter = borsh.deserialize(CounterSchema,account?.data!) as Counter;

    console.log(counter.number_of_raffles)
    
}

export const get_token_program_and_decimals = async (token_mint:PublicKey) : Promise<[PublicKey,number]> => {
    
  const mint = await connection.getAccountInfo(token_mint);
  const token_program = mint?.owner!;
  console.log(token_program.toBase58())
  console.log(token_mint.toBase58())
  const decimals = (await getMint(connection, token_mint, "confirmed", token_program)).decimals;


  return [token_program,decimals];
}

export const get_terms = async() => {

  const counter_account = PublicKey.findProgramAddressSync([Buffer.from("terms")],raffle_program)[0]

  const account = await connection.getAccountInfo(new PublicKey("GJ2KiCHoCzfob27FpzGFUWT1goic6vm6bYEMonDpWdyE"));

  deserialize_term_account_data(account!)
  
}

export const get_participation_fee_mint = async(type_no:bigint) => {


  const le_bytes = numberToLEBytes8(type_no)

  const acc = PublicKey.findProgramAddressSync([Buffer.from("feetype"),le_bytes],raffle_program)[0]

  const account = await connection.getAccountInfo(acc);

  const account_data = deserialize_fee_and_reward_type_account_data(account!)
  
  return new PublicKey(account_data.mint);
}

export const get_all_reward_types = async () => {

  const two = bs58.encode([2]);


  const account = await connection.getProgramAccounts(
      raffle_program,
      {
        filters: [

          {
            dataSize:42
          },
          {
            memcmp: {
              offset: 0, 
              bytes: two,
            },
          },
  
        ],
      }
    );

    for (let index = 0; index < account.length; index++) {
      const element = account[index];

      
      const fee_type = borsh.deserialize(RewardFeeTypeSchema,element.account.data) as RewardFeeType;

      console.log(`no ${fee_type.no}`)
      console.log(`mint ${fee_type.mint}`)
      console.log(`decimals ${fee_type.decimals}`)
      console.log(`  `)
      
    }


    console.log(account.length)
  
}

export const get_all_fee_types = async () => {

  const two = bs58.encode([3]);


  const account = await connection.getProgramAccounts(
      raffle_program,
      {
        filters: [

          {
            dataSize:42
          },
          {
            memcmp: {
              offset: 0, 
              bytes: two,
            },
          },
  
        ],
      }
    );

    for (let index = 0; index < account.length; index++) {
      const element = account[index];

      
      const fee_type = borsh.deserialize(RewardFeeTypeSchema,element.account.data) as RewardFeeType;

      console.log(`no ${fee_type.no}`)
      console.log(`mint ${fee_type.mint}`)
      console.log(`decimals ${fee_type.decimals}`)
      console.log(`  `)
      
    }

    console.log(account.length)
  
}

export const get_reward_type_account = async (reward_type:bigint) => {
  const reward_type_bytes = numberToLEBytes8(reward_type)
  const reward_type_account = PublicKey.findProgramAddressSync([Buffer.from("rewtype"),reward_type_bytes], raffle_program)[0];

  const d  = await connection.getAccountInfo(reward_type_account);
  const a = borsh.deserialize(RewardFeeTypeSchema,d?.data!) as RewardFeeType;
  console.log(a.decimals);
}

export const get_fee_type_account = async (fee_type:bigint) => {
const reward_type_bytes = numberToLEBytes8(fee_type)
const reward_type_account = PublicKey.findProgramAddressSync([Buffer.from("feetype"),reward_type_bytes], raffle_program)[0];

const d  = await connection.getAccountInfo(reward_type_account);
const a = borsh.deserialize(RewardFeeTypeSchema,d?.data!) as RewardFeeType;
console.log(a.decimals);
}

export const get_config = async() => {

  const config_account = PublicKey.findProgramAddressSync([Buffer.from("config")],raffle_program)[0]

  const account = await connection.getAccountInfo(config_account);

  const config = deserialize_config_account_data(account!)

  console.log(new PublicKey(config.authority_1).toBase58())
  console.log(new PublicKey(config.authority_2).toBase58())
  console.log(new PublicKey(config.authority_3).toBase58())
  console.log(new PublicKey(config.authority_4).toBase58())
  
}

