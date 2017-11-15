// require
var fs = require('fs');
var pckg = require('./package.json');

// helper
var copy = function(srcDir, dstDir) {
    var results = [];
    var list = fs.readdirSync(srcDir);
    var src, dst;
    // prepare dist folder
    deleteFolderRecursive(dstDir);
    mkdirSyncRecursive(dstDir);
    // prepare dist folder
    list.forEach(function(file) {
        src = srcDir + '/' + file;
        dst = dstDir + '/' + file;
        //console.log(src);
        var stat = fs.statSync(src);
        if (stat && stat.isDirectory()) {
            try {
                console.log('creating dir: ' + dst);
                fs.mkdirSync(dst);
            } catch(e) {
                console.log('directory already exists: ' + dst);
            }
            results = results.concat(copy(src, dst));
        } else {
            try {
                console.log('copying file: ' + dst);
                //fs.createReadStream(src).pipe(fs.createWriteStream(dst));
                fs.writeFileSync(dst, fs.readFileSync(src));
            } catch(e) {
                console.log('could\'t copy file: ' + dst);
            }
            results.push(src);
        }
    });
    return results;
};
var deleteFolderRecursive = function(path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function(file){
            var curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};
var mkdirSyncRecursive = function(directory) {
    var path = directory.replace(/\/$/, '').split('/');
    for (var i = 1; i <= path.length; i++) {
        var segment = path.slice(0, i).join('/');
        !fs.existsSync(segment) ? fs.mkdirSync(segment) : null ;
    }
};

// preparation
var versionString = pckg.version;
var packageName = 'tstr-crs-adapter';
var distGcsVersion = 'dist-version/' + packageName + '/' + versionString;
var distGcsMaster = 'dist-master/' + packageName + '/latest';

// action
copy('dist', distGcsVersion);
copy('dist', distGcsMaster);
