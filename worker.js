
var gitane = require('gitane')
  , shellescape = require('shell-escape')

  , path = require('path')
  , fs = require('fs')

function shellEscape(one) {
  return shellescape([one])
}

function httpsCmd(config, branch) {
  var url = 'https://' + config.auth.username + ':' + config.auth.password + '@' + config.url
    , screen = 'git clone --recursive ' + 'https://[username]:[password]@' + config.url + ' .'
    , args = ['clone', '--recursive', url, '.']
  if (branch) {
    args = args.concat(['-b', branch])
    screen += ' -b ' + branch
  }
  return {
    command: 'git',
    args: args
    screen: screen
  }
}

// run a strider command with gitane
function gitaneCmd(cmd, dest, privkey, context, done) {
  var start = new Date()
  context.status('command.start', { text: cmd, time: start, plugin: context.plugin })
  gitane.run({
    emitter: {
      emit: context.status
    },
    cmd: cmd,
    baseDir: dest,
    privKey: privkey,
    detached: true
  }, function (err, stdout, stderr, exitCode) {
    var end = new Date()
      , elapsed = end.getTime() - start.getTime()
    if (err) {
      context.log('Gitane error:', err.message)
    }
    context.log('gitane command done %s; exit code %s; duration %s', cmd, exitCode, elapsed)
    context.status('command.done', {exitCode: exitCode, time: end, elapsed: elapsed})
    done(err ? 500 : exitCode)
  })
}

function gitCmd(cmd, dest, config, job, context, done) {
  if (config.auth.type === 'ssh') {
    return gitaneCmd(cmd, dest, config.auth.privkey || job.project.privkey, context, done)
  }
  context.cmd({
    cmd: cmd,
    cwd: dest
  }, done)
}

function pull(dest, config, job, context, done) {
  context.cmd({
    cmd: 'git reset --hard',
    cwd: dest
  }, function (exitCode) {
    gitCmd('git pull', dest, config, job, context, done)
  })
}

function clone(dest, config, job, context, done) {
  if (config.auth.type === 'ssh') {
    var cmd = 'git clone --recursive ' + shellEscape('git@' + config.url.replace('/', ':')) + ' .'
    if (job.ref.branch) {
      cmd += ' -b ' + job.ref.branch
    }
    return gitaneCmd(cmd, dest, config.auth.privkey || job.project.privkey, context, done)
  }
  context.cmd({
    cmd: httpsCmd(config),
    cwd: dest
  }, done)
}

function badCode(name, code) {
  var e = new Error(name + ' failed with code ' + code)
  e.code = code
  e.exitCode = code
  return e
}

module.exports = {
  fetch: function (dest, userConfig, config, job, context, done) {
    fs.exists(path.join(dest, '.git'), function (err, exists) {
      // if .git exists, pull, otherwise clone
      (exists ? pull : clone)(dest, config, job, context, function (exitCode) {
        if (exitCode) return done(badCode('Command', exitCode))
        // fetch the ref
        if (job.ref.branch) {
          return context.cmd({
            cmd: 'git checkout -qf ' + shellEscape(job.ref.id),
            cwd: dest
          }, function (exitCode) {
            done(exitCode && badCode('Checkout', exitCode))
          })
        }
        gitCmd('git fetch origin ' + shellEscape(job.ref.fetch), dest, config, job, context, function (exitCode) {
          if (exitCode) return done(badCode('Fetch ' + job.ref.fetch, exitCode))
          context.cmd({
            cmd: 'git checkout -qf FETCH_HEAD',
            cwd: dest
          }, function (exitCode) {
            done(exitCode && badCode('Checkout', exitCode))
          })
        })
      })
    })
  }
}

