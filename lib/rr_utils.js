
const fs = require('fs')
const path = require('path')
const {load_json_file,array_flatten} = require('../lib/utils')


// from stack oveflow
function isDir(path) {
    try {
        let stat = fs.lstatSync(path);
        return stat.isDirectory();
    } catch (e) {
        // lstatSync throws an error if path doesn't exist
        return false;
    }
}


const g_permit_paths = {'.js' : true, '.mjs' : true, '.json' : true }

 const _browser_code_access = (pars,subdirs,topdir) => {
    if ( typeof pars === "string" ) {
        try {
            let client_code_path = (topdir === undefined) ? `${pars}/client` : `${pars}/${topdir}`
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
                } else if ( subdirs !== undefined ) {
                    if ( subdirs.indexOf(file_name) >= 0 ) {
                        return _browser_code_access(client_code_path,subdirs,file_name)
                    }
                }
                return { file_path, content }
            })
            file_content = array_flatten(file_content)
            return file_content.filter(data => (data.content.length > 0))
        } catch(e) {
            console.log(e)
        }
    }
    console.log("no files " + __dirname  + " "  + __filename )
    return []
}


module.exports.browser_code_access = _browser_code_access




// // transfer_node_module_browser_version
module.exports.transfer_node_module_browser_version = (source_spec) => {
    let check_file = source_spec.file
    let missing_dependencies = []
    try {
        console.dir(module.paths)
        module.paths.unshift(`${process.cwd()}/node_modules`)
        console.dir(module.paths)

        let package_file = load_json_file(check_file)
        for ( let dep of source_spec.dependencies ) {
            if ( package_file.dependencies[dep] ) {
                console.log(package_file.dependencies[dep])
                let depCheck = require(dep)
                for ( let depKy in depCheck ) {
                    console.log(depKy  + " ::: " + typeof depCheck[depKy] )
                    if ( typeof depCheck[depKy] === "function" ) {
                        if (depKy === "browser_code") {
                            let code_list = depCheck.browser_code()
                            for ( let codes of code_list ) {
                                let { file_path, content } = codes
                                console.log(" -------> " + file_path)
                                console.log(content)
                            }
                        }
                    }
                }
            } else {
                missing_dependencies.push(dep)
            }
        }
        //
        //
    } catch (e) {
        console.log(e)
    }
}



// // transfer_github_browser_version
module.exports.transfer_github_browser_version  = (source_spec) => {
    
}

// // transfer_local_directory_browser_version
module.exports.transfer_local_directory_browser_version = (source_spec) => {
    
}