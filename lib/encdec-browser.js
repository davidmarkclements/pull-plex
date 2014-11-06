var string = require('./encdec-string')
var varint = require('varint')

module.exports = function(data, chan) {
  var chunk, viSize;
  if (typeof data === 'string') {
    return string.apply(0, arguments);
  }

  data = new Uint8Array(data.buffer || data);

  if (arguments.length > 1) {
      viSize = varint.encodingLength(chan);
      chunk = new Uint8Array(new ArrayBuffer(data.byteLength + viSize))
      varint.encode(chan, chunk)
      chunk.set(data, viSize)
      return chunk.buffer
  }
    
  return {
    chan: varint.decode(data),
    data: data.buffer.slice(varint.decode.bytes)
  }

}