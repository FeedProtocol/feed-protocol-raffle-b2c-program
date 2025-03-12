import { Keypair, PublicKey, TransactionInstruction, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { raffle_program } from "./accounts";
import { connection } from "./connection";

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}


  export const init_config = async (authority:Keypair,
    authority_1:PublicKey,
    authority_2:PublicKey,
    authority_3:PublicKey,
  ) => {


    const config_account = PublicKey.findProgramAddressSync([Buffer.from("config")],raffle_program)
    console.log(config_account.toString())
  
    const ix = new TransactionInstruction({
      programId: raffle_program,
      keys: [
        { isSigner: true, isWritable: true, pubkey: authority.publicKey },
        { isSigner: false, isWritable: false, pubkey: authority_1 },
        { isSigner: false, isWritable: false, pubkey: authority_2 },
        { isSigner: false, isWritable: false, pubkey: authority_3 },
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

    return delay(600)
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

    return delay(600)

  }

  export const init_raffle_counter = async (authority:Keypair) => {
  
  

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

    return delay(600)

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

    return delay(600)

  }
