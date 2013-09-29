
var path = require('path')
  , fs = require('fs')

  , utils = require('./lib')

function httpsCloneCmd(config, branch) {
  var urls = utils.httpsUrl(config)
    , screen = 'git clone --recursive ' + urls[1] + ' .'
    , args = ['clone', '--recursive', urls[0], '.']
  if (branch) {
    args = args.concat(['-b', branch])
    screen += ' -b ' + branch
  }
  return {
    command: 'git',
    args: args,
    screen: screen
  }
}

function pull(dest, config, job, context, done) {
  context.cmd({
    cmd: 'git reset --hard',
    cwd: dest
  }, function (exitCode) {
    utils.gitCmd('git pull', dest, config.auth, job.project.privkey, context, done)
  })
}

function clone(dest, config, job, context, done) {
  if (config.auth.type === 'ssh') {
    var cmd = 'git clone --recursive ' + utils.sshUrl(config)[0] + ' .'
    if (job.ref.branch) {
      cmd += ' -b ' + job.ref.branch
    }
    return utils.gitaneCmd(cmd, dest, config.auth.privkey || job.project.privkey, context, done)
  }
  context.cmd({
    cmd: httpsCloneCmd(config),
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
  init: function (dest, userConfig, config, job, done) {
    return done(null, {
      config: config,
      userConfig: userConfig,
      fetch: function (context, done) {
        module.exports.fetch(dest, userConfig, config, job, context, done)
      }
    })
  },
  fetch: function (dest, userConfig, config, job, context, done) {
    fs.exists(path.join(dest, '.git'), function (err, exists) {
      // if .git exists, pull, otherwise clone
      (exists ? pull : clone)(dest, config, job, context, function (exitCode) {
        if (exitCode) return done(badCode('Command', exitCode))
        // fetch the ref
        if (job.ref.branch && !job.ref.fetch) {
          return context.cmd({
            cmd: 'git checkout -qf ' + utils.shellEscape(job.ref.id || job.ref.branch),
            cwd: dest
          }, function (exitCode) {
            done(exitCode && badCode('Checkout', exitCode))
          })
        }
        utils.gitCmd('git fetch origin ' + utils.shellEscape(job.ref.fetch), dest, config.auth, job.project.privkey, context, function (exitCode) {
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

