import {Literal, Record, String, Array, Union, Static, Number} from 


export const ObjBlock = Record({
    type: Literal('block'),
    txids: Array(String),
    previousID: String,
    create: String,
    T: String
})


export type ObjBlockType = static<typeof ObjBlock>

export const ObjCoinBase = Record({
    type: Literal('transaction'),
    height: Number,
    outputs: Array(Record({
        publicKey: String,
        value: Number
    }))
})

export type ObjCoinbaseType = Static<typeof ObjCoinBase>

export const ObjTransaction = Record({
    type: Literal('transaction'),
    inputs: Array(Record({
        outpoints: Record({
            txid: String,
            index: Number
        }),
        sig: String.nullable(),
    })),
    outputs: Array(Record({
        pubkey: String,
        value: Number
    }))
})

export type ObjTransactionType = Static<typeof ObjTransaction>


export const ObjectofObject = Union(ObjBlock, ObjCoinBase, ObjTransaction)
export type ObjType = Static<typeof ObjectofObject>


