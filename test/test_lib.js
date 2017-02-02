'use strict';

var expect = require('expect.js');
var lib = require('../lib');

describe('lib functions', function () {
  describe('.sshUrl', function () {
    it('should preserve a full scp ssh url', function () {
      var url = 'git@git.git:git/git.git';
      var resultUrl = 'git@git.git:git/git.git';
      expect(lib.sshUrl({url: url})[0]).to.equal(resultUrl);
    });

    it('should sshify a git url', function () {
      var url = 'git://one.com/two.git';
      var ssh = 'git@one.com:two.git';
      expect(lib.sshUrl({url: url})[0]).to.equal(ssh);
    });

    it('should preserve an ssh:// url', function () {
      var url = 'ssh://user@host.com:20/one/two.git';
      expect(lib.sshUrl({url: url})[0]).to.equal(url);
    });

    it('should preserve an ssh:// url with no port', function () {
      var url = 'ssh://user@host.com/one/two.git';
      expect(lib.sshUrl({url: url})[0]).to.equal(url);
    });

  });

  describe('.httpUrl', function () {
    it('should preserve an http(s):// url', function () {
      var url = 'https://foo%40bar.com:foopassword@githost.com/one/two.git'
      var config = {
        url: 'https://githost.com/one/two.git',
        auth: {
          type: 'https',
          username: 'foo@bar.com',
          password: 'foopassword'
        }
      };

      expect(lib.httpUrl(config)[0]).to.equal(url);
    });

    it('should encode username to URI format', function () {
      var config = {
        url: 'https://githost.com/one/two.git',
        auth: {
          type: 'https',
          username: 'foo@bar.com',
          password: 'foopassword'
        }
      };
      expect(lib.httpUrl(config)[0]).to.contain(encodeURIComponent('foo@bar.com'));
    });
  });
});
