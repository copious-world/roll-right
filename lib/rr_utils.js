
const fs = require('fs')
const path = require('path')
const fos = require('extra-file-class')()


const {array_flatten} = require('../lib/utils')


function load_package_json(pars) {
    let file_path = `${pars}/package.json`
    try {
        let content = fs.readFileSync(file_path).toString()
        return { file_path, content }
    } catch(e) {
    }
    return { file_path, "content" : false }
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
                if ( !(fsoc.is_dirSync(file_path)) ) {
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
            let package_item = load_package_json(pars)
            if ( package_item.content ) file_content.unshift(package_item)
            return file_content.filter(data => (data.content.length > 0))
        } catch(e) {
            console.log(e)
        }
    }
    console.log("_browser_code_access :: no files " + __dirname  + " "  + __filename )
    return []
}


module.exports.browser_code_access = _browser_code_access




function check_sub_deps(dep,dependencies) {
    console.log(dep)
    console.log(dependencies)
    if ( Array.isArray(dep) ) {
        let ret_val = dep.shift()
        for ( let subdep of dep ) {
            if ( subdep in dependencies ) {
                return ret_val
            }
        }
    }
    return false
}



// // transfer_node_module_browser_version
module.exports.transfer_node_module_browser_version = async (source_spec) => {
    let check_file = source_spec.file
    let out_dir = source_spec.out_dir
    let missing_dependencies = []
    try {
        // need to do this... node does not look at the current working directory
        module.paths.unshift(`${process.cwd()}/node_modules`)
        //
        let package_file = fos.load_json_data_at_path(check_file)
        for ( let dep of source_spec.dependencies ) {
            if ( ((typeof dep === 'string') && package_file.dependencies[dep]) || (dep = check_sub_deps(dep,package_file.dependencies))  ) {
                console.log(dep + " :: " + package_file.dependencies[dep])
                //
                let depCheck = require(dep)             // require ... ... ... ... ...
                //
                for ( let depKy in depCheck ) {
                    console.log(depKy  + " ::: " + typeof depCheck[depKy] )
                    if ( typeof depCheck[depKy] === "function" ) {
                        if (depKy === "browser_code") {
                            try {
                                let code_list = depCheck.browser_code()
                                for ( let codes of code_list ) {
                                    let { file_path, content } = codes
                                    if ( file_path.indexOf("package.json") >= 0 ) {
                                        let mod_pack = await fos.load_json_data_at_path(file_path)
                                        let deps = mod_pack.dependencies
                                        package_file.dependencies = Object.assign({},package_file.dependencies,deps)
                                    } else {
                                        console.log(" -------> " + file_path)
                                        //console.log(content)
                                        let out_file = `${out_dir}/${dep}.js`
                                        fs.writeFileSync(out_file,content)    
                                    }
                                }    
                            } catch (e) {
                                console.log(e)
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