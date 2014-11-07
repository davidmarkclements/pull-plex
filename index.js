var pull = require('pull-core')
var encdec = require('./lib/encdec')
var devnull = pull.Sink(function(read) {
  read(0, function next(end, d) {
    // console.log('pp', d) 
    if (end) {return}
    read(end, next) 
  })
})

var recieverChannel = pull.Source(function () {
  var aborted, cbs = [];
  function channel (end, cb) {
    if (end) { return; }
    if (~cbs.indexOf(cb)) { return; }
    cbs.push(cb);
  }
  channel.abort = function () { aborted = true; }
  channel.next = function (data) {
    cbs.forEach(function (cb) {
      cb(aborted, data)
    });
  }
  return channel;
})

var mux = pull.Through(function (read, stream, index) {
  var aborted;
  function through(end, cb) {
    if (end) {return;}
    read(0, function (end, data) {
      if (end) {return;}
      cb(aborted || end, encdec(data, index))
    })
  }
  through.abort = function () { aborted = true; }
  return through
})

var demux = pull.Through(function (read, stream, channels, offset) {
  function coax(end, cb) {
    if (end) {return;}
    read(0, function (end, data) {
      if (end) {return;}
      var decoded = encdec(data)
      var chan = decoded.chan
      chan -= offset.by;
      channels[chan] = coax.channel(chan) 
      channels[chan].next(decoded.data)
      cb(end, data)
    })
  }

  coax.channels = channels;
  coax.channel =  function (chan) {
    chan += offset.by;
    return channels[chan] || 
      (channels[chan] = recieverChannel())
  }

  return coax;
})

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

module.exports = function plex() {
  var channels = [], demuxxing = [];

  function multi(stream) {
    var ix, channel;

    if (stream.type === 'Source') {
      stream = stream.pipe(demux(stream, demuxxing, offset));
      stream.demux = function demux() { 
        return (demux.ed = demux.ed || stream.pipe(devnull())); 
      }
      return stream;
    }
    ix = channels.length
    channel = mux(stream, ix).pipe(stream)
    channel.remove = remover(channel, channels)

    channels.push(channel)

    return channel;
  }

  multi.channels = channels;

  multi.channel = function (chan) { 
    return channels[chan + offset.by];
  }

  multi.offset = offset

  offset.by = 0
  function offset(n) {
    offset.by = n;
  }


  return multi;

}