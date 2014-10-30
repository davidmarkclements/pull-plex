var string = require('./encdec-string')

module.exports = function(data, chan) {
  var chunk;
  if (typeof data === 'string') {
    return string.apply(0, arguments);
  }

  data = data.buffer || data;

  if (arguments.length > 1) {
      chunk = new Uint8Array(new ArrayBuffer(data.byteLength + 1))
      chunk[0] = chan
      chunk.set(data, 1)
      return chunk
  }
    
  return {
    chan: (new Uint8Array(data, 0, 1))[0],
    data: data.slice(1)
  }

}