(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
window.pull = require('pull-core')
window.plex = require('./index.js')
},{"./index.js":2,"pull-core":5}],2:[function(require,module,exports){
var pull = require('pull-core')
var encdec = require('./lib/encdec')

var devnull = pull.Sink(function(read) {
  read(0, function next(end) { read(end, next) })
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
    return function (end, cb) {
      if (end) {return;}
      read(0, function (end, data) {
        if (end) {return;}
        var decoded = encdec(data)
        var chan = decoded.chan
        
        if (!channels[chan]) {
          channels[chan] = recieverChannel()
        } 

        channels[chan].next(decoded.data)

        cb(end, data)
      })
    }
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

module.exports = function () {
  var channels = [];

  function plex(stream) {
    var ix = channels.length, channel;

    if (stream.type === 'Source') {
      stream = stream.pipe(demux(stream, channels));
      stream.demux = function () { return stream.pipe(devnull()); }
      return stream;
    }
    
    channel = mux(stream, ix).pipe(stream)
    channel.remove = function () {
      var ix = channel.index;
      channel.abort();
      channels.slice(ix, channels.length).forEach(function (s) {
        s.index -= 1;
      })
      channels.splice(ix, 1);
    }

    channels.push(channel)

    return channel;
  }

  plex.channels = channels;

  //TODO: - what if we don't want a receiverChannel
  // we want a sender channel which was neglected to
  // be set up
  plex.channel = function (chan) { 
    if (!channels[chan]) {
      channels[chan] = recieverChannel()
    }
    return channels[chan];
  }

  return plex;

}
},{"./lib/encdec":3,"pull-core":5}],3:[function(require,module,exports){
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
},{"./encdec-string":4}],4:[function(require,module,exports){
module.exports = function (data, chan) {
  if (arguments.length > 1)
    return String.fromCharCode(chan) + data;
  
  return {
    chan: data.charCodeAt(0),
    data: data.slice(1, data.length)
  }
}
},{}],5:[function(require,module,exports){
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


},{}]},{},[1])