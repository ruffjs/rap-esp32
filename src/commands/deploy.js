'use strict';

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const tmp = require('tmp');
const deployment = require('./deployment');

const { spawn, spawnSync } = require('child_process');
const { Promise } = require('thenfail');
const { flash } = require('./flash');

const ORIGIN = 0x300000;
const ruffCompiler = 'ruff-compiler';

exports.deploy = function (rap, program, trace) {
    program
        .usage('[options...]')
        .option('--source', 'deploy source code directly without pre-compilation')
        .option('--package [path]', 'create the deployment package');

    trace.push(action);
};

function action(rap, program) {
    let toCompile = !program.source;

    // lm4flash requires 4K, but OTA doesn't
    let alignment = Number.parseInt(program.align) || 4 * 1024;
    alignment = Math.floor(alignment / 8) * 8;

    // disable absolute addressing by default
    program.address = program.address || '-1';
    let origin = Number.parseInt(program.address) || ORIGIN;

    // figure out APP path
    let appPath = program.package || null;
    if (typeof appPath === 'boolean') {
        appPath = require(path.join(process.cwd(), 'package.json')).name;
    }
    if (appPath && !/\.bin$/i.test(appPath)) {
        appPath += '.bin';
    }

    rap
        .getDeploymentManifest()
        .then(manifest => {
            if (appPath) {
                // create package only
                return new Promise((resolve, reject) => {
                    try {
                        let appBuffer = generateApp(manifest, toCompile, origin, alignment);
                        fs.writeFileSync(appPath, appBuffer);
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                }).then(() => {
                    console.log(`Package created at "${appPath}"`);
                });
            } else {
                // create package and deploy it
                let appPath = tmp.tmpNameSync();
                let appBuffer = generateApp(manifest, toCompile, origin, alignment);
                fs.writeFileSync(appPath, appBuffer);

                let cp = flash({
                    type: 'flash-application',
                    binary: appPath,
                    address: origin
                });

                return Promise.for(cp);
            }
        });
}

function generateApp(manifest, toCompile, origin, alignment) {
    const deployment = require('../lib/deployment');

    let compilerCmd = findCommand(ruffCompiler);
    if (!compilerCmd) {
        toCompile = false;
        console.log(chalk.yellow(`Could not find "${ruffCompiler}" in $PATH, fallback to source code.`));
    }

    let rofsManifest = [];
    let modsManifest = [
        {
            name: 'dht11',
            objects: [

            ]
        }
    ];

    let modMap = Object.create(null);

    for (let pathInfo of manifest) {
        let { name, source, sourceText, content } = pathInfo;

        let extName = path.extname(name);
        switch (extName) {
            case '.so': {
                let searchName = name;

                let lastBaseName;
                let baseName;

                do {
                    lastBaseName = baseName;
                    searchName = path.dirname(searchName);
                    baseName = path.basename(searchName);
                } while (lastBaseName !== 'ruff_modules');

                let moduleName = lastBaseName;

                if (moduleName in modMap) {
                    modMap[moduleName].objects.push(source || content);
                } else {
                    let mod = {
                        name: moduleName,
                        objects: [source || content]
                    };

                    modMap[moduleName] = mod;

                    modsManifest.push(mod);
                }

                break;
            }

            case '.js': {
                let name = pathInfo.name;
                let content = pathInfo.content || pathInfo.sourceText || fs.readFileSync(pathInfo.source);
                if (toCompile) {
                    let patched = `(function(){return function(exports,require,module,__filename,__dirname){${content}\n}})();`;
                    content = runCompiler(compilerCmd, name, patched);
                }
                rofsManifest.push({ name, content });
                break;
            }

            case '.json': {
                let name = pathInfo.name;
                let content = pathInfo.content || pathInfo.sourceText || fs.readFileSync(pathInfo.source);
                if (toCompile) {
                    let patched = `(function(){return ${content.toString().trim()};})();`;
                    content = runCompiler(compilerCmd, name, patched);
                }
                rofsManifest.push({ name, content });
                break;
            }

            default: {
                rofsManifest.push(pathInfo);
                break;
            }
        }
    }

    return deployment.mkapp(origin, modsManifest, rofsManifest, alignment);
}

function runCompiler(compileCmd, srcName, srcContent) {
    let result = spawnSync(compileCmd, [srcName], {
        input: srcContent
    });

    if (result.error) {
        console.log(`Unable to run ${ruffCompiler}`);
        throw result.error;
    }

    if (result.status !== 0) {
        let msg = result.stdout.toString();
        throw new Error(msg);
    }

    return result.stdout;
}

function findCommand(cmd) {
    const which = require('which');
    try {
        return which.sync(cmd);
    } catch (e) {
        return '';
    }
}