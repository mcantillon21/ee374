const winston = require("winston");
const Net = require('net');
const canonicalize = require('canonicalize');
const fs = require('fs');


// import { readFile } from 'fs/promises';


const HELLO_MSG = { "type": "hello", "version": "0.8.0", "agent": "passerine" };
const GETPEERS_MSG = { "type": "getpeers" };
const PEERS = ['144.202.103.247:18018'];

// var discovered_peers = ['149.28.220.241:18018', '149.28.204.235:18018', '139.162.130.195:18018'];
var data_received = "";

class MarabuNode {

    port;
    server;
    clients;
    logger;

    // packet_builder = {"id": ["{{asdf}", ", asdf", ..]};

    id_counter

    discovered_peers

    connections = {}; 

    constructor(port = 18018) {
        this.server = new Net.Server();
        this.port = port;
        this.id_counter = 0;

        let alignColorsAndTime = winston.format.combine(
            winston.format.colorize({
                all:true
            }),
            winston.format.label({
                label:'[LOGGER]'
            }),
            winston.format.timestamp({
                format:"YY-MM-DD HH:MM:SS"
            }),
            winston.format.printf(
                info => ` ${info.label}  ${info.timestamp}  ${info.level} : ${info.message}`
            )
        );

        this.logger = winston.createLogger({
            level: "debug",
            transports: [
                new (winston.transports.Console)({
                    level: 'debug',
                    handleExceptions: true,
                    colorize: true,
                    format: winston.format.combine(winston.format.colorize(), alignColorsAndTime)
                }),
                new (winston.transports.File)({
                    filename: 'app.log'
                })
            ],
        })
        
        this.build_peers();
        this.initialize();
    }


    log_str(id, str) { return `[Peer ${id} @ ${this.connections[id].addr}] ${str}`}
    error(id, str) { this.logger.error(this.log_str(id, str)); }
    warn(id, str)  { this.logger.warn( this.log_str(id, str)); }
    log(id, str) {   this.logger.info (this.log_str(id, str)); }
    debug(id, str) { this.logger.debug(this.log_str(id, str)); }

    build_peers() {
        const peer_str = fs.readFileSync('./peers.json', 'utf8'); //readFile('./file.json');
        this.discovered_peers = new Set(JSON.parse(peer_str));

        console.log("Have " + this.discovered_peers.size + " peers.");
        
    }

    write_peers() {
        const peer_str = JSON.stringify(Array.from(this.discovered_peers));
        fs.writeFileSync('./peers.json', peer_str);
    }
 
    
    isJsonString(str) {
        try {
            JSON.parse(str);
        } catch (e) {
            return false;
        }
        return true;
    }

    get_id() {
        this.id_counter += 1;
        return this.id_counter;
    }

    build_packet(id, chunk) {
        let chunk_str = chunk.toString();
        let packets = chunk_str.split("\n");

        // if has incomplete message
        if (this.connections[id].buffer.length != 0) {
            packets[0] = this.connections[id].buffer + packets[0];
        }

        // if last element incomplete
        if (!this.isJsonString(packets[packets.length - 1])) {
            this.connections[id].buffer = packets.pop();
        }

        this.debug(id, "Got packets: " + JSON.stringify(packets).slice(0, 60) + "...");
        if (this.connections[id].buffer.length != 0) {
            this.debug(id, "Buffer: " + this.connections[id].buffer);
        }
        

        return packets;
    }

    start() {

        this.server.listen(this.port, () => {
            this.logger.info(`Marabu node started on port ${port}.`);
        });

        if (this.port != 18018) {
            this.connect_to_peer('144.202.103.247:18018', false, true);
        }
    }

    connect_to_network() {
        this.connect_to_peer("149.28.220.241:18018", true);
        for (let peer of Array.from(this.discovered_peers).slice(0, 50)) {
            this.connect_to_peer(peer, true);
        }
        
        
    }

    send(id, msg, callback=null) {
        if (this.connections[id].active) {
            this.log(id, "SENT message of type " + msg.type);// + JSON.stringify(msg));
            this.connections[id].socket.write(canonicalize(msg)+'\n', callback);
        }
    }

    send_error(id, msg, callback=null) {
        let err = { "type": "error", "error": msg };
        this.send(id, err, callback);
    }

    send_peers(id, peers, callback=null) {
        let msg = { "type": "peers", "peers": peers};
        this.send(id, msg, callback);
    }

    close_socket(id) {
        this.connections[id].socket.end();
        this.connections[id].active = false;
    }

    receive_packet(id, packet_str) {
        // Make sure this packet is from an active connection
        if (!this.connections[id].active) {
            return;
        }

        if (!this.isJsonString(packet_str)) {
            this.send_error(id, 'Invalid packet format');
            return;
        }

        let msg = JSON.parse(packet_str);

        if (!msg.type) {
            this.send_error(id, 'Malformed message type.');
        }

        
        this.debug(id, "Processing packet " + JSON.stringify(msg).slice(0, 60) + "...");

        this.log(id, "RECEIVED message of type " + msg.type);
        if (!this.connections[id].got_hello) {
            if (msg.type != "hello") {
                this.send_error(id, 'Did not receive hello message first.');
                this.close_socket(id);
                // , function() {
                // });
                return;
            } else if (msg.version != HELLO_MSG.version) {
                this.send_error(id, 'Maribu node version is incorrect.');
                this.close_socket(id);
                return;
            } else {
                this.connections[id].got_hello = true;
            }
        }


        switch(msg.type) {
            case "getpeers":
                this.send_peers(id, Array.from(this.discovered_peers));
                break;
            case "peers":
                if (!Array.isArray(msg.peers)) {
                    this.send_error(id, "Malformed peers list");
                    break;
                }

                this.debug(id, "Got new peers: " + JSON.stringify(msg.peers).slice(0, 60) + "...");
                msg.peers.forEach(peer => this.discovered_peers.add(peer));
                this.write_peers();
                break;

        }
    }

    connect_handler(id) {
        let addr = JSON.stringify(this.connections[id].socket.address());
        this.log(id, 'New TCP connection established with ' + addr);

        // The client can now send data to the server by writing to its socket.
        this.send(id, HELLO_MSG);
        this.send(id, GETPEERS_MSG);

        // if (grader) {
        //     self.send(id, GETPEERS_MSG);



        //     setTimeout(function() {
        //         self.connections[id].socket.write("{\"type\":\"ge");
        //         setTimeout(function() {
        //             self.connections[id].socket.write("tpeers\"}");

        //             setTimeout(function() {
        //                 self.send(id, {"type":"diufygeuybhv"});
        //             }, 400);
        //         }, 100);
        //     }, 1000);
        // }

    }

    connect_to_peer(addr, get_peers, grader=false) {
        
        const idx = addr.lastIndexOf(':');
        const host = addr.slice(0, idx);
        const port = addr.slice(idx+1);

        let id = this.get_id();
        
        var self = this;
    
        const client = new Net.Socket();
        this.connections[id] = { 
            'socket': client, 
            'buffer': '', 
            got_hello: false, 
            active: true,
            addr: addr,
        };

        this.log(id,'connecting to peer ' + addr + ' (on host ' + host + ' and port:' + port + ')');
    
        // Create a new TCP client.
        

        
        
    
        client.on('data', function(chunk) {
            // console.log(`[CLIENT] Data received from the server: ${chunk.toString().slice(0, 60) + "..."}.`);
            let packets = self.build_packet(id, chunk);
            for (let packet_str of packets) {
                self.receive_packet(id, packet_str);
            }
        });

        // When the client requests to end the TCP connection with the server, the server
        // ends the connection.
        client.on('end', function() {
            self.warn(id, 'Ended connection with the client');
            self.connections[id].active = false;
            self.connections[id].socket.destroy();
        });

        client.on('error', function(err) {
            self.error(id, `Error: ${err}`);
        });

        // Send a connection request to the server.
        try {
            client.connect({ port: port, host: host }, () => { this.connect_handler(id) });
        } catch(err) {
            self.error(id, `Connection error: ${err}`);
        }
    
    }
    

    initialize() {
        // When a client requests a connection with the server, the server creates a new
        // socket dedicated to that client.

        var self = this;
        this.server.on('connection', function(socket) {

            console.log('A new connection has been established.');

            let id = self.get_id();
            self.connections[id] = { 'socket': socket, 'buffer': '', got_hello: false, active: true  };

            self.connect_handler(id);

            // The server can also receive data from the client by reading from its socket.
            socket.on('data', function(chunk) {
                let packets = self.build_packet(id, chunk);
                for (let packet_str of packets) {
                    self.receive_packet(id, packet_str);
                }
            });

            // When the client requests to end the TCP connection with the server, the server
            // ends the connection.
            socket.on('end', function() {
                self.warn(id, 'Closing connection with the client');
                self.connections[id].active = false;
            });

            // Don't forget to catch error, for your own sake.
            socket.on('error', function(err) {
                self.error(id, `Error: ${err}`);
            });
        });

    }
}



const args = process.argv;

var port = 18018;
if (args.length > 2) {
    port = Number(args[args.length-1]);
}

console.log(`Starting on port ${port}...`);

let node = new MarabuNode(port);
node.start();
node.connect_to_network();