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