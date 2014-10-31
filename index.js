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
      channels.slice(ix).forEach(function (s) {
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