var lineByLine = require('./readlines.js');

var assert = require('assert');

var filename = __dirname + '/dummy_files/testLastEOL.txt';
var liner = new lineByLine(filename, {readChunk: 5});

liner.fdPosition = 0
var line = null
while(line=liner.next()) {
	console.log(line.toString())
}

console.log(liner.lastEOL)