import { PublicKey } from "@solana/web3.js";
import { raffle_program } from "./accounts";
import { connection } from "./connection";
import { deserialize_fee_and_reward_type_account_data, deserialize_participation_account_data, deserialize_raffle_account_data, deserialize_term_account_data, numberToLEBytes8 } from "./utils";

import baseX from "base-x";
import { getMint } from "@solana/spl-token";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const bs58 = baseX(BASE58);


export const get_all_raffles = async() => {

    const account = await connection.getProgramAccounts(
        raffle_program,
        {
          filters: [
            {
              dataSize: 187,
            },
          ],
        }
      );
      
      deserialize_raffle_account_data(account[1].account)
}

export const get_all_active_raffles = async() => {

    const one = bs58.encode([1]);


    const account = await connection.getProgramAccounts(
        raffle_program,
        {
          filters: [
            {
              dataSize: 187,
            },
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
              dataSize: 187,
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

export const get_all_finalized_raffles_with_unpublished_winners = async() => {

    const two = bs58.encode([2]);


    const account = await connection.getProgramAccounts(
        raffle_program,
        {
          filters: [
            {
              dataSize: 187,
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

export const get_raffle_by_raffle_no = async(raffle_no:bigint) => {

    const le_bytes = numberToLEBytes8(raffle_no)

    console.log(le_bytes)

    const no = bs58.encode(le_bytes);


    const account = await connection.getProgramAccounts(
        raffle_program,
        {
          filters: [
            {
              dataSize: 187,
            },
            {
              memcmp: {
                offset: 129, 
                bytes: no,
              },
            },
    
          ],
        }
      );

    deserialize_raffle_account_data(account[0].account);
      
}

export const get_all_raffles_organized_by_this_address = async(initializer:PublicKey) => {

    const account = await connection.getProgramAccounts(
        raffle_program,
        {
          filters: [
            {
              dataSize: 187,
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

export const get_all_active_raffles_organized_by_this_address = async(initializer:PublicKey) => {

    const one = bs58.encode([1]);


    const account = await connection.getProgramAccounts(
        raffle_program,
        {
          filters: [
            {
              dataSize: 187,
            },
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
              dataSize: 187,
            },
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
              dataSize: 187,
            },
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
              dataSize: 48,
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

    const account = await connection.getProgramAccounts(
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

      console.log(account.length)

}

export const get_participation_account_by_raffle_no_and_winner_no = async(raffle_no:bigint,participant_no:bigint) => {

  const raffle_no_le_bytes = numberToLEBytes8(raffle_no)
  const participant_no_le_bytes = numberToLEBytes8(participant_no)

  const raffle = bs58.encode(raffle_no_le_bytes);
  const participant = bs58.encode(participant_no_le_bytes);


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
              bytes: participant,
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
    deserialize_participation_account_data(account[0].account)
    return account[0].pubkey;
}

export const get_raffle_counter = async() => {

    const counter_account = PublicKey.findProgramAddressSync([Buffer.from("counter")],raffle_program)[0]

    const account = await connection.getAccountInfo(counter_account)
    
}

export const get_token_program_and_decimals = async (token_mint:PublicKey) : Promise<PublicKey> => {
    
  const mint = await connection.getAccountInfo(token_mint);
  const token_program = mint?.owner!;
  const decimals = (await getMint(connection, token_mint, "confirmed", token_program)).decimals;


  return token_program;
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

