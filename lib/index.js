
var gitane = require('gitane')
  , exec = require('child_process').exec
  , shellescape = require('shell-escape')

module.exports = {
  gitUrl: gitUrl,
  sshUrl: sshUrl,
  httpUrl: httpUrl,
  gitCmd: gitCmd,
  gitaneCmd: gitaneCmd,
  processBranches: processBranches,
  getBranches: getBranches,
  shellEscape: shellEscape
}

function shellEscape(one) {
  if (!one) {
    throw new Error('trying to escape nothing', one)
  }
  return shellescape([one])
}

// returns [real, safe] urls
function gitUrl(config) {
  return (config.auth.type === 'ssh' ? sshUrl : httpUrl)(config)
}

/**
 * TODO: validate all git urls. Currently only http(s):// and ssh are
 * supported.
 *
 * List from http://git-scm.com/docs/git-clone#_git_urls_a_id_urls_a
 * ssh://[user@]host.xz[:port]/path/to/repo.git/
 * git://host.xz[:port]/path/to/repo.git/
 * http[s]://host.xz[:port]/path/to/repo.git/
 * ftp[s]://host.xz[:port]/path/to/repo.git/
 * rsync://host.xz/path/to/repo.git/
 */

function sshUrl(config) {
  var base = config.url
  if (base.indexOf('ssh://') === 0) {
    return [base, base]
  }
  if (base.indexOf('//') !== -1) {
    base = base.split('//')[1]
  }
  if (base.indexOf('@') === -1) {
    base = 'git@' + base
  }
  if (base.indexOf(':') === -1) {
    base = base.replace('/', ':')
  }
  var url = shellEscape(base)
  return [url, url]
}

function httpUrl(config) {
  var base = config.url
  if (base.indexOf('//') !== -1) {
    base = base.split('//')[1]
  }
  var url = config.auth.type + '://' + config.auth.username + ':' + config.auth.password + '@' + base
    , safe = config.auth.type + '://[username]:[password]@' + base
  return [url, safe]
}

function gitCmd(cmd, cwd, auth, context, done) {
  if (auth.type === 'ssh') {
    return gitaneCmd(cmd, cwd, auth.privkey, context, done)
  }
  context.cmd({
    cmd: cmd,
    cwd: cwd
  }, done)
}

// run a strider command with gitane
function gitaneCmd(cmd, dest, privkey, context, done) {
  var start = new Date()
  context.status('command.start', { command: cmd, time: start, plugin: context.plugin })
  gitane.run({
    emitter: {
      emit: context.status
    },
    cmd: cmd,
    baseDir: dest,
    privKey: privkey,
    detached: true
  }, function (err, stdout, stderr, exitCode) {
    var end = new Date();
    var elapsed = end.getTime() - start.getTime();
    
    if (err) {
      context.log('Gitane error:', err.message);
    }
    
    context.log('gitane command done ' + cmd + '; exit code ' + exitCode + '; duration ' + elapsed);
    context.status('command.done', {
      exitCode: exitCode,
      time: end,
      elapsed: elapsed
    });
    
    done(err ? 500 : exitCode, stdout + stderr);
  })
}

function processBranches(data, done) {
  done(null, data.trim().split(/\n+/).map(function (line) {
    return line.split(/\s+/)[1].split('/').slice(-1)[0]
  }))
}

function getBranches(config, privkey, done) {
  if (config.auth.type === 'ssh') {
    gitane.run({
      cmd: 'git ls-remote -h ' + gitUrl(config)[0],
      baseDir: '/',
      privKey: config.auth.privkey || privkey,
      detached: true
    }, function (err, stdout, stderr, exitCode) {
      if (err || exitCode !== 0) return done(err || new Error(stderr))
      processBranches(stdout, done)
    })
  } else {
    exec('git ls-remote -h ' + httpUrl(config)[0], function (err, stdout, stderr) {
      if (err) return done(err)
      processBranches(stdout, done)
    })
  }
}

// NOTE: github doesn't allow `git archive` to be run on their
// servers. So don't be confused when it doesn't work. Just use the
// file api.
/* also, this doesn't work for arbitrary refs...
function getFile(config, privkey, done) {
  var url = gitUrl(config)[0]
    , cmd = 'git archive --remote=' + url + ' ' + ref + ' .strider.json'
  if (config.auth.type === 'ssh') {
    gitane.run({
      cmd: cmd,
      baseDir: '/',
      privKey: config.auth.privkey || privkey,
      detached: true
    }, function (err, stdout, stderr, exitCode) {
      if (err || exitCode !== 0) return done(err || new Error(stderr))
      done(stdout)
    })
  } else {
    exec(cmd, function (err, stdout, stderr) {
      if (err) return done(err)
      done(stdout)
    })
  }
}
*/
