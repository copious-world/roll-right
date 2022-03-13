const fs = require('fs')

// ---- ---- ---- ---- ---- ---- ----
//
let source_dir = process.argv[2]
if ( source_dir === undefined ) {
    source_dir = "."
}



function load_file(src) {
    try {
        let conents = JSON.parse(fs.readFileSync(src).toString())
        return conents
    } catch (e) {
        console.log(e)
    }
}


// // transfer_node_module_browser_version
function transfer_node_module_browser_version(source_spec) {
    let check_file = source_spec.file
    let missing_dependencies = []
    try {
        let package_file = load_file(check_file)
        for ( let dep of source_spec.dependencies ) {
            if ( package_file.dependencies[dep] ) {
                console.log(package_file.dependencies[dep])
                let depCheck = require(dep)
                for ( let depKy in depCheck ) {
                    console.log(depKy  + " ::: " + typeof depCheck[depKy] )
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
function transfer_github_browser_version(source_spec) {
    
}

// // transfer_local_directory_browser_version
function transfer_local_directory_browser_version(source_spec) {
    
}


// // 
function read_data(sdir) {
    try {
        let roll_conf = JSON.parse(fs.readFileSync(sdir + '/roll-right.json').toString())
        console.dir(roll_conf)
        for ( let ky in roll_conf ) {
            let source_spec = roll_conf[ky]
            let kys = Object.keys(source_spec)
            if ( kys.length ) {
                switch ( ky ) {
                    case "pnpm" : {
                        transfer_node_module_browser_version(source_spec)
                        break
                    }
                    case "github" : {
                        transfer_github_browser_version(source_spec)
                        break
                    }
                    case "local" : {
                        transfer_local_directory_browser_version(source_spec)
                        break;
                    }
                    default: {
                        // plugins
                        break;
                    }

                }
            }
        }
    } catch (e) {
        console.log(e)
    }
}





read_data(source_dir)