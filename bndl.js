(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
window.pull = require('pull-core')
window.plex = require('./index.js')

},{"./index.js":2,"pull-core":5}],2:[function(require,module,exports){
var pull = require('pull-core')
var encdec = require('./lib/encdec')
var devnull = pull.Sink(function(read) {
  read(0, function next(end) { 
    if (end) {return}
    read(end, next) 
  })
})

function mux(stream, index) {
  var aborted;
  var through = pull.Through(function (read) {
    return function (end, cb) {
      if (end) {return;}
      read(0, function (end, data) {
        if (end) {return;}
        cb(aborted || end, encdec(data, index))
      })
    }
  })()

  through.abort = function () { aborted = true; }

  return through;
}

function demux(stream, channels) {
  return pull.Through(function (read) {
    function dmux(end, cb) {
      if (end) {return;}
      read(0, function (end, data) {
        if (end) {return;}
        var decoded = encdec(data)
        var chan = decoded.chan
        channels[chan] = dmux.channel(chan) 
        channels[chan].next(decoded.data)
        cb(end, data)
      })
    }

    dmux.channels = channels;
    dmux.channel =  function (chan) {
      return channels[chan] || 
        (channels[chan] = recieverChannel())
    }



    return dmux;
  })()
}

function recieverChannel() {
  var aborted, cbs = [];
  
  var channel = pull.Source(function () {
      return function (end, cb) {
        if (end) { return; }
        if (~cbs.indexOf(cb)) { return; }
        cbs.push(cb);
      }
  })()

  channel.abort = function () { aborted = true; }
  channel.next = function (data) {
    cbs.forEach(function (cb) {
      cb(aborted, data)
    });
  }

  return channel
}

function remover(channel, channels) {
  return function () {
      var ix = channel.index;
      channel.abort();
      channels.slice(ix).forEach(function (s) {
        s.index -= 1;
      })
      channels.splice(ix, 1);
    }
}

module.exports = function () {
  var channels = [], demuxxing = [];


  function plex(stream) {
    var ix, channel;

    if (stream.type === 'Source') {
      stream = stream.pipe(demux(stream, demuxxing));
      stream.demux = function () { 
        return stream.pipe(devnull()); 
      }
      return stream;
    }
    ix = channels.length
    channel = mux(stream, ix).pipe(stream)
    channel.remove = remover(channel, channels)

    channels.push(channel)

    return channel;
  }

  plex.channels = channels;

  plex.channel = function (chan) { 
    return channels[chan];
  }

  return plex;

}
},{"./lib/encdec":3,"pull-core":5}],3:[function(require,module,exports){
var string = require('./encdec-string')
var varint = require('varint')

module.exports = function(data, chan) {
  var chunk, viSize;
  if (typeof data === 'string') {
    return string.apply(0, arguments);
  }

  data = data.buffer || data;

  if (arguments.length > 1) {
      viSize = varint.encodingLength(chan);
      chunk = new Uint8Array(new ArrayBuffer(data.byteLength + viSize))
      varint.encode(chan, chunk)
      chunk.set(data, viSize)
      return chunk.buffer
  }
    
  return {
    chan: varint.decode(new Uint8Array(data)),
    data: data.slice(varint.decode.bytes)
  }

}
},{"./encdec-string":4,"varint":8}],4:[function(require,module,exports){
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
},{"varint":8}],5:[function(require,module,exports){
exports.id = 
function (item) {
  return item
}

exports.prop = 
function (map) {  
  if('string' == typeof map) {
    var key = map
    return function (data) { return data[key] }
  }
  return map
}

exports.tester = function (test) {
  if(!test) return exports.id
  if('object' === typeof test
    && 'function' === typeof test.test)
      return test.test.bind(test)
  return exports.prop(test) || exports.id
}

exports.addPipe = addPipe

function addPipe(read) {
  if('function' !== typeof read)
    return read

  read.pipe = read.pipe || function (reader) {
    if('function' != typeof reader)
      throw new Error('must pipe to reader')
    return addPipe(reader(read))
  }
  read.type = 'Source'
  return read
}

var Source =
exports.Source =
function Source (createRead) {
  function s() {
    var args = [].slice.call(arguments)
    return addPipe(createRead.apply(null, args))
  }
  s.type = 'Source'
  return s
}


var Through =
exports.Through = 
function (createRead) {
  return function () {
    var args = [].slice.call(arguments)
    var piped = []
    function reader (read) {
      args.unshift(read)
      read = createRead.apply(null, args)
      while(piped.length)
        read = piped.shift()(read)
      return read
      //pipeing to from this reader should compose...
    }
    reader.pipe = function (read) {
      piped.push(read) 
      if(read.type === 'Source')
        throw new Error('cannot pipe ' + reader.type + ' to Source')
      reader.type = read.type === 'Sink' ? 'Sink' : 'Through'
      return reader
    }
    reader.type = 'Through'
    return reader
  }
}

var Sink =
exports.Sink = 
function Sink(createReader) {
  return function () {
    var args = [].slice.call(arguments)
    if(!createReader)
      throw new Error('must be createReader function')
    function s (read) {
      args.unshift(read)
      return createReader.apply(null, args)
    }
    s.type = 'Sink'
    return s
  }
}


exports.maybeSink = 
exports.maybeDrain = 
function (createSink, cb) {
  if(!cb)
    return Through(function (read) {
      var ended
      return function (close, cb) {
        if(close) return read(close, cb)
        if(ended) return cb(ended)

        createSink(function (err, data) {
          ended = err || true
          if(!err) cb(null, data)
          else     cb(ended)
        }) (read)
      }
    })()

  return Sink(function (read) {
    return createSink(cb) (read)
  })()
}


},{}],6:[function(require,module,exports){
module.exports = read

var MSB = 0x80
  , REST = 0x7F

function read(buf, offset) {
  var res    = 0
    , offset = offset || 0
    , shift  = 0
    , counter = offset
    , b
    , l = buf.length
  
  do {
    if(counter >= l) {
      read.bytesRead = 0
      return undefined
    }
    b = buf[counter++]
    res += shift < 28
      ? (b & REST) << shift
      : (b & REST) * Math.pow(2, shift)
    shift += 7
  } while (b >= MSB)
  
  read.bytes = counter - offset
  
  return res
}

},{}],7:[function(require,module,exports){
module.exports = encode

var MSB = 0x80
  , REST = 0x7F
  , MSBALL = ~REST
  , INT = Math.pow(2, 31)

function encode(num, out, offset) {
  out = out || []
  offset = offset || 0
  var oldOffset = offset

  while(num >= INT) {
    out[offset++] = (num & 0xFF) | MSB
    num /= 128
  }
  while(num & MSBALL) {
    out[offset++] = (num & 0xFF) | MSB
    num >>>= 7
  }
  out[offset] = num | 0
  
  encode.bytes = offset - oldOffset + 1
  
  return out
}

},{}],8:[function(require,module,exports){
module.exports = {
    encode: require('./encode.js')
  , decode: require('./decode.js')
  , encodingLength: require('./length.js')
}

},{"./decode.js":6,"./encode.js":7,"./length.js":9}],9:[function(require,module,exports){

var N1 = Math.pow(2,  7)
var N2 = Math.pow(2, 14)
var N3 = Math.pow(2, 21)
var N4 = Math.pow(2, 28)
var N5 = Math.pow(2, 35)
var N6 = Math.pow(2, 42)
var N7 = Math.pow(2, 49)

module.exports = function (value) {
  return (
    value < N1 ? 1
  : value < N2 ? 2
  : value < N3 ? 3
  : value < N4 ? 4
  : value < N5 ? 5
  : value < N6 ? 6
  : value < N7 ? 7
  :              8
  )
}

},{}]},{},[1])