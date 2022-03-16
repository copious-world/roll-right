#!/usr/bin/env node

const papa = require('../index.js')
const {load_json_file} = require('../lib/utils')

const {transfer_node_module_browser_version} = require('../lib/rr_utils')
const {transfer_github_browser_version} = require('../lib/rr_utils')
const {transfer_local_directory_browser_version} = require('../lib/rr_utils')

const Phase1 = require('../lib/phase1')

var g_argv = require('minimist')(process.argv.slice(2));
console.log(g_argv);


let g_source_dir = g_argv._
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
                let ph1 = new Phase1(g_config.alpha)
                ph1.run()
                break
            }
            case 2: {

                break
            }
            default : {
                console.log("unnown phase")
                break;
            }
        }
    }
    

}



command_line_operations()