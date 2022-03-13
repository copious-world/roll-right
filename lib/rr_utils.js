
const fs = require('fs')
const path = require('path')

// from stack oveflow
function isDir(path) {
    try {
        var stat = fs.lstatSync(path);
        return stat.isDirectory();
    } catch (e) {
        // lstatSync throws an error if path doesn't exist
        return false;
    }
}


const g_permit_paths = {'.js' : true, '.mjs' : true, '.json' : true }

module.exports.browser_code_access = (pars) => {
    if ( pars === undefined ) {
        try {
            let client_code_path = './client'
            let dirlist = fs.readdirSync(client_code_path)
            console.dir(dirlist)
            let file_content = dirlist.map(file_name => {
                let file_path = client_code_path + '/' + file_name
                let content = ""
                if ( !(isDir(file_path)) ) {
                    if ( path.extname(file_path) in g_permit_paths ) {
                        content = fs.readFileSync(file_path).toString()
                        return { file_path, content }    
                    }
                }
                return { file_path, content }
            })
            return file_content.filter(data => ( data.content.length > 0))
        } catch(e) {
            console.log(e)
        }
    }
    console.log("no files " + __dirname  + " "  + __filename )
    return []
}

