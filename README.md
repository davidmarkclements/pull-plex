demux:
var plex = require('pull-plex')
var multi = plex();
var coaxial = multi(src: pull.Source) => demuxxer: pull.Through

coaxial.channel(0).pipe(snk: pull.Sink)
coaxial.channel(1).pipe(snk: pull.Sink)
coaxial.channel(2).pipe(snk: pull.Sink)

coaxial.demux(); //trigger channel pipes

mux:
var plex = require('pull-plex')
var multi = plex()
multi(snk1: pull.Sink)
multi(snk2: pull.Sink)
multi(snk3: pull.Sink)
src1.pipe(multi.channel(0));
src2.pipe(multi.channel(1));
src3.pipe(multi.channel(2));

var channel4 = multi(snk1: pull.Sink)
src4.pipe(channel4)
src5.pipe(multi(snk2: pull.Sink))

multi.channels.length // 5
