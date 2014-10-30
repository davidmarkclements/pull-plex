var string = require('./encdec-string')

module.exports = function(data, chan) {
  if (typeof data === 'string') {
    return string.apply(0, arguments);
  }

  if (arguments.length > 1)
    return Buffer.concat([Buffer([chan]), data]);

  return {
    chan: data.readUInt8(0),
    data: data.slice(1, data.length)
  }

}