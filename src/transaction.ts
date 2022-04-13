import * as ed from '@noble/ed25519'
import { canonicalize } from 'json-canonicalize';
import { ObjBlock, ObjCoinBase, ObjTransaction, ObjectofObject, ObjTransactionType} from './Object';
import { objectList } from './objList';


export async function validateTx(obj: ObjTransactionType){

    let inputBalance = 0;
    let outputBalance = 0;

    //for each input
    obj.inputs.forEach(input => {
        // for each input validate outpoint
        let outpointTX = objectList.getObj(input.outpoints.txid);
        if (!objectList.hasObj(input.outpoints.txid)) {
            throw new Error(`Outpoint with txid ${input.outpoints.txid} not found.`)
        }
        if (input.outpoints.index >= outpointTX.outputs.length()) {
            throw new Error(`Outpoint index should be less than outputs in ${JSON.stringify(outpointTX)}`)
        }

        //verify signature (use package)
        let publicKey = outpointTX.outputs[input.outpoints.index].pubkey
        let signature = input.sig
        let value = outpointTX.outputs[input.outpoints.index].value
        const isValid = await ed.verify(signature, message, publicKey); //where do I get message?
        if (!isValid){
            throw new Error(`Transaction was not verified using signature ${signature}, message ${message}, and public key ${publicKey}`)
        }

        inputBalance += value
    },

    //for each output    
    obj.outputs.forEach(output => {
        if (output.pubkey.length != 64){ //needs to be 64 chars
            throw new Error(`Output public key ${output.pubkey} must be 64 characters exactly.`)
        }
        if (output.value < 0){
            throw new Error(`Output values must be non-negative. `)
        }
        
        outputBalance += output.value
    },

    // Law of Conservation
    if (inputBalance < outputBalance){
        throw new Error(`Input must be at least equal or greater to Output value for ${JSON.stringify(obj)}`)
    }

    return true
}

export class Transaction {
    inputs;
    outputs;

    tx_validate() {


        // for each input
            // validate outpoint
        
            // verify signature

        // for each output
            // verify public key format and value >= 0
        
        // sum of all input values >= sum of all output values

        // if valid, store in obj database and gossip
        // else, send error message to node and don't gossip


        return debugger.contains(txid) && idx < num_outputs_in_outpoint
    }    

    tx_verify_sig() {
        (async () => {
            // keys, messages & other inputs can be Uint8Arrays or hex strings
            // Uint8Array.from([0xde, 0xad, 0xbe, 0xef]) === 'deadbeef'
            const privateKey = ed.utils.randomPrivateKey();
            const message = Uint8Array.from([0xab, 0xbc, 0xcd, 0xde]);
            const publicKey = await ed.getPublicKey(privateKey);
            const signature = await ed.sign(message, privateKey);
            const isValid = await ed.verify(signature, message, publicKey);
        })();
    }

    
}