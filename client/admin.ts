import {
    Keypair,
    PublicKey,
    TransactionMessage,
    VersionedTransaction,
    SystemProgram,
    TransactionInstruction,
    LAMPORTS_PER_SOL,
    AccountMeta,
    SYSVAR_RENT_PUBKEY,
  } from "@solana/web3.js";

  import * as borsh from "borsh";
  import { RewardFeeTypeSchema, Term, TermSchema,  } from "./models";
  import { connection} from './connection';
  import { raffle_program, } from "./accounts"
  import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
  import { numberToLEBytes8 } from "./utils";



  export const set_config = async (authority:Keypair) => {
  
    const config_account = PublicKey.findProgramAddressSync([Buffer.from("config")],raffle_program)[0];

  
    const ix = new TransactionInstruction({
      programId: raffle_program,
      keys: [
        { isSigner: true, isWritable: true, pubkey: authority.publicKey },
        { isSigner: false, isWritable: false, pubkey: authority.publicKey },//1
        { isSigner: false, isWritable: false, pubkey: authority.publicKey },//2
        { isSigner: false, isWritable: false, pubkey: authority.publicKey },//3
        { isSigner: false, isWritable: false, pubkey: authority.publicKey },//4
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
  
  }

  export const update_terms = async (authority:Keypair, new_fee:bigint, expiration_time:bigint,maximum_winner_count:bigint) => {

    const initialized:number = 2;

    const term = {
      initialized: initialized, 
      fee_percent: new_fee, 
      expiration_time: expiration_time, 
      maximum_winner_count: maximum_winner_count, 
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
  
  }

  export const init_config = async (authority:Keypair) => {


    const config_account = PublicKey.findProgramAddressSync([Buffer.from("config")],raffle_program)
    console.log(config_account.toString())
  
    const ix = new TransactionInstruction({
      programId: raffle_program,
      keys: [
        { isSigner: true, isWritable: true, pubkey: authority.publicKey },
        { isSigner: false, isWritable: false, pubkey: authority.publicKey  },
        { isSigner: false, isWritable: false, pubkey: authority.publicKey  },
        { isSigner: false, isWritable: false, pubkey: authority.publicKey  },
        { isSigner: false, isWritable: true, pubkey: config_account[0] },
        { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
      ],
      data: Buffer.from([7])
    });
  
    const message = new TransactionMessage({
      instructions: [ix],
      payerKey: authority.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash
    }).compileToV0Message();
  
    const tx = new VersionedTransaction(message);
    tx.sign([authority]);
  
    await connection.sendTransaction(tx);

  
  }

  export const init_term_account = async (authority:Keypair) => {


    const term_account = PublicKey.findProgramAddressSync([Buffer.from("term")], raffle_program)[0];

    console.log("term account = " + term_account);


    const config_account = PublicKey.findProgramAddressSync([Buffer.from("config")],raffle_program)[0]


    const ix = new TransactionInstruction({
      programId: raffle_program,
      keys: [
        { isSigner: true, isWritable: true, pubkey: authority.publicKey },
        { isSigner: false, isWritable: true, pubkey: term_account },
        { isSigner: false, isWritable: false, pubkey: config_account },
        { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
      ],
      data: Buffer.from([6])
    });

    const message = new TransactionMessage({
      instructions: [ix],
      payerKey: authority.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([authority]);

    await connection.sendTransaction(tx);

  }

  export const close_account = async (authority:Keypair,accounts_meta_array:AccountMeta[]) => {
  
    const config_account = PublicKey.findProgramAddressSync([Buffer.from("config")],raffle_program)[0];
  
    const keys:AccountMeta[] = [];

    const authority_meta = { isSigner: true, isWritable: true, pubkey: authority.publicKey }
    const config_account_meta = { isSigner: false, isWritable: false, pubkey: config_account }

    keys.push(authority_meta)
    keys.push(config_account_meta)

    for (let index = 0; index < accounts_meta_array.length; index++) {
      const element = accounts_meta_array[index];
      keys.push(element)
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
  
  }

  export const init_counter = async (authority:Keypair) => {
  
  

    const counter_account = PublicKey.findProgramAddressSync([Buffer.from("counter")],raffle_program)[0]
   
     const ix = new TransactionInstruction({
       programId: raffle_program,
       keys: [
         { isSigner: true, isWritable: true, pubkey: authority.publicKey },
         { isSigner: false, isWritable: true, pubkey: counter_account },
         { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
 
       ],
       data: Buffer.from([4])
     });
   
     const message = new TransactionMessage({
       instructions: [ix],
       payerKey: authority.publicKey,
       recentBlockhash: (await connection.getLatestBlockhash()).blockhash
     }).compileToV0Message();
   
     const tx = new VersionedTransaction(message);
     tx.sign([authority]);
 
     connection.sendTransaction(tx);

     console.log(counter_account.toBase58())
  }

  export const init_fee_collector_account = async (authority:Keypair) => {


    const fee_collector_account = PublicKey.findProgramAddressSync([Buffer.from("fee_collector")], raffle_program)[0];


    const config_account = PublicKey.findProgramAddressSync([Buffer.from("config")],raffle_program)[0]


    const ix = new TransactionInstruction({
      programId: raffle_program,
      keys: [
        { isSigner: true, isWritable: true, pubkey: authority.publicKey },
        { isSigner: false, isWritable: true, pubkey: fee_collector_account },
        { isSigner: false, isWritable: false, pubkey: config_account },
        { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
      ],
      data: Buffer.from([40])
    });

    const message = new TransactionMessage({
      instructions: [ix],
      payerKey: authority.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([authority]);

    await connection.sendTransaction(tx);

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
      mint: participation_fee_mint.toBytes(),
      decimals: decimals,
      no: fee_type,
    }

    let encoded = borsh.serialize(RewardFeeTypeSchema, feetypedata);

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

  }

  export const init_reward_type_account = async (authority:Keypair,participation_fee_mint:PublicKey,reward_type:bigint,decimals:number) => {


    const reward_type_bytes = numberToLEBytes8(reward_type)
    const reward_type_account = PublicKey.findProgramAddressSync([Buffer.from("rewtype"),reward_type_bytes], raffle_program)[0];

    const config_account = PublicKey.findProgramAddressSync([Buffer.from("config")],raffle_program)[0]


    const feetypedata = {
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

  }