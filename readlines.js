'use strict';

var fs = require('fs');

function LineByLine(file, options) {
    options = options || {};

    if (!options.readChunk) {
        options.readChunk = 1024;
    }

    if (!options.newLineCharacter) {
        options.newLineCharacter = 0x0a; //linux line ending
    } else {
        options.newLineCharacter = options.newLineCharacter.charCodeAt(0);
    }

    if (typeof file === 'number') {
        this.fd = file;
    } else {
        this.fd = fs.openSync(file, 'r');
    }

    this.options = options;

    this.newLineCharacter = options.newLineCharacter;

    this.reset();
}

LineByLine.prototype._searchInBuffer = function(buffer, hexNeedle) {
    var found = -1;

    for (var i = buffer.length; i >= 0; i--) {
        var b_byte = buffer[i];
        if (b_byte === hexNeedle) {
            found = i;
            break;
        }
    }

    return found;
};

LineByLine.prototype.reset = function() {
    this.bufferData = null;
    this.bytesRead = 0;

    this.bufferPosition = 0;
    this.eofReached = false;

    this.line = '';

    this.linesCache = [];

    this.lastBytePosition = null;

    this.fdPosition = 0;

    this.lastEOL = 0

    this.lastNewLineBufferPosition = 0
};

LineByLine.prototype._extractLines = function(buffer) {
    var line;
    var lines = [];
    var bufferPosition = 0;

    this.lastNewLineBufferPosition = 0;
    while (true) {
        // For each element of the buffer
        var bufferPositionValue = buffer[bufferPosition++];

        // If element is EOL
        if (bufferPositionValue === this.newLineCharacter) {
            // Split
            line = buffer.slice(this.lastNewLineBufferPosition, bufferPosition);
            // Add the new line to the list
            lines.push(line);
            // Update the variable
            this.lastNewLineBufferPosition = bufferPosition;
        // End of buffer
        } else if (!bufferPositionValue) { 
            break;
        }
    }

    // Leftovers (if exists) are added to the lines 
    var leftovers = buffer.slice(this.lastNewLineBufferPosition, bufferPosition);
    if (leftovers.length) {
        lines.push(leftovers);
    }

    // Return the list of lines
    return lines;
};

LineByLine.prototype._readChunk = function(lineLeftovers) {
    // Allocate a buffer
    var bufferData = new Buffer(this.options.readChunk);

    var totalBytesRead = 0;

    // Read the file to the buffer
    var bytesRead = fs.readSync(this.fd, bufferData, 0, this.options.readChunk, this.fdPosition);
    var EOLpos = -1, bufpos=0;
    // Total read bytes are the previous ones + the bytes that have been just read
    totalBytesRead = totalBytesRead + bytesRead;

    // Position in the file is the current position + the bytes that have been just read
    this.fdPosition = this.fdPosition + bytesRead;

    var buffers = [];

    // Add the buffer to the list of buffers
    buffers.push(bufferData);

    while((EOLpos = this._searchInBuffer(buffers[buffers.length-1], this.options.newLineCharacter)) === -1) {
        //new line character doesn't exist in the readed data, so we must read
        //again
        var newBuffer = new Buffer(this.options.readChunk);

        // Read a new buffer and add it to the list of buffers updating the vars
        var bytesRead = fs.readSync(this.fd, newBuffer, 0, this.options.readChunk, this.fdPosition);
        totalBytesRead = totalBytesRead + bytesRead;

        this.fdPosition = this.fdPosition + bytesRead;

        buffers.push(newBuffer);
        bufpos++; //Increment the counter of buffers
    }

    //The last EOL was this.fdPosition - (length(Buffer) - EOLpos)
    this.lastEOL = this.fdPosition - (bytesRead - EOLpos)

    // Concat all the buffers to a big one
    bufferData = Buffer.concat(buffers);

    // If the read bytes are less than chunk size, EOF and trim the buffer
    if (bytesRead < this.options.readChunk) {
        this.eofReached = true;
        bufferData = bufferData.slice(0, totalBytesRead);
    }

    if (bytesRead) {
        this.linesCache = this._extractLines(bufferData);

        if (lineLeftovers) {
            this.linesCache[0] = Buffer.concat([lineLeftovers, this.linesCache[0]]);
        }
    }

    return totalBytesRead;
};

LineByLine.prototype.next = function() {
    var line = false;

    if (this.eofReached && this.linesCache.length === 0) {
        return line;
    }

    var bytesRead;

    if (!this.linesCache.length) {
        bytesRead = this._readChunk();
    }

    if (this.linesCache.length) {
        line = this.linesCache.shift();

        var lastLineCharacter = line[line.length-1];

        if (lastLineCharacter !== 0x0a) {
            bytesRead = this._readChunk(line);

            if (bytesRead) {
                line = this.linesCache.shift();
            }
        }
    }

    if (this.eofReached && this.linesCache.length === 0) {
        fs.closeSync(this.fd);
        this.fd = null;
    }

    if (line && line[line.length-1] === this.newLineCharacter) {
        line = line.slice(0, line.length-1);
    }

    return line;
};

module.exports = LineByLine;
