import { MarabuNode } from './node'

const args = process.argv;

var port = 18018;
if (args.length > 2) {
    port = Number(args[args.length-1]);
}

console.log(`Starting on port ${port}...`);

let node = new MarabuNode(port);
node.start();