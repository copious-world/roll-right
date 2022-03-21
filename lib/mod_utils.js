
const fs = require('fs')
const path = require('path')
const {load_json_file,array_flatten} = require('../lib/utils')
const {execSync} = require('child_process')
const {translate_marker} = require('../lib/utils')



async function cp_module_to(dest,src,config) {
    let src_dr = translate_marker(src,config)
    let dest_file = translate_marker(dest,config)
    //
    let path_parts = dest_file.split('/')
    try {
        let src_file = `${src_dr}/${path_parts[path_parts.length-1]}`
        fs.copyFileSync(src_file,dest_file)
    } catch (e) {
        console.log(e)
    }
    //
}

async function check_tests(src,dest,config) {
    return true
}

async function shell_command(cmd) {
    try {
        execSync(cmd,{
            stdio: [0, 1, 2]
        })
    } catch (e) {
        console.log(e)
    }
}


function bump_npm_version() {
    let npm = load_json_file("package.json")
    let v = npm.version
    let semv = v.split('.')
    let minv = parseInt(semv[semv.length - 1])
    minv++
    semv[semv.length - 1] = "" + minv
    npm.version = semv.join('.')
    fs.writeFileSync("package.json",JSON.stringify(npm,null,2))
}


async function npm_publish() {
    await shell_command("npm publish .")
}

async function port_modules(config,flags) {
    //
    let all_tests = true
    for ( let mod in config.sources ) {
        let tests_ok = await check_tests(mod,config.sources[mod],config)
        if ( tests_ok ) {
            await cp_module_to(mod,config.sources[mod],config)
        }
        all_tests = all_tests && tests_ok
    }
    //
    if ( all_tests ) {
        switch ( config.mod_type ) {
            case "npm" :
            default: {
                if ( flags.publish ) {
                    bump_npm_version()
                    await npm_publish()    
                }
            }
        }    
    }
}

module.exports.port_modules = port_modules