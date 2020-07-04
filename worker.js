'use strict';

var debug = require('debug')('strider-git:worker');
var fs = require('fs-extra');
var path = require('path');
var spawn = require('child_process').spawn;
var utils = require('./lib');

function safespawn() {
  var process;
  try {
    process = spawn.apply(null, arguments);
  } catch (e) {
    throw new Error(
      `Failed to start command: ${JSON.stringify([].slice.call(arguments))}`
    );
  }
  process.on('error', function (err) {
    // suppress node errors
    debug(err);
  });
  return process;
}

function httpCloneCmd(config, branch) {
  var urls = utils.httpUrl(config);
  var screen = `git clone --recursive ${urls[1]} .`;
  var args = ['clone', '--recursive', urls[0], '.'];
  if (branch) {
    args = args.concat(['--branch', branch]);
    screen += ` --branch ${branch}`;
  }
  return {
    command: 'git',
    args: args,
    screen: screen,
  };
}

function pull(dest, config, context, branch, done) {
  utils.gitCmd('git fetch', dest, config.auth, context, function () {
    context.cmd(
      {
        cmd: `git reset --hard origin/${branch}`,
        cwd: dest,
      },
      done
    );
  });
}

function gitVersion(next) {
  var child = safespawn('git', ['--version']);
  var out = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', function (data) {
    out += data;
  });
  child.stderr.on('data', function (data) {
    out += data;
  });
  child.on('close', function (code) {
    if (code) return next(new Error(`Failed to get git version: ${out}`));
    next(null, out);
  });
  child.on('error', function () {});
}

function clone(dest, config, ref, context, done) {
  var git_version = parseFloat('1.0');

  gitVersion(function (err, result) {
    if (err) {
      debug('Git Version Error:', err);
      return done(err);
    }

    var versionArray = result.split(' ');

    if (versionArray[0] == 'git' && versionArray[1] == 'version') {
      git_version = parseFloat(versionArray[2]);
    }

    debug(`Git Version:${git_version}`);
  });

  if (config.auth.type === 'ssh') {
    var cmd = `git clone --recursive ${utils.sshUrl(config)[0]} .`;

    if (ref.branch) {
      cmd += ` --branch ${ref.branch}`;
      // this /only/ gets the one branch; so only use if we won't be caching
      if (!config.cache && git_version >= 1.8) {
        cmd += ' --single-branch';
      }
    }

    return utils.gitaneCmd(cmd, dest, config.auth.privkey, context, done);
  }

  context.cmd(
    {
      cmd: httpCloneCmd(config, ref.branch),
      cwd: dest,
    },
    done
  );
}

function badCode(name, code) {
  var e = new Error(`${name} failed with code ${code}`);
  e.code = code;
  e.exitCode = code;
  return e;
}

module.exports = {
  init: function (dirs, config, job, done) {
    return done(null, {
      config: config,
      fetch: function (context, done) {
        module.exports.fetch(dirs.data, config, job, context, done);
      },
    });
  },
  fetch: fetch,
};

function getMasterPrivKey(branches) {
  for (var i = 0; i < branches.length; i++) {
    if (branches[i].name === 'master') {
      return branches[i].privkey;
    }
  }
}

function checkoutRef(dest, cmd, ref, done) {
  return cmd(
    {
      cmd: `git checkout --quiet --force ${utils.shellEscape(
        ref.id || ref.branch
      )}`,
      cwd: dest,
    },
    function (exitCode) {
      done(exitCode && badCode('Checkout', exitCode));
    }
  );
}

function fetch(dest, config, job, context, done) {
  if (config.auth.type === 'ssh' && !config.auth.privkey) {
    config.auth.privkey = getMasterPrivKey(job.project.branches);
  }
  var cloning = false;

  function pleaseClone() {
    cloning = true;
    fs.mkdirp(dest, function () {
      clone(dest, config, job.ref, context, updateCache);
    });
  }

  if (!config.cache) return pleaseClone();

  context.cachier.get(dest, function (err) {
    if (err) return pleaseClone();
    // make sure .git exists
    fs.exists(path.join(dest, '.git'), function (exists) {
      if (exists) {
        context.comment('restored code from cache');
        return pull(dest, config, context, job.ref.branch, updateCache);
      }
      fs.remove(dest, function () {
        pleaseClone();
      });
    });
  });

  function updateCache(exitCode) {
    if (exitCode) {
      return done(badCode(`Git ${cloning ? 'clone' : 'pull'}`, exitCode));
    }
    if (!config.cache) {
      return gotten();
    }
    context.comment('saved code to cache');
    context.cachier.update(dest, gotten);
  }

  function gotten(err) {
    if (err) {
      return done(err);
    }
    // fetch the ref
    if (job.ref.branch && !job.ref.fetch) {
      return checkoutRef(dest, context.cmd, job.ref, done);
    }
    fetchRef(job.ref.fetch, dest, config.auth, context, done);
  }
}

function fetchRef(what, dest, auth, context, done) {
  utils.gitCmd(
    `git fetch origin ${utils.shellEscape(what)}`,
    dest,
    auth,
    context,
    function (exitCode) {
      if (exitCode) {
        return done(badCode(`Fetch ${what}`, exitCode));
      }
      context.cmd(
        {
          cmd: 'git checkout --quiet --force FETCH_HEAD',
          cwd: dest,
        },
        function (exitCode) {
          done(exitCode && badCode('Checkout', exitCode));
        }
      );
    }
  );
}
