import {Buffer} from 'runtypes'
import {db} from './level'
import {logger} from './logger'
import {TextEncoder} from 'util'
import sha_256 from 'fast-sha256'
import {canonicalize} from 'json-canonicalize'


// Need to figure out  textEncoder
export function hash(obj: any) {
    const coder = new TextEncoder
    return Buffer.from(sha_256(coder.encode(canonicalize(obj)))).toString('hex')
}


export class objectList {
    objectMap: {[name: string]: string};

    async init() {
        try {
            this.objectMap = await db.get('objects')
            logger.debug()

        }
        catch {
            logger.info('Init DB')
            this.objectMap = {};
            await this.store()
        }
    }

    async store() {
        await db.put('objects', this.objectMap)
    }

    objectAdd(key: string, val: string) {
        logger.info(`adding` + key);
        this.objectMap[key]=val
        this.store()
        
        //add to map
    }
