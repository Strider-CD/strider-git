
var expect = require('expect.js')
  , lib = require('../lib')

describe('lib functions', function () {
  describe('.sshUrl', function () {
    it('should preserve a full scp ssh url', function () {
      var url = 'git@git.git:git/git.git'
      expect(lib.sshUrl({url: url})[0]).to.equal(url)
    })

    it('should sshify a git url', function () {
      var url = 'git://one.com/two.git'
        , ssh = 'git@one.com:two.git'
      expect(lib.sshUrl({url: url})[0]).to.equal(ssh)
    })

    it('should preserve an ssh:// url', function () {
      var url = 'ssh://user@host.com:20/one/two.git'
      expect(lib.sshUrl({url: url})[0]).to.equal(url)
    })

    it('should preserve an ssh:// url with no port', function () {
      var url = 'ssh://user@host.com/one/two.git'
      expect(lib.sshUrl({url: url})[0]).to.equal(url)
    })
  })
})

