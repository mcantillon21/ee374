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

    // packet_builder = {"id": ["{{asdf}", ", asdf", ..]};

    id_counter

    discovered_peers

    connections = {}; 

    constructor(port = 18018) {
        this.server = new Net.Server();
        this.port = port;
        this.id_counter = 0;

        
        this.build_peers();
        this.initialize();
    }

    log(id, str) {
        console.log("[PEER #"+id+"] " + str);
    }

    build_peers() {
        const peer_str = fs.readFileSync('./peers.json', 'utf8'); //readFile('./file.json');
        this.discovered_peers = new Set(JSON.parse(peer_str));

        console.log("List of peers:");
        console.log(this.discovered_peers);
        
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

        this.log(id, "Got packets: ");
        this.log(id, JSON.stringify(packets));
        if (this.connections[id].buffer.length != 0) {
            this.log(id, "Buffer: " + this.connections[id].buffer);
        }
        

        return packets;
    }

    start() {

        this.server.listen(this.port, function() {
            console.log(`Marabu node started on port ${port}.`);
        });

        if (this.port != 18018) {
            this.connect_to_peer('144.202.103.247:18018', false, true);
        }
    }

    connect_to_network() {
        this.connect_to_peer("149.28.220.241:18018", true);
    }

    send(id, msg, callback=null) {
        if (this.connections[id].active) {
            console.log('sending');
            this.log(id, "Sent message: " + JSON.stringify(msg));
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

        
        this.log(id, "Processing packet " + JSON.stringify(msg));

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
                this.log(id, 'Received hello.');
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

                  this.log(id, "Got new peers: " + JSON.stringify(msg.peers));
                msg.peers.forEach(peer => this.discovered_peers.add(peer));
                this.write_peers();
                break;

        }
    }

    connect_to_peer(addr, get_peers, grader=false) {
        console.log('connecting to peer ' + addr);
        const idx = addr.lastIndexOf(':');
        const host = addr.slice(0, idx);
        const port = addr.slice(idx+1);

        let id = this.get_id();
        
        var self = this;
    
        console.log('connecting to peer on host ' + host + ' and port:' + port);
    
        // Create a new TCP client.
        const client = new Net.Socket();

        this.connections[id] = { 'socket': client, 'buffer': '', got_hello: false, active: true };

        // Send a connection request to the server.
        client.connect({ port: port, host: host }, function() {

            // If there is no error, the server has accepted the request and created a new 
            // socket dedicated to us.
            console.log('[CLIENT] TCP connection established with the server.');
    
            // The client can now send data to the server by writing to its socket.
            self.send(id, HELLO_MSG);
    
            if (get_peers) {
                self.send(id, GETPEERS_MSG);
            }

            if (grader) {
                self.send(id, GETPEERS_MSG);



                setTimeout(function() {
                    self.connections[id].socket.write("{\"type\":\"ge");
                    setTimeout(function() {
                        self.connections[id].socket.write("tpeers\"}");

                        setTimeout(function() {
                            self.send(id, {"type":"diufygeuybhv"});
                        }, 400);
                    }, 100);
                }, 1000);
            }
            
        });
        
    
        client.on('data', function(chunk) {
            console.log(`[CLIENT] Data received from the server: ${chunk.toString()}.`);
            let packets = self.build_packet(id, chunk);
            for (let packet_str of packets) {
                self.receive_packet(id, packet_str);
            }
        });

        // When the client requests to end the TCP connection with the server, the server
        // ends the connection.
        client.on('end', function() {
            self.log(id, 'Ended connection with the client');
            self.connections[id].active = false;
            self.connections[id].socket.destroy();
        });

        client.on('error', function(err) {
            self.log(id, `Error: ${err}`);
        });
    
    }
    

    initialize() {
        // When a client requests a connection with the server, the server creates a new
        // socket dedicated to that client.

        var self = this;
        this.server.on('connection', function(socket) {

            console.log('A new connection has been established.');

            let id = self.get_id();
            self.connections[id] = { 'socket': socket, 'buffer': '', got_hello: false, active: true  };

            
            self.send(id, HELLO_MSG);
            self.send(id, GETPEERS_MSG);

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
                self.log(id, 'Closing connection with the client');
                self.connections[id].active = false;
            });

            // Don't forget to catch error, for your own sake.
            socket.on('error', function(err) {
                self.log(id, `Error: ${err}`);
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