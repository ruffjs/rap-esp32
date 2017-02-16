'use strict';

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const tmp = require('tmp');
const deployment = require('./deployment');

const { spawn, spawnSync } = require('child_process');
const { Promise } = require('thenfail');
const { flash } = require('./flash');

const ORIGIN = parseInt('0x300000', 16);
const ruffCompiler = 'ruff-compiler';

exports.createDeploymentPackage = createDeploymentPackage;

function createDeploymentPackage(sessionInfo, pathInfos, options) {
    let packagePath = options.path;
    if (!/\.bin$/i.test(packagePath)) {
        packagePath += '.bin';
        options.path = packagePath;
    }
    return new Promise((resolve, reject) => {
        try {
            let appPath = options.path;
            let toCompile = options.toCompile;
            let origin = options.address || ORIGIN;
            let appBuffer = generateApp(pathInfos, toCompile, origin);
            fs.writeFileSync(appPath, appBuffer);
            resolve();
        } catch (error) {
            reject(error);
        }
    }).then(() => {
        return packagePath;
    });
}

exports.deploy = deploy;

function deploy(sessionInfo, pathInfos, options) {
    let appPath = tmp.tmpNameSync();
    let toCompile = options.toCompile;
    let origin = options.address || ORIGIN;
    let appBuffer = generateApp(pathInfos, toCompile, origin);
    fs.writeFileSync(appPath, appBuffer);

    let onprogress = options.onprogress || function () { };
    onprogress('deploying', { size: appBuffer.length });

    let cp = flash({
        binary: appPath,
        address: origin
    });

    return Promise.for(cp);
}

function generateApp(pathInfos, toCompile, origin) {
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

    for (let pathInfo of pathInfos) {
        let { name, source, content } = pathInfo;

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
                if (toCompile) {
                    let orig = pathInfo.content ? pathInfo.content : fs.readFileSync(pathInfo.source);
                    let content = `(function(){return function(exports,require,module,__filename,__dirname){${orig}\n}})();`;
                    let compiled = runCompiler(compilerCmd, name, content);
                    delete pathInfo.source;
                    pathInfo.content = compiled;
                }
                rofsManifest.push(pathInfo);
                break;
            }

            case '.json': {
                if (toCompile) {
                    let orig = pathInfo.content ? pathInfo.content : fs.readFileSync(pathInfo.source);
                    let content = `(function(){return ${orig.toString().trim()};})();`;
                    let compiled = runCompiler(compilerCmd, name, content);
                    delete pathInfo.source;
                    pathInfo.content = compiled;
                }
                rofsManifest.push(pathInfo);
                break;
            }

            default: {
                rofsManifest.push(pathInfo);
                break;
            }
        }
    }

    return deployment.mkapp(origin, modsManifest, rofsManifest);
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
