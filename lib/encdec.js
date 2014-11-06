var string = require('./encdec-string')
var varint = require('varint');

module.exports = function(data, chan) {
  if (typeof data === 'string' || typeof data === 'number') {
    return string.apply(0, arguments);
  }
  if (arguments.length > 1) 
    return Buffer.concat([
      varint.encode(chan, Buffer(varint.encodingLength(chan))),
    data]);

  return {
    chan: varint.decode(data),
    data: data.slice(varint.decode.bytes)
  }

}