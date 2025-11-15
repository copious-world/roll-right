#!/usr/bin/env node

const fos = require('extra-file-class')()

const {transfer_node_module_browser_version} = require('../lib/rr_utils')
const {transfer_github_browser_version} = require('../lib/rr_utils')
const {transfer_local_directory_browser_version} = require('../lib/rr_utils')
const {port_modules} = require('../lib/mod_utils')

const Phase1 = require('../lib/phase1')
const Phase2 = require('../lib/phase2')
//
//

var g_argv = require('minimist')(process.argv.slice(2));
console.dir(g_argv);

let g_target = g_argv._[0]
let g_source_dir = g_argv._[1]
if ( g_source_dir === undefined ) {
    g_source_dir = "."
}

//
//
async function load_config(cf_name) {
    let path = g_source_dir + '/' + cf_name
    return await fos.load_json_data_at_path(path)
}

// // 
function read_data(roll_conf) {
    try {
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


async function command_line_operations() {
    console.log("command line operations")

    g_config = await load_config("roll-right.json")

    if ( g_argv.phase ) {
        console.log(`starting phase ${g_argv.phase} instantiation`)
        switch ( g_argv.phase ) {
            case "template" :
            case 1: {                       /// creates templates
                if ( typeof g_config.alpha === "string" ) {
                    g_config.alpha = fos.load_json_data_at_path(g_config.alpha) // ALPHA
                }
                let ph1 = new Phase1(g_target,g_config.alpha)       // g_target <- args[0] ... g_config <- read <- g_source_dir <- args[1] 
                ph1.run()
                break
            }
            case "page":
            case 2: {
                if ( typeof g_config.beta === "string" ) {
                    g_config.beta = fos.load_json_data_at_path(g_config.beta)   // BETA 
                }
                let ph2 = new Phase2(g_target,g_config.beta)        // g_target <- args[0] ... g_config <- read <- g_source_dir <- args[1] 
                ph2.run()
                break
            }
            default : {
                console.log("unnown phase")
                break;
            }
        }
    }
    if ( g_argv.gather ) {  // about moving files to directories for node module, browser modules, etc.
        if ( typeof g_config.gather === "string" ) {
            g_config.modules = fos.load_json_data_at_path(g_config.gather)
        }
        read_data(g_config.gather)
    }
    if ( g_argv.modules ) {  // transforms and then copies base alpha code to final publication directores (npm is the only case yet)
        if ( typeof g_config.modules === "string" ) {
            g_config.modules = fos.load_json_data_at_path(g_config.modules)
        }
        port_modules(g_config.modules,g_argv)
    }

}



console.log("roll-right static content management and module publication")

command_line_operations()