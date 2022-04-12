const canonicalize = require('canonicalize');

import { logger } from './logger'
import { isJsonString } from './utilities'
import { Messages } from './messages'

export class Connection {

    node;
    id;
    active;
    socket;
    buffer;
    got_hello;
    address;
    is_server;

    constructor(node, id, socket, buffer, address, active, got_hello = false, is_server = true) {
        this.node = node;
        this.id = id;
        this.socket = socket;
        this.buffer = buffer;
        this.address = address;
        this.active = active;
        this.got_hello = got_hello;
        this.is_server = is_server;

        const idx = address.lastIndexOf(':');
        const host = address.slice(0, idx);
        const port = address.slice(idx+1);

        if (this.is_server) {
            this.connect_handler(is_server);
        } else {
            // Send a connection request to the server.
            try {
                this.socket.connect({ port: port, host: host }, () => { this.connect_handler(is_server) });
            } catch(err) {
                this.error(`Connection error: ${err}`);
            }
        }

        // The server can also receive data from the client by reading from its socket.
        socket.on('data', (chunk) => {
            let packets = this.build_packet(chunk);
            for (let packet_str of packets) {
                this.process_packet(packet_str);
            }
        });

        // When the client requests to end the TCP connection with the server, the server
        // ends the connection.
        socket.on('end', function() {
            this.warn('Closing connection with the client');
            this.active = false;
        });

        // Don't forget to catch error, for your own sake.
        socket.on('error', function(err) {
            this.error(`Error: ${err}`);
        });
    }

    log_str(str) { return `[Peer ${this.id} @ ${this.address}] ${str}`}
    error(str) { logger.error(this.log_str(str)); }
    warn(str)  { logger.warn( this.log_str(str)); }
    log(str) {   logger.info (this.log_str(str)); }
    debug(str) { logger.debug(this.log_str(str)); }

    connect_handler(incoming) {
        let addr = JSON.stringify(this.address);
        this.log(`New ${incoming ? 'incoming' : 'outgoing'} TCP connection established with ` + addr);

        // The client can now send data to the server by writing to its socket.
        this.send(Messages.HELLO);
        this.send(Messages.GETPEERS);
    }

    send(msg, callback=null) {
        if (this.active) {
            if (msg.type == 'error') {
                this.warn("SENT error: " + JSON.stringify(msg));
            } else {
                this.log("SENT message of type " + msg.type);// + JSON.stringify(msg));

            }
            this.socket.write(canonicalize(msg)+'\n', callback);
        }
    }

    send_error(msg, callback=null) {
        let err = { "type": "error", "error": msg };
        this.send(err, callback);
    }

    send_peers(peers, callback=null) {
        let msg = { "type": "peers", "peers": peers};
        this.send(msg, callback);
    }

    close_socket() {
        this.socket.end();
        this.active = false;
    }

    build_packet(chunk) {
        let chunk_str = chunk.toString();
        let packets = chunk_str.split("\n");

        // if has incomplete message
        if (this.buffer.length != 0) {
            packets[0] = this.buffer + packets[0];
        }

        // if last element incomplete
        let json_valid = isJsonString(packets[packets.length - 1])
        if (json_valid == 'partial') {
            this.buffer = packets.pop();
        }

        this.debug("Got packets: " + JSON.stringify(packets).slice(0, 60) + "...");
        if (this.buffer.length != 0) {
            this.debug("Buffer: " + this.buffer.slice(0, 30) + "..." + this.buffer.slice(this.buffer.length-30));
        }
        

        return packets;
    }

    process_packet(packet_str) {
        // Make sure this packet is from an active connection
        if (!this.active) {
            return;
        }

        if (!isJsonString(packet_str)) {
            this.send_error('Invalid packet format');
            return;
        }

        let msg = JSON.parse(packet_str);

        if (!msg.type) {
            this.send_error('Malformed message type.');
        }

        
        this.debug("Processing packet " + JSON.stringify(msg).slice(0, 60) + "...");

        this.log("RECEIVED message of type " + msg.type);
        if (!this.got_hello) {
            if (msg.type != "hello") {
                this.send_error('Did not receive hello message first.');
                this.close_socket();
                return;
            } else if (msg.version != Messages.HELLO.version) {
                this.send_error('Maribu node version is incorrect.');
                this.close_socket();
                return;
            } else {
                this.got_hello = true;
            }
        }


        switch(msg.type) {
            case "getpeers":
                this.send_peers(Array.from(this.node.discovered_peers));
                break;
            case "peers":
                if (!Array.isArray(msg.peers)) {
                    this.send_error("Malformed peers list");
                    break;
                }

                this.debug("Got new peers: " + JSON.stringify(msg.peers).slice(0, 60) + "...");
                msg.peers.forEach(peer => this.node.discovered_peers.add(peer));
                this.node.write_peers();
                break;

        }
    }

}