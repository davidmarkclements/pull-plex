var varint = require('varint');
var FILL = String.fromCharCode(128);

module.exports = function (data, chan) {
  if (arguments.length > 1)
    return varint.encode(chan).map(function (n) {
      return String.fromCharCode(n);
    }).join('') + data;

  var maxVarintLength = 0;
  while (++maxVarintLength && (data[maxVarintLength] === FILL));
  maxVarintLength += 8;

  return {
    chan: varint.decode(data
      .slice(0, maxVarintLength)
      .split('')
      .map(function (s) { return s.charCodeAt(0) })),
    data: data.slice(varint.decode.bytes)
  }
}