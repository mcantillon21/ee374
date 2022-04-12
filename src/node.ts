const Net = require('net');
const fs = require('fs');

import { logger } from './logger'
import { Connection } from './connection'

export class MarabuNode {

    port;
    server;
    id_counter;
    discovered_peers;
    connections = {}; 

    constructor(port = 18018) {
        this.server = new Net.Server();
        this.port = port;
        this.id_counter = 0;
        
        this.build_peers();
        this.initialize();
    }

    get_id() {
        this.id_counter += 1;
        return this.id_counter;
    }

    build_peers() {
        const peer_str = fs.readFileSync('./peers.json', 'utf8');
        this.discovered_peers = new Set(JSON.parse(peer_str));

        console.log("Have " + this.discovered_peers.size + " peers.");
        
    }

    write_peers() {
        const peer_str = JSON.stringify(Array.from(this.discovered_peers));
        fs.writeFileSync('./peers.json', peer_str);
    }

    start() {

        this.server.listen(this.port, () => {
            logger.info(`Marabu node started on port ${this.port}.`);
        });

        if (this.port != 18018) {
            this.connect_to_peer('45.32.136.85:18018', false, true);
        }
        this.connect_to_peer("149.28.220.241:18018", true);
        for (let peer of Array.from(this.discovered_peers).slice(0, 1)) {
            this.connect_to_peer(peer, true);
        }
    }

    // When client requests connection to our node (acting as server)
    initialize() {
        this.server.on('connection', (socket) => {
            console.log('A new connection has been established.');
            let id = this.get_id();
            this.connections[id] = new Connection(this, id, socket, '', socket.address().address, true, false, true);
        });

    }

    // When our node (acting as client) requests connection to server
    connect_to_peer(addr, get_peers, grader=false) {
        let id = this.get_id();            
        const client = new Net.Socket();
        this.connections[id] = new Connection(this, id, client, '', addr, true, false, false);
    }
}