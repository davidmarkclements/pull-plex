var plex = require('../index.js');

demuxxing multiple channels

src = pull.Source(function (c, m) {
	  return function src(end, cb) {
	    if (end) { return cb(end); }
		cb(c > m || null, String.fromCharCode(100+(c%2)) + c++);
	  }
})
snk = pull.Sink(function (read, name) {
  read(null, function next(end, data) {
    if (end) { return }
    console.log(name, data)
    read(end, next)
  })
})
demuxxer = plex()
meow = demuxxer(src(10, 15))
demuxxer.channel(100).pipe(snk('blegh'))
demuxxer.channel(101).pipe(snk('blugh'))
meow.pipe(demuxxer.devnull())


asycn dual streaming same channel
src = pull.Source(function (c, m) {
	  return function src(end, cb) {
	    if (end) { return cb(end); }
        setTimeout(function () { 
     	  cb(c > m || null, 'd' + c++);
        }, Math.random())
	  }
})
snk = pull.Sink(function (read, name) {
  read(null, function next(end, data) {
    if (end) { return }
    console.log(name, data)
    read(end, next)
  })
})
demuxxer = plex()
meow = demuxxer(src(10, 15))
demuxxer.channel(100).pipe(snk('blegh'))
demuxxer.channel(100).pipe(snk('blugh'))
meow.pipe(demuxxer.devnull())



