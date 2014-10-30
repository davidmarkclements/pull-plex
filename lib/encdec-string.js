module.exports = function (data, chan) {
  if (arguments.length > 1)
    return String.fromCharCode(chan) + data;
  
  return {
    chan: data.charCodeAt(0),
    data: data.slice(1, data.length)
  }
}