#!/usr/bin/env node

const papa = require('../index.js')
const {load_json_file} = require('../lib/utils')

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


function load_config(cf_name) {
    let path = g_source_dir + '/' + cf_name
    return load_json_file(path)
}


const g_config = load_config("roll-right.json")
papa.identify_me()

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

    if ( g_argv.phase ) {
        console.log(`starting phase ${g_argv.phase} instantiation`)
        switch ( g_argv.phase ) {
            case 1: {
                if ( typeof g_config.alpha === "string" ) {
                    g_config.alpha = load_json_file(g_config.alpha)
                }
                let ph1 = new Phase1(g_target,g_config.alpha)
                ph1.run()
                break
            }
            case 2: {
                if ( typeof g_config.beta === "string" ) {
                    g_config.beta = load_json_file(g_config.beta)
                }
                let ph2 = new Phase2(g_target,g_config.beta)
                ph2.run()
                break
            }
            default : {
                console.log("unnown phase")
                break;
            }
        }
    }
    if ( g_argv.gather ) {
        if ( typeof g_config.gather === "string" ) {
            g_config.modules = load_json_file(g_config.gather)
        }
        read_data(g_config.gather)
    }
    if ( g_argv.modules ) {
        if ( typeof g_config.modules === "string" ) {
            g_config.modules = load_json_file(g_config.modules)
        }
        port_modules(g_config.modules,g_argv)
    }

}



command_line_operations()