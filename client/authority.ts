import { getAssociatedTokenAddressSync, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction, AccountMeta, SYSVAR_RENT_PUBKEY, SystemProgram, AccountInfo } from "@solana/web3.js";
import { entropy_account, raffle_program, rng_program, rng_program_fee_account } from "./accounts";
import { connection } from "./connection";
import { TermSchema, RewardFeeTypeSchema, Raffle, RaffleSchema, RewardFeeType, CallLimitSchema } from "./models";
import { numberToLEBytes8 } from "./utils";
import * as borsh from "borsh";
import { get_token_program_and_decimals,  get_participation_pda_by_raffle_no_and_winner_no } from "./get_info";

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

  export const set_config = async (
    authority:Keypair,
    authority_1:PublicKey,
    authority_2:PublicKey,
    authority_3:PublicKey,
    authority_4:PublicKey,
  ) => {
  
    const config_account = PublicKey.findProgramAddressSync([Buffer.from("config")],raffle_program)[0];

  
    const ix = new TransactionInstruction({
      programId: raffle_program,
      keys: [
        { isSigner: true, isWritable: false, pubkey: authority.publicKey },
        { isSigner: false, isWritable: false, pubkey: authority_1 },//1
        { isSigner: false, isWritable: false, pubkey: authority_2 },//2
        { isSigner: false, isWritable: false, pubkey: authority_3 },//3
        { isSigner: false, isWritable: false, pubkey: authority_4 },//4
        { isSigner: false, isWritable: true, pubkey: config_account },
      ],
      data: Buffer.from([8])
    });
  

    const message = new TransactionMessage({
      instructions: [ix],
      payerKey: authority.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash
    }).compileToV0Message();
  
    const tx = new VersionedTransaction(message);
    tx.sign([authority]);
  
    const sig = await connection.sendTransaction(tx);

    console.log(sig)
  
    return delay(600)
  }

  export const collect_fee = async (authority:Keypair) => {
  
    const fee_account = PublicKey.findProgramAddressSync([Buffer.from("fee_collector")], raffle_program)[0];
  
    const config_account = PublicKey.findProgramAddressSync([Buffer.from("config")],raffle_program)[0];

    const ix = new TransactionInstruction({
      programId: raffle_program,
      keys: [
        { isSigner: true, isWritable: true, pubkey: authority.publicKey },
        { isSigner: false, isWritable: true, pubkey: fee_account },
        { isSigner: false, isWritable: false, pubkey: config_account },
      ],
      data: Buffer.from([10])
    });
  
    const message = new TransactionMessage({
      instructions: [ix],
      payerKey: authority.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash
    }).compileToV0Message();
  
    const tx = new VersionedTransaction(message);
    tx.sign([authority]);
  
    const sig = await connection.sendTransaction(tx);
  
    return delay(600)
  }

  export const collect_fee_token = async (authority:Keypair,participation_fee_mint:PublicKey) => {


    const fee_collector = PublicKey.findProgramAddressSync([Buffer.from("fee_collector")], raffle_program)[0];
  
    const config_account = PublicKey.findProgramAddressSync([Buffer.from("config")],raffle_program)[0];

    const mint_account_info = await connection.getAccountInfo(participation_fee_mint);

    const token_program = mint_account_info!.owner;

    const authority_ata = getAssociatedTokenAddressSync(participation_fee_mint,authority.publicKey,false,token_program,ASSOCIATED_TOKEN_PROGRAM_ID)
    const fee_collector_ata = getAssociatedTokenAddressSync(participation_fee_mint,fee_collector,true,token_program,ASSOCIATED_TOKEN_PROGRAM_ID)

    const ix = new TransactionInstruction({
      programId: raffle_program,
      keys: [
        { isSigner: true, isWritable: true, pubkey: authority.publicKey },
        { isSigner: true, isWritable: true, pubkey: authority_ata },
        { isSigner: false, isWritable: true, pubkey: fee_collector },
        { isSigner: false, isWritable: true, pubkey: fee_collector_ata },
        { isSigner: false, isWritable: true, pubkey: token_program },
        { isSigner: false, isWritable: true, pubkey: participation_fee_mint },
        { isSigner: false, isWritable: false, pubkey: config_account },
      ],
      data: Buffer.from([20])
    });
  
    const message = new TransactionMessage({
      instructions: [ix],
      payerKey: authority.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash
    }).compileToV0Message();
  
    const tx = new VersionedTransaction(message);
    tx.sign([authority]);
  
    const sig = await connection.sendTransaction(tx);
  
    return delay(600)
  }

  export const update_terms = async (authority:Keypair, newFee:bigint, expirationTime:bigint,maximumWinnerCount:bigint) => {

    const initialized:number = 2;

    const term = {
      initialized: initialized, 
      fee_percent: newFee, 
      expiration_time: expirationTime, 
      maximum_winner_count: maximumWinnerCount, 
    }


    let encoded = borsh.serialize(TermSchema, term);
  
    const config_account = PublicKey.findProgramAddressSync([Buffer.from("config")],raffle_program)[0]

  
    let concated = Uint8Array.of(9, ...encoded);
  
    const term_account = PublicKey.findProgramAddressSync([Buffer.from("term")], raffle_program)[0];
  
    const ix = new TransactionInstruction({
      programId: raffle_program,
      keys: [
        { isSigner: true, isWritable: true, pubkey: authority.publicKey },
        { isSigner: false, isWritable: true, pubkey: term_account },
        { isSigner: false, isWritable: false, pubkey: config_account },
      ],
      data: Buffer.from(concated)
    });
  
    const message = new TransactionMessage({
      instructions: [ix],
      payerKey: authority.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash
    }).compileToV0Message();
  
    const tx = new VersionedTransaction(message);
    tx.sign([authority]);
  
    await connection.sendTransaction(tx);
  
    return delay(600)
  }

  export const close_participant_pda = async (authority:Keypair,accounts:PublicKey[]) => {
  
    const config_account = PublicKey.findProgramAddressSync([Buffer.from("config")],raffle_program)[0];
  
    const keys:AccountMeta[] = [];

    const authority_meta = { isSigner: true, isWritable: true, pubkey: authority.publicKey }
    const config_account_meta = { isSigner: false, isWritable: false, pubkey: config_account }

    keys.push(authority_meta)
    keys.push(config_account_meta)

    for (let index = 0; index < accounts.length; index++) {
      const element = accounts[index];
      const meta:AccountMeta = {isSigner:false, isWritable:true, pubkey:element}
      keys.push(meta)
    }

    const ix = new TransactionInstruction({
      programId: raffle_program,
      keys,
      data: Buffer.from([5])
    })


    const message = new TransactionMessage({
      instructions: [ix],
      payerKey: authority.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash
    }).compileToV0Message();
  
    const tx = new VersionedTransaction(message);
    tx.sign([authority]);
  
    const sig = await connection.sendTransaction(tx);
    return delay(600)
  
  }

  export const init_fee_type_account = async (authority:Keypair,participation_fee_mint:PublicKey,fee_type:bigint,decimals:number) => {


    const fee_collector_account = PublicKey.findProgramAddressSync([Buffer.from("fee_collector")], raffle_program)[0];

    const fee_type_bytes = numberToLEBytes8(fee_type)
    const fee_type_account = PublicKey.findProgramAddressSync([Buffer.from("feetype"),fee_type_bytes], raffle_program)[0];


    const config_account = PublicKey.findProgramAddressSync([Buffer.from("config")],raffle_program)[0]

    const mint_account_info = await connection.getAccountInfo(participation_fee_mint);

    const token_program = mint_account_info!.owner;

    const fee_collector_ata = getAssociatedTokenAddressSync(participation_fee_mint,fee_collector_account,true,token_program,ASSOCIATED_TOKEN_PROGRAM_ID)

    const feetypedata = {
      initialized:3,
      mint: participation_fee_mint.toBytes(),
      decimals: decimals,
      no: fee_type,
    }


    let encoded = borsh.serialize(RewardFeeTypeSchema, feetypedata);

    console.log(encoded.length)

    let concated = Uint8Array.of(35, ...encoded);

    const ix = new TransactionInstruction({
      programId: raffle_program,
      keys: [
        { isSigner: true, isWritable: true, pubkey: authority.publicKey },
        { isSigner: false, isWritable: true, pubkey: fee_type_account },
        { isSigner: false, isWritable: false, pubkey: fee_collector_account },
        { isSigner: false, isWritable: true, pubkey: fee_collector_ata },
        { isSigner: false, isWritable: false, pubkey: participation_fee_mint },
        { isSigner: false, isWritable: false, pubkey: token_program },
        { isSigner: false, isWritable: false, pubkey: SYSVAR_RENT_PUBKEY },
        { isSigner: false, isWritable: false, pubkey: config_account },
        { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
        { isSigner: false, isWritable: false, pubkey: ASSOCIATED_TOKEN_PROGRAM_ID },
      ],
      data: Buffer.from(concated)
    });

    const message = new TransactionMessage({
      instructions: [ix],
      payerKey: authority.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([authority]);

    await connection.sendTransaction(tx);

    return delay(600)

  }

  export const init_reward_type_account = async (authority:Keypair,participation_fee_mint:PublicKey,reward_type:bigint,decimals:number) => {


    const reward_type_bytes = numberToLEBytes8(reward_type)
    const reward_type_account = PublicKey.findProgramAddressSync([Buffer.from("rewtype"),reward_type_bytes], raffle_program)[0];

    const config_account = PublicKey.findProgramAddressSync([Buffer.from("config")],raffle_program)[0]


    const feetypedata = {
      initialized:2,
      mint: participation_fee_mint.toBytes(),
      decimals: decimals,
      no: reward_type,
    }

    let encoded = borsh.serialize(RewardFeeTypeSchema, feetypedata);

    let concated = Uint8Array.of(36, ...encoded);


    const ix = new TransactionInstruction({
      programId: raffle_program,
      keys: [
        { isSigner: true, isWritable: true, pubkey: authority.publicKey },
        { isSigner: false, isWritable: true, pubkey: reward_type_account },
        { isSigner: false, isWritable: false, pubkey: config_account },
        { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
      ],
      data: Buffer.from(concated)
    });

    const message = new TransactionMessage({
      instructions: [ix],
      payerKey: authority.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([authority]);

    await connection.sendTransaction(tx);

    return delay(600)

  }

  export const choose_winner = async (raffle_no:bigint,authority:Keypair,rngCallLimit:bigint) => {

   
    const le_bytes = numberToLEBytes8(raffle_no)
 
    const raffle_pda = PublicKey.findProgramAddressSync([Buffer.from("raffle"),le_bytes],raffle_program)[0];

    console.log(raffle_pda.toBase58())
 
    const config_account = PublicKey.findProgramAddressSync([Buffer.from("config")],raffle_program)[0];

    const keys:AccountMeta[] = [];

    const authority_meta = { isSigner: true, isWritable: true, pubkey: authority.publicKey };
    const raffle_pda_meta = { isSigner: false, isWritable: true, pubkey: raffle_pda };
    const entropy_account_meta = { isSigner: false, isWritable: true, pubkey: entropy_account};
    const rng_program_fee_account_meta = { isSigner: false, isWritable: true, pubkey: rng_program_fee_account };
    const rng_program_meta = { isSigner: false, isWritable: false, pubkey: rng_program };
    const system_program_meta = { isSigner: false, isWritable: false, pubkey: SystemProgram.programId };
    const config_account_meta = { isSigner: false, isWritable: false, pubkey: config_account };

    keys.push(authority_meta)
    keys.push(raffle_pda_meta)
    keys.push(entropy_account_meta)
    keys.push(rng_program_fee_account_meta)
    keys.push(rng_program_meta)
    keys.push(system_program_meta)
    keys.push(config_account_meta)

    const raffle_account_info = await connection.getAccountInfo(raffle_pda);

    const raffle = borsh.deserialize(RaffleSchema,raffle_account_info?.data!) as Raffle;

    if (raffle.current_number_of_participants == BigInt(0)){

        const initializer = new PublicKey(raffle.initializer);
        const reward_mint = new PublicKey(raffle.reward_mint);
        const [token_program,decimals] = await get_token_program_and_decimals(reward_mint)
        const initializer_ata = getAssociatedTokenAddressSync(reward_mint,initializer,false,token_program,ASSOCIATED_TOKEN_PROGRAM_ID)
        const raffle_ata = getAssociatedTokenAddressSync(reward_mint,raffle_pda,true,token_program,ASSOCIATED_TOKEN_PROGRAM_ID)


        const initializer_ata_meta = { isSigner: false, isWritable: true, pubkey: initializer_ata };
        const raffle_ata_meta = { isSigner: false, isWritable: true, pubkey: raffle_ata};
        const reward_mint_meta = { isSigner: false, isWritable: false, pubkey: reward_mint };
        const token_program_meta = { isSigner: false, isWritable: false, pubkey: token_program };

    
        keys.push(initializer_ata_meta)
        keys.push(raffle_ata_meta)
        keys.push(reward_mint_meta)
        keys.push(token_program_meta)

    }

    const limit ={
      limit:rngCallLimit
    }

    const encoded = borsh.serialize(CallLimitSchema,limit)

    let concated = Uint8Array.of(2, ...encoded);
   
     const ix = new TransactionInstruction({
       programId: raffle_program,
       keys,
       data: Buffer.from(concated)
     });
   
     const message = new TransactionMessage({
       instructions: [ix],
       payerKey: authority.publicKey,
       recentBlockhash: (await connection.getLatestBlockhash()).blockhash
     }).compileToV0Message();
   
     const tx = new VersionedTransaction(message);
     tx.sign([authority]);
 
     connection.sendTransaction(tx);

    return delay(600)

  }

  export const publish_winner = async (raffle_no:bigint,authority:Keypair) => {


    const le_bytes = numberToLEBytes8(raffle_no)

    const raffle_account = PublicKey.findProgramAddressSync([Buffer.from("raffle"),le_bytes],raffle_program)[0];

    const raffle_account_info = await connection.getAccountInfo(raffle_account);
 
    const raffle = borsh.deserialize(RaffleSchema,raffle_account_info?.data!) as Raffle;

    const keys:AccountMeta[] = [];

    const raffle_pda_meta = { isSigner: false, isWritable: true, pubkey: raffle_account }

    keys.push(raffle_pda_meta)

    for (let index = 0; index < raffle.winners.length; index++) {

        const winner_no = raffle.winners[index];

        const winner_no_bytes = numberToLEBytes8(winner_no);
        console.log("winnerNo = "+winner_no)

        if(raffle.multiple_participation_allowed == 1){
            console.log("if")
            const winner_pda = PublicKey.findProgramAddressSync([Buffer.from("raf"),le_bytes,Buffer.from("par"),winner_no_bytes],raffle_program)[0];
            console.log(winner_pda.toBase58())
            const winner_pda_meta = { isSigner: false, isWritable: true, pubkey: winner_pda };
            keys.push(winner_pda_meta)

        }else{
          console.log("else")
            const winner_pda = await get_participation_pda_by_raffle_no_and_winner_no(BigInt(raffle_no),BigInt(winner_no));
            console.log(winner_pda.toBase58())
            const winner_pda_meta = { isSigner: false, isWritable: true, pubkey: winner_pda };
            keys.push(winner_pda_meta)
        }

    }


     const ix = new TransactionInstruction({
       programId: raffle_program,
       keys,
       data: Buffer.from([3])
     });
   
     const message = new TransactionMessage({
       instructions: [ix],
       payerKey: authority.publicKey,
       recentBlockhash: (await connection.getLatestBlockhash()).blockhash
     }).compileToV0Message();
   
     const tx = new VersionedTransaction(message);
     tx.sign([authority]);
 
     await connection.sendTransaction(tx);
     
    return delay(600)

  }

